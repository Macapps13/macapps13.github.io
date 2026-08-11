tailwind.config = {
    theme: {
        extend: {
            colors: {
                brand: {
                    black: '#030708',
                    dark: '#0a0f12',
                    gray: '#172227',
                    text: '#f1f5f9',
                    muted: '#94a3b8',
                    sage: '#608a6d',
                    sageLight: '#a3c2ae',
                    olive: '#2d3f38',
                    glow: 'rgba(96, 138, 109, 0.15)'
                }
            },
            fontFamily: {
                sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
                display: ['"Outfit"', 'sans-serif'],
                mono: ['"Fira Code"', 'monospace']
            },
            animation: {
                'pulse-slow': 'pulse-slow 8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                'pulse-slow': {
                    '0%, 100%': { opacity: 0.15, transform: 'scale(1)' },
                    '50%': { opacity: 0.3, transform: 'scale(1.15)' },
                }
            }
        }
    }
}
