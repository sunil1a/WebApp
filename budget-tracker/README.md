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

Everything is saved in your browser's `localStorage` on **this device only**. Nothing
is sent anywhere.

Because it's tied to one browser, use **Export** now and then to download a JSON backup,
and **Import** to restore it (on the same or another machine).
