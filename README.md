# bahtransporters.com

The BAH Transporters website — air freight between the UK and The Gambia. Static pages served by Vercel; the
booking page, tracking and invoices talk to the BAH Supabase backend (see the `bah.admin` repo).

| Page | What it does |
|---|---|
| `/` | Home: live price and next flight, instant price calculator, how it works, offices, FAQ |
| `/book` | Booking in 4 steps (route & flight → what you send → your details → receiver), plus the Flights tab |
| `/track` | Track by BAH- reference, INV- invoice number, or customer number + phone |
| `/invoice?k=…` | The customer's invoice (link sent from the admin app), prints as A4 PDF |
| `/about`, `/contact`, `/terms`, `/privacy` | Company pages |

## Editing

Edit the files in `src/` and `assets/`, then build:

```bash
node build.mjs
```

`build.mjs` puts the shared head, header and footer (`src/partials/`) around each page in `src/pages/` and
compiles `assets/site.css` with Tailwind (it uses the copy installed in the admin app folder next to this one).
Preview with `node serve.mjs` → http://localhost:3000.

Prices, flight dates and the booking rules come live from the admin app (Settings → Routes & prices,
Flights, Settings → Invoices) — no website change is needed for them.

Photos: `images/` (Unsplash licence, list in `images/CREDITS.md`).
