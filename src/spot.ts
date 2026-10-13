// Spot price fetching for a fully static site (works on GitHub Pages, no proxy).
//
// Source: the fawazahmed0 "currency-api" served from the jsDelivr CDN. It is
// keyless, free, and -- crucially for a static page -- sends
// `Access-Control-Allow-Origin: *`, so the browser can call it directly with no
// server-side proxy. Metals are exposed as currency codes: `xau` (gold) and
// `xag` (silver). The value at `<metal>.eur` is the price of ONE unit (one troy
// ounce) of that metal in EUR -- exactly the number we want.
//
// It updates roughly daily, so prices are more delayed than a live spot feed;
// the always-editable spot field is the override for when you want the exact
// current price. A jsDelivr fallback host is tried if the primary 404s.

export interface SpotResult {
  eurPerOz: number;
  computedAt: string | null;
  stale: boolean;
}

const HOSTS = [
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies",
  "https://latest.currency-api.pages.dev/v1/currencies",
];

async function getMetalJson(metal: "xau" | "xag"): Promise<any> {
  let lastErr: unknown;
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}/${metal}.json`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}

function readEurPerOz(data: any, metal: "xau" | "xag"): SpotResult {
  const eurPerOz = Number(data?.[metal]?.eur);
  if (!eurPerOz || Number.isNaN(eurPerOz)) {
    throw new Error(`No ${metal} price in response`);
  }
  // The feed updates ~daily; flag it stale if the date is not today.
  const date: string | null = data?.date ?? null;
  const today = new Date().toISOString().slice(0, 10);
  return {
    eurPerOz,
    computedAt: date,
    stale: date != null && date !== today,
  };
}

export async function fetchGoldEurPerOz(): Promise<SpotResult> {
  return readEurPerOz(await getMetalJson("xau"), "xau");
}

export async function fetchSilverEurPerOz(): Promise<SpotResult> {
  return readEurPerOz(await getMetalJson("xag"), "xag");
}
