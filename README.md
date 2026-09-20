# Atmos — Live Weather Forecasting Dashboard

A real-time weather dashboard built for students to practice **API handling** and **data visualization**.

No API key required — uses free [Open-Meteo](https://open-meteo.com) APIs.

## Features
- **Search any city** (geocoding API) + **use my location** (browser geolocation)
- **Current weather**: temperature, feels-like, condition, day/night badge
- **Key metrics**: humidity (with bar), wind speed + direction (compass arrow), pressure, cloud cover, precipitation, sunrise/sunset
- **24-hour forecast chart** (Chart.js) — temperature + precipitation probability (dual axis)
- **Hourly details** scroll strip + **7-day forecast** with temp range bars
- **Alert notifications** — auto-generated from thresholds (high wind, heat/freeze, heavy rain, humidity)
- **Unit toggle** °C / °F (persisted)
- **Live indicator** + **auto-refresh every 5 minutes** with countdown
- **API panel** for learning — shows exact endpoints being called (inspect Network tab)

## APIs Used (no key)
```
Geocoding:  https://geocoding-api.open-meteo.com/v1/search?name={city}&count=5
Reverse:    https://geocoding-api.open-meteo.com/v1/reverse?latitude={lat}&longitude={lon}
Forecast:   https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,precipitation,cloud_cover,is_day&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,wind_speed_10m_max&timezone=auto
```

## Run
```bash
# from this folder
python3 -m http.server 8090
# then open http://localhost:8090
```
Or just open `index.html` directly (CORS works for Open-Meteo).

## For Students — What to Inspect
1. Open DevTools → Network → filter "open-meteo" to see API requests.
2. Check `app.js: geocodeSearch()` and `fetchWeather()` for `fetch()` + error handling.
3. Chart is rendered in `renderHourly()` with Chart.js dual-axis line chart.
4. Try breaking the API URL or going offline to see error handling.

## Stack
- Vanilla HTML/CSS/JS (no build)
- Chart.js 4 via CDN
- Open-Meteo (WMO weather codes mapped to emojis)
