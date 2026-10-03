# Calorie Tracker

A simple, mobile-friendly calorie tracker for Indian food. No build step, no server — open it in a browser.

## Features

- **Log by typing or speaking** — e.g. *"2 roti, 1 katori dal, half bowl rice and a cup of chai"*.
  Understands quantities (`2`, `half`, `1.5`, `ek`, `do`, `aadha`, `dedh`), units
  (`katori`, `bowl`, `plate`, `cup`, `glass`, `piece`, `tbsp`, `100g`) and sizes (`small`, `large`).
- **Built-in Indian food list** (~170 dishes: rotis, rice, dals, sabzis, South Indian, snacks, sweets, drinks, fruits)
  with typical home-style calories.
- **Photo logging** — snap your plate and the AI identifies the dishes and estimates calories (needs an API key).
- **AI fallback** — dishes not in the built-in list are estimated by AI when a key is set; otherwise you type the calories.
- **Review before saving** — adjust quantity or calories for any item.
- **Dashboard** — today's total vs. goal, breakdown by meal, last-7-days chart, and history by day.
- Data stays on your device (browser storage). Export to CSV from Settings.

## Run it

Voice input, camera and the service worker need the page served over `http://localhost` or HTTPS:

```bash
cd calorie-tracker
python3 -m http.server 8000
# open http://localhost:8000
```

To use it on your phone, host the folder on any static host (GitHub Pages, Netlify, etc.) and
use "Add to Home Screen" — it installs like an app.

## AI features (optional)

Photo logging and estimates for unknown dishes use Claude. Add your
[Anthropic API key](https://console.anthropic.com/) in **Settings**. The key is stored only in your
browser and sent directly to Anthropic. Since it sits in the browser, use this for personal use only;
for a shared/public deployment, move the API call behind your own small backend.

## Files

| File | Purpose |
|---|---|
| `index.html`, `styles.css` | Layout and theme (light/dark) |
| `app.js` | UI, storage, dashboard, voice and photo handling |
| `parser.js` | Turns free text into food items and calories |
| `foods.js` | Indian food calorie table — edit to add dishes or tweak values |
| `ai.js` | Claude calls for photos and unknown dishes |
| `sw.js`, `manifest.json`, `icon.svg` | Offline support / install to home screen |

Speech recognition works in Chrome, Edge and Safari; Firefox doesn't support it (typing still works).
