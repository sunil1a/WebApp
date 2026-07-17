# Budget Tracker

A simple, self-contained personal budget tracker. Records your spending and income
organised by category (Food, Travel, Salary given, Online shopping, Groceries — plus
any custom categories you add).

## How to use

Just open `index.html` in any web browser. No server, no database, no install.

- **Add a transaction** — pick Expense or Income, enter an amount, date, category and
  an optional note.
- **Categories** — the five defaults are ready to go; add your own (rent, medical, etc.)
  from the "Add a custom category" box.
- **Spending by category** — a ranked bar chart shows where your money goes, with each
  category's share of the total.
- **Filter** — narrow the view by month and/or category. The summary tiles and chart
  update to match.
- **Currency** — switch between ₹, $, €, £, ¥ in the top-right.
- **Light / dark** — toggle with the 🌓 button.

## Where the data lives

By default everything is saved in your browser's `localStorage` on **this device only** —
no account, nothing sent anywhere. Use **Export** to download a JSON backup and **Import**
to restore it.

To use the tracker across multiple devices, turn on **Cloud sync** (see below).

## Cloud sync (optional)

Cloud sync backs your data up to **your own** Supabase project and keeps every device in
sync. Your data stays in your account — the app just talks to it. It keeps working offline
and pushes queued changes automatically when you reconnect.

### One-time setup (~2 minutes)

1. Create a free project at **[supabase.com](https://supabase.com)**.
2. In **Project Settings → API**, copy your **Project URL** and the **anon public** key.
3. In the app, click **Cloud** (top-right) → paste both into the connection fields → **Save
   connection**.
4. Open the setup panel in that same dialog, copy the **SQL snippet**, and run it once in
   the Supabase **SQL Editor**. It creates two tables (`transactions`, `settings`) with
   row-level security so only you can read your data.
5. (Recommended) In **Authentication → Providers → Email**, turn **off** "Confirm email"
   so you can sign in right away.
6. Back in the app, **Create account** / **Sign in** with an email + password.

That's it. From then on, on any device: open the app, enter the same Project URL + anon key,
sign in with the same account, and your data appears.

### How sync works

- Every add/delete/category change saves locally first, then syncs in the background.
- Conflicts between devices are resolved **last-write-wins** by timestamp.
- Deletes are soft-deletes so they propagate to your other devices.
- The cloud status chip (top-right) shows **Synced / Syncing / Offline / Sign in**.

### Notes on security

- The **anon key** is safe to store in the browser — row-level security is what protects
  your data, and it only ever exposes rows belonging to the signed-in user.
- Exported backup files contain your transactions only — never your keys or login session.
