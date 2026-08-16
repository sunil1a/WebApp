# Day Ledger — daily activity & productivity tracker

A clean, single-file web app for logging what you do each day and seeing whether
your productivity is trending up or down over time. No install, no server, no
account — just open the file. All your data stays in your browser (localStorage).

## How to use it

Open `index.html` in any modern browser (double-click it, or host it anywhere).

### Logging activities
- Pick a **category** (Learning, Reading, Course, Family/Home, Household,
  Exercise, Deep work, Rest, or Time sink).
- Type what you did, add the **minutes** you spent, and — for reading — the
  **pages** you read.
- Mark whether it was a **Boost**, **Neutral**, or **Drain** on your day.
- Log throughout the day, or write it all down once at night.

### Nighttime note
End the day with a short reflection and a mood rating. It's saved per day.

### Momentum score
Each day gets a **momentum** number: productive time adds points, time-sinks
subtract, and reading earns a small bonus per page. The Today view compares
today against your 7-day average, and shows your logging **streak**.

### Trends & Report
- A 14-day chart of daily momentum (green = productive day, red = down day).
- Plain-language **insights**: week-over-week change, streaks, where your time
  went, pages read, time lost to distractions, and your best recent day.
- A 7-day breakdown of time per category.

### Reminders
Turn on **gentle nudges** to be prompted every few hours (and an evening
check-in) to log your activities while the tab is open. Uses browser
notifications when you allow them, otherwise an in-app message.

### Your data
Everything is stored locally in your browser. Use **Export backup** to save a
JSON file and **Import backup** to restore it (e.g. on another device).

## Adding your own categories
Categories live in the `CATS` array near the top of the `<script>` block in
`index.html`. Each entry has an `id`, `name`, `color`, default `impact`
(`boost` / `neutral` / `drain`), and whether it tracks `pages`.
