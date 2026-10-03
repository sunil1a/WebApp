# Calorie Tracker

A simple, mobile-friendly calorie tracker for Indian food. No build step, no server — open it in a browser.

## Features

- **Log by typing or speaking** — e.g. *"2 roti, 1 katori dal, half bowl rice and a cup of chai"*.
  Understands quantities (`2`, `half`, `1.5`, `ek`, `do`, `aadha`, `dedh`), units
  (`katori`, `bowl`, `plate`, `cup`, `glass`, `piece`, `tbsp`, `100g`) and sizes (`small`, `large`).
- **Built-in Indian food list** (~150 dishes: rotis, rice, dals, sabzis, South Indian, snacks, sweets, drinks, fruits)
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

## Install on your Android phone

Android only installs apps served over **HTTPS**, so the folder needs to be hosted first (free).
Pick one:

**Option A — Netlify Drop (no setup, ~1 minute)**
1. On a computer, go to <https://app.netlify.com/drop> (sign up free so the site stays online).
2. Drag the `calorie-tracker` folder (or the unzipped `calorie-tracker.zip`) onto the page.
3. You get a link like `https://something.netlify.app` — open it on your phone.

**Option B — GitHub Pages (auto-updates on every change)**
1. GitHub Pages is free for public repos; private repos need a paid plan.
2. In the repo go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Merge this branch into `master` (or run the *Deploy Calorie Tracker to GitHub Pages* workflow
   from the **Actions** tab). The site appears at `https://<user>.github.io/<repo>/`.

**Then, on the phone (Chrome):**
1. Open the link. Tap the green **Install app** button at the top
   (or Chrome menu ⋮ → **Add to Home screen** → **Install**).
2. The Calories icon appears on your home screen and app drawer. It opens full-screen without the
   browser bar and works offline (AI photo/estimates need internet).
3. Long-press the icon for shortcuts: **Log**, **Photo**, **Dashboard**.

Allow microphone and camera access the first time you use Speak / Photo.
Your logs are stored on the phone itself — uninstalling the app or clearing Chrome's site data erases them,
so use **Settings → Export CSV** for a backup.

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
| `sw.js`, `manifest.json`, `icons/`, `screenshots/` | Offline support / install to home screen |

Speech recognition works in Chrome, Edge and Safari; Firefox doesn't support it (typing still works).
