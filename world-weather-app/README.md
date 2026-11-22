# SkyRoute — World Weather & Travel Planner

A responsive weather forecast web app built with **Next.js**, ready for GitHub and Vercel.

## Features

- Search for cities worldwide using Open-Meteo Geocoding.
- Current conditions, feels-like temperature, humidity, wind and precipitation.
- Hourly forecast (up to the next 36 available hours).
- 16-day daily forecast (today + the next 15 days).
- Celsius/Fahrenheit display toggle.
- Simple weather-score comparison to surface the most promising days in the forecast window.
- Compare 2–5 destinations side by side, including current conditions, humidity, wind, rain, a 7-day outlook and an indicative weather score.
- Automatically rank shortlisted destinations by their average weather score over the next 7 forecast days.
- Local timezone, sunrise, sunset, wind and UV index.
- Responsive desktop and mobile layout.

## Data provider and limitations

This starter uses the free [Open-Meteo API](https://open-meteo.com/) and does not require an API key for typical non-commercial use. Review the provider's current terms and attribution requirements before production or commercial deployment.

The travel recommendation is intentionally a **short-range forecast comparison**, not a long-term climate or seasonal travel advisor. It scores forecast days using precipitation probability/amount, severe weather codes, wind and broad temperature comfort thresholds. It does not consider airfare, hotel prices, local events, air quality, safety, visa requirements or personal preferences. Forecasts are uncertain, especially further out.

The app requests 16 daily forecast dates: today plus 15 days. The hourly view shows up to 36 future hours. Destination comparison uses the first 7 forecast days (including today) and ranks cities using the same transparent heuristic score. The score is an indicative weather comparison, not a guarantee or a complete measure of trip suitability.

## Run locally

Requirements: Node.js 20.9+ recommended.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy with GitHub + Vercel

1. Create a new GitHub repository (for example `skyroute-weather`).
2. Extract this ZIP and upload/commit all project files to the repository root.
3. In Vercel, choose **Add New → Project**, import the GitHub repository, and keep the detected Next.js defaults.
4. Select **Deploy**. No environment variables are required for this starter.
5. Future pushes to your connected GitHub branch will trigger Vercel deployments.

## Project structure

```text
world-weather-app/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── public/
├── .gitignore
├── next-env.d.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Suggested production improvements

- Add a server-side API route and caching/rate limiting.
- Add automated tests for the weather scoring and date/time handling.
- Add long-range climate normals (separate data source) for seasonal travel advice.
- Add destination preferences (beach, hiking, city break) and configurable comfort thresholds.
- Add accessibility testing, monitoring and error analytics.
