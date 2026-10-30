// Spot price fetching for a fully static site (works on GitHub Pages, no proxy).
//
// Metal price (USD per troy ounce): gold-api.com. Keyless, free, sends
// `Access-Control-Allow-Origin: *`, and returns a real-time spot with an
// `updatedAt` timestamp. Checked on 2026-10-30 against the dealer's own price
// banner and Swissquote's live bank quote: converted to EUR it agreed within
// ~0.1% for both gold and silver.
//
// USD → EUR: Frankfurter (ECB reference rate), with two fallbacks that carry
// the same number to within ~0.1%.
//
// There is deliberately NO fallback for the metal price itself. The previous
// source (a daily currency-rate dataset) was off by 2–4% (≈ €80–130/oz gold),
// and a wrong pre-filled price is worse than an empty field you type into.

export interface SpotResult {
  eurPerOz: number;
  /** ISO timestamp of the quote, when the source provides one. */
  computedAt: string | null;
  /** True when the quote is older than STALE_AFTER_MS (e.g. market closed). */
  stale: boolean;
}

const METAL_URL = "https://api.gold-api.com/price";
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

/** Each source returns EUR per 1 USD. First one that answers sanely wins. */
const FX_SOURCES: { url: string; read: (d: any) => unknown }[] = [
  {
    url: "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR",
    read: (d) => d?.rates?.EUR,
  },
  {
    url: "https://open.er-api.com/v6/latest/USD",
    read: (d) => d?.rates?.EUR,
  },
  {
    url: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json",
    read: (d) => d?.usd?.eur,
  },
];

export async function fetchUsdToEur(): Promise<number> {
  let lastErr: unknown;
  for (const src of FX_SOURCES) {
    try {
      const rate = Number(src.read(await getJson(src.url)));
      // EUR/USD has lived well inside this band for decades; anything outside
      // is a malformed response, not a market move.
      if (rate > 0.5 && rate < 1.5) return rate;
      throw new Error(`implausible USD→EUR rate ${rate}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("FX fetch failed");
}

async function fetchMetalEurPerOz(
  symbol: "XAU" | "XAG",
  fx: Promise<number>,
): Promise<SpotResult> {
  const [data, usdToEur] = await Promise.all([
    getJson(`${METAL_URL}/${symbol}`),
    fx,
  ]);
  const usd = Number(data?.price);
  if (!(usd > 0)) throw new Error(`No ${symbol} price in response`);
  const updatedAt: string | null =
    typeof data?.updatedAt === "string" ? data.updatedAt : null;
  const age = updatedAt ? Date.now() - Date.parse(updatedAt) : NaN;
  return {
    eurPerOz: usd * usdToEur,
    computedAt: updatedAt,
    stale: Number.isFinite(age) && age > STALE_AFTER_MS,
  };
}

/**
 * Fetch gold and silver together so they share one FX lookup. Each metal
 * settles independently: one failing never blanks the other.
 */
export function fetchSpots(): {
  gold: Promise<SpotResult>;
  silver: Promise<SpotResult>;
} {
  const fx = fetchUsdToEur();
  fx.catch(() => undefined); // surfaced through each metal's own promise
  return {
    gold: fetchMetalEurPerOz("XAU", fx),
    silver: fetchMetalEurPerOz("XAG", fx),
  };
}
