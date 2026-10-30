# Coin Premium

A **static, private** tool to check how much a bullion coin's dealer price is
above (or below) its melt / spot value — in **euros** and **percent over spot**.
Live at **https://tagazok.github.io/cpc/**.

- Live **gold & silver** spot from [gold-api.com](https://gold-api.com) (real-time,
  USD) converted to EUR at the ECB rate from
  [Frankfurter](https://frankfurter.dev) — no API key, no server, both CORS-enabled
  so the browser calls them directly and it works as a plain static site (GitHub
  Pages). Checked against a dealer's price banner and a bank quote: within ~0.1%.
- The spot fields are **pre-filled from the feed but fully editable** — overwrite
  either one with the exact price from your own source (Kitco, your dealer, etc.).
- A library of well-known coins plus **generic bullion by fraction** (1 oz, ½, ¼,
  1/10, 1/20) and a **custom-coin** entry (weight + purity) so an unlisted coin is
  never a dead end. Each carries its **fine metal content** so melt value is exact.
- A **filterable combobox** for the coin picker — type to filter or arrow-key/click.
- Price fields accept **both `.` and `,`** as the decimal separator.
- **History in `localStorage`** (all local, nothing leaves your browser). Each
  saved check stores the premium *at that moment* ("Then") and re-evaluates the
  same coin & dealer price against the **current** spot every time you reload
  ("Now").

## Run locally

```bash
npm install
npm run dev        # http://localhost:5174/cpc/
```

Production-style preview of the built static site:

```bash
npm run build
npm run preview    # http://localhost:4175/cpc/
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the Vite
app and publishes `dist/` to GitHub Pages at `/cpc/`. No secrets or external
proxy are needed — the app is fully static.

## How the math works

- Spot is quoted in **EUR per troy ounce** of pure metal.
- `melt = coin.fineOz × spot`
- `premium € = dealerPrice − melt`
- `premium % = premium € / melt × 100`

`fineOz` is the coin's **fine** (pure) metal content, not its gross weight — e.g.
a Krugerrand is 33.93 g gross but exactly **1 oz fine** gold (the rest is copper).
For a custom coin, `fineOz = weight(g) × purity(‰)/1000 ÷ 31.1034768`.

## Notes

- The "as of HH:MM" label shows the quote time. It is marked "stale" when the quote
  is over 2 hours old (e.g. weekends, markets closed). If the feed is down the
  field stays empty for you to type — there is deliberately no lower-quality
  fallback price.
- Not investment advice.
