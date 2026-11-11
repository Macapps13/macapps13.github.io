"""Generate data/predictions.json for Predictor.app.

This is the model from websiteOutput.py / oddsCalc.py in
Macapps13/BasketballPredictor, run on a schedule by GitHub Actions instead of
behind a Flask server:

1. Today's games come from the NBA live scoreboard.
2. Each team's rating is its average point differential per regular-season
   game this season, from the NBA schedule's final scores. (The original used
   stats.nba.com's estimated net rating, but stats.nba.com doesn't answer
   requests from GitHub's servers. Point differential is on the same scale.)
3. The rating gap is turned into a win probability with a logistic model and
   a normal model, and their average gives fair decimal odds.
4. US bookmaker 2-way odds come from the NBA live odds feed.

Everything comes from cdn.nba.com. The file is only rewritten when the
predictions change, so the scheduled job doesn't commit when nothing is new.
If a request fails after retries, the script exits with an error and leaves
the existing file alone.
"""

import json
import math
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import requests

OUT = Path(__file__).resolve().parent.parent / "data" / "predictions.json"
SCOREBOARD_URL = "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json"
ODDS_URL = "https://cdn.nba.com/static/json/liveData/odds/odds_todaysGames.json"
SCHEDULE_URL = "https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json"
HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:158.0) Gecko/20100101 Firefox/158.0",
    "Referer": "https://www.nba.com/",
    "Origin": "https://www.nba.com",
}
TIMEOUT = 60
RATING = "Average point differential per regular-season game this season"


# ---------------------------------------------------------------- model
# Same formulas and constants as oddsCalc.py. The normal CDF uses math.erf,
# which matches scipy.stats.norm.cdf without needing scipy.

def win_prob_logistic(rating_diff, k=0.12):
    return 1 / (1 + math.exp(-k * rating_diff))


def win_prob_normal(rating_diff, pace=100, home_adv=0, sigma=12):
    margin = rating_diff * (pace / 100) + home_adv
    return 0.5 * (1 + math.erf(margin / sigma / math.sqrt(2)))


def fair_decimal(p):
    return round(1.0 / p, 3)


# ---------------------------------------------------------------- data

def get_json(url, what, tries=3, wait=15):
    for attempt in range(1, tries + 1):
        try:
            res = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            res.raise_for_status()
            return res.json()
        except Exception as err:  # network errors, timeouts, bad JSON
            print(f"{what}: attempt {attempt} of {tries} failed: {err}", file=sys.stderr)
            if attempt == tries:
                raise
            time.sleep(wait * attempt)


def team_ratings(schedule):
    """Average point differential per team from completed regular-season games."""
    margins = defaultdict(list)
    for day in schedule.get("leagueSchedule", {}).get("gameDates", []):
        for g in day.get("games", []):
            # Regular-season game IDs start with 002 (001 is preseason, 004 playoffs).
            if not str(g.get("gameId", "")).startswith("002") or g.get("gameStatus") != 3:
                continue
            home, away = g.get("homeTeam", {}), g.get("awayTeam", {})
            try:
                hs, as_ = int(home["score"]), int(away["score"])
                hid, aid = int(home["teamId"]), int(away["teamId"])
            except (KeyError, TypeError, ValueError):
                continue
            margins[hid].append(hs - as_)
            margins[aid].append(as_ - hs)
    return {tid: (sum(m) / len(m), len(m)) for tid, m in margins.items() if m}


def us_two_way_odds(game_odds):
    """Decimal (home, away, book) odds from the first US book's 2-way market."""
    for market in game_odds.get("markets", []):
        if market.get("name") != "2way":
            continue
        for book in market.get("books", []):
            if book.get("countryCode") != "US":
                continue
            prices = {}
            for outcome in book.get("outcomes", []):
                try:
                    prices[outcome.get("type")] = float(outcome.get("odds"))
                except (TypeError, ValueError):
                    pass
            if "home" in prices and "away" in prices:
                return prices["home"], prices["away"], book.get("name")
    return None, None, None


def predict(game, ratings, odds_by_id):
    home, away = game["homeTeam"], game["awayTeam"]
    entry = {
        "gameId": game["gameId"],
        "home": home["teamName"],
        "away": away["teamName"],
        "homeTricode": home.get("teamTricode"),
        "awayTricode": away.get("teamTricode"),
        "tipoff": game.get("gameTimeUTC"),
        "status": game.get("gameStatusText", "").strip(),
        "gameStatus": game.get("gameStatus"),
        "homeScore": home.get("score"),
        "awayScore": away.get("score"),
    }
    h = ratings.get(int(home["teamId"]))
    a = ratings.get(int(away["teamId"]))
    if h is None or a is None:
        entry["error"] = "Not enough games played yet to rate both teams"
        return entry

    (home_rating, home_played), (away_rating, away_played) = h, a
    diff = abs(home_rating - away_rating)
    logistic = win_prob_logistic(diff)
    normal = win_prob_normal(diff)
    winner_is_home = home_rating > away_rating
    home_odds, away_odds, book = us_two_way_odds(odds_by_id.get(game["gameId"], {}))

    entry.update({
        "homeRating": round(home_rating, 2),
        "awayRating": round(away_rating, 2),
        "homePlayed": home_played,
        "awayPlayed": away_played,
        "winner": entry["home"] if winner_is_home else entry["away"],
        "logisticWinProb": round(logistic, 4),
        "normalWinProb": round(normal, 4),
        "fairOdds": fair_decimal((logistic + normal) / 2),
        # Market odds for the predicted winner, so they compare with fairOdds.
        "marketOdds": home_odds if winner_is_home else away_odds,
        "homeOdds": home_odds,
        "awayOdds": away_odds,
        "book": book,
    })
    return entry


def build():
    sb = get_json(SCOREBOARD_URL, "Scoreboard")["scoreboard"]
    games = sb.get("games", [])
    print(f"{len(games)} game(s) on {sb['gameDate']}")

    ratings, odds_by_id, season = {}, {}, None
    if games:
        schedule = get_json(SCHEDULE_URL, "Schedule")
        season = schedule.get("leagueSchedule", {}).get("seasonYear")
        ratings = team_ratings(schedule)
        print(f"Rated {len(ratings)} team(s) from the {season} schedule")
        feed = get_json(ODDS_URL, "Odds")
        odds_by_id = {g["gameId"]: g for g in feed.get("games", [])}

    return {
        "gameDate": sb["gameDate"],
        "season": season,
        "rating": RATING,
        "games": [predict(g, ratings, odds_by_id) for g in games],
    }


def main():
    data = build()
    old = None
    if OUT.exists():
        try:
            old = json.loads(OUT.read_text())
        except ValueError:
            old = None
    if old and {k: v for k, v in old.items() if k != "updated"} == data:
        print("Predictions unchanged; leaving the file as it is.")
        return
    data = {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), **data}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2) + "\n")
    for g in data["games"]:
        line = g.get("error") or f"pick {g['winner']} ({g['logisticWinProb']:.1%} / {g['normalWinProb']:.1%}), fair {g['fairOdds']}, market {g['marketOdds']}"
        print(f"  {g['away']} @ {g['home']}: {line}")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
