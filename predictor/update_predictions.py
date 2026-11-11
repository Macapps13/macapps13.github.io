"""Generate data/predictions.json for Predictor.app.

This is the logic of websiteOutput.py from Macapps13/BasketballPredictor,
run on a schedule by GitHub Actions instead of behind a Flask server:

1. Today's games come from the NBA live scoreboard.
2. Each team's estimated net rating (E_NET_RATING) comes from stats.nba.com.
3. The net-rating gap is turned into a win probability with a logistic model
   and a normal model, and their average gives fair decimal odds.
4. US bookmaker 2-way odds come from the NBA live odds feed.

The file is only rewritten when the predictions change, so the scheduled job
doesn't commit when nothing is new. If a request fails after retries, the
script exits with an error and leaves the existing file alone.
"""

import json
import math
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path

from nba_api.live.nba.endpoints import odds, scoreboard
from nba_api.stats.endpoints import teamestimatedmetrics

OUT = Path(__file__).resolve().parent.parent / "data" / "predictions.json"
TIMEOUT = 60


# ---------------------------------------------------------------- model
# Same formulas and constants as oddsCalc.py. The normal CDF uses math.erf,
# which matches scipy.stats.norm.cdf without needing scipy.

def win_prob_logistic(net_rating_diff, k=0.12):
    return 1 / (1 + math.exp(-k * net_rating_diff))


def win_prob_normal(net_rating_diff, pace=100, home_adv=0, sigma=12):
    margin = net_rating_diff * (pace / 100) + home_adv
    return 0.5 * (1 + math.erf(margin / sigma / math.sqrt(2)))


def fair_decimal(p):
    return round(1.0 / p, 3)


# ---------------------------------------------------------------- data

def with_retries(fetch, what, tries=3, wait=15):
    for attempt in range(1, tries + 1):
        try:
            return fetch()
        except Exception as err:  # network errors, timeouts, bad JSON
            print(f"{what}: attempt {attempt} of {tries} failed: {err}", file=sys.stderr)
            if attempt == tries:
                raise
            time.sleep(wait * attempt)


def season_for(day):
    """NBA seasons start in October, e.g. 12 Nov 2026 is in 2026-27."""
    start = day.year if day.month >= 9 else day.year - 1
    return f"{start}-{str(start + 1)[2:]}"


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
    home_net = ratings.get(int(home["teamId"]))
    away_net = ratings.get(int(away["teamId"]))
    if home_net is None or away_net is None:
        entry["error"] = "No net rating for one of these teams yet"
        return entry

    diff = abs(home_net - away_net)
    logistic = win_prob_logistic(diff)
    normal = win_prob_normal(diff)
    winner_is_home = home_net > away_net
    home_odds, away_odds, book = us_two_way_odds(odds_by_id.get(game["gameId"], {}))

    entry.update({
        "homeNetRating": round(home_net, 2),
        "awayNetRating": round(away_net, 2),
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
    board = with_retries(lambda: scoreboard.ScoreBoard(timeout=TIMEOUT), "Scoreboard")
    sb = board.get_dict()["scoreboard"]
    games = sb.get("games", [])
    game_day = date.fromisoformat(sb["gameDate"])
    season = season_for(game_day)
    print(f"{len(games)} game(s) on {game_day} ({season})")

    ratings, odds_by_id = {}, {}
    if games:
        metrics = with_retries(
            lambda: teamestimatedmetrics.TeamEstimatedMetrics(season=season, timeout=TIMEOUT),
            "Team estimated metrics",
        )
        rows = metrics.get_normalized_dict()["TeamEstimatedMetrics"]
        ratings = {int(r["TEAM_ID"]): float(r["E_NET_RATING"]) for r in rows if r.get("E_NET_RATING") is not None}
        feed = with_retries(lambda: odds.Odds(timeout=TIMEOUT), "Odds")
        odds_by_id = {g["gameId"]: g for g in feed.get_dict().get("games", [])}

    return {
        "gameDate": str(game_day),
        "season": season,
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
