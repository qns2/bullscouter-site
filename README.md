# Bull Scouter Dashboard

Public dashboard for [Bull Scouter](https://www.bullscouter.com) — automated stock catalyst detection system.

## How it works

A local scanner runs daily (weekdays 08:30 ET), analyzing Reddit, FDA calendars, space launches, earnings, and more to surface high-potential opportunities 90-120 days before binary catalysts.

After each scan, results are exported as static JSON and pushed to this repo. GitHub Pages serves the frontend.

```
bull-scouter (private)              bullscouter-site (public, GitHub Pages)
  scanner/main.py                     index.html
    → daily_scan()                    js/app.js, js/charts.js
    → export_dashboard() ──push──→    data/latest.json
                                      data/2026-02-17.json
                                      data/index.json
```

## Signal types

| Signal | Score | Meaning |
|--------|-------|---------|
| **BUY** | 75+ | High-confidence catalyst play with multiple confirming signals |
| **WATCHLIST** | 65-74 | Promising setup, needs more confirmation |
| **MOMENTUM** | 40-64 | Early-stage tracking, building thesis |

## Scoring tracks

- **Track A (Recovery)**: Tier 1 (binary catalysts, small-cap) + Tier 2 (fallen angels) + Growth (revenue-quality)
- **Track B (Acceleration)**: Large-cap momentum breakouts

Each opportunity shows a score breakdown, confidence rating, catalyst countdown, and score trend sparkline.

## Tech stack

- Vanilla JS + [Tailwind CSS](https://tailwindcss.com) (CDN) + [Chart.js](https://www.chartjs.org) (CDN)
- Zero build step — static files served directly by GitHub Pages
- Data refreshed daily via automated git push from the scanner

## Disclaimer

This is not financial advice. Past performance does not guarantee future results. All signals are algorithmic and should be independently verified before making investment decisions.
