import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSpots, fetchUsdToEur } from "./spot";

const NOW = new Date("2026-10-30T15:47:30Z");
const iso = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString();

type Route = (url: string) => unknown | Error;

/** Stub fetch: `route` returns a JSON body, or an Error to simulate failure. */
function stubFetch(route: Route) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      const out = route(url);
      if (out instanceof Error) throw out;
      return { ok: true, status: 200, json: async () => out };
    }),
  );
  return calls;
}

const goldApi = (price: number, updatedAt = iso(5_000)) => ({ price, updatedAt });
const frankfurter = (eur: number) => ({ rates: { EUR: eur } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchSpots", () => {
  it("converts USD spot to EUR with the ECB rate (values seen 2026-10-30)", async () => {
    stubFetch((u) => {
      if (u.includes("gold-api.com/price/XAU")) return goldApi(3899);
      if (u.includes("gold-api.com/price/XAG")) return goldApi(49.293999);
      if (u.includes("frankfurter")) return frankfurter(0.89509);
      return new Error("unexpected " + u);
    });
    const { gold, silver } = fetchSpots();
    const g = await gold;
    const s = await silver;
    // Dealer banner and Swissquote both read ~3 493 € / 44.08 € at that time.
    expect(g.eurPerOz).toBeCloseTo(3489.9, 0);
    expect(s.eurPerOz).toBeCloseTo(44.12, 1);
    expect(g.stale).toBe(false);
    expect(g.computedAt).toBe(iso(5_000));
  });

  it("looks the FX rate up once for both metals", async () => {
    const calls = stubFetch((u) =>
      u.includes("gold-api") ? goldApi(1000) : frankfurter(0.9),
    );
    const { gold, silver } = fetchSpots();
    await Promise.all([gold, silver]);
    expect(calls.filter((u) => u.includes("frankfurter"))).toHaveLength(1);
  });

  it("flags a quote older than 2 hours as stale", async () => {
    stubFetch((u) =>
      u.includes("gold-api") ? goldApi(3899, iso(3 * 3600_000)) : frankfurter(0.9),
    );
    const { gold, silver } = fetchSpots();
    await silver; // settle both so nothing is left unobserved
    expect((await gold).stale).toBe(true);
  });

  it("one metal failing does not blank the other", async () => {
    stubFetch((u) => {
      if (u.includes("price/XAG")) return new Error("down");
      return u.includes("gold-api") ? goldApi(3899) : frankfurter(0.9);
    });
    const { gold, silver } = fetchSpots();
    const [g, s] = await Promise.allSettled([gold, silver]);
    expect(s.status).toBe("rejected");
    expect(g.status).toBe("fulfilled");
    expect((g as PromiseFulfilledResult<{ eurPerOz: number }>).value.eurPerOz).toBeCloseTo(3509.1, 1);
  });

  it("rejects instead of inventing a price when gold-api is down", async () => {
    stubFetch((u) => (u.includes("gold-api") ? new Error("down") : frankfurter(0.9)));
    const { gold, silver } = fetchSpots();
    const [g, s] = await Promise.allSettled([gold, silver]);
    expect(g.status).toBe("rejected");
    expect(s.status).toBe("rejected");
  });

  it("rejects a response with no usable price", async () => {
    stubFetch((u) => (u.includes("gold-api") ? { price: 0 } : frankfurter(0.9)));
    const { gold, silver } = fetchSpots();
    const [g] = await Promise.allSettled([gold, silver]);
    expect(g.status).toBe("rejected");
    expect((g as PromiseRejectedResult).reason.message).toMatch(/No XAU price/);
  });
});

describe("fetchUsdToEur", () => {
  it("falls back to the next source when Frankfurter is down", async () => {
    stubFetch((u) => {
      if (u.includes("frankfurter")) return new Error("down");
      if (u.includes("open.er-api")) return { rates: { EUR: 0.8959 } };
      return new Error("unexpected " + u);
    });
    expect(await fetchUsdToEur()).toBe(0.8959);
  });

  it("skips a source that returns an implausible rate", async () => {
    stubFetch((u) => {
      if (u.includes("frankfurter")) return frankfurter(89.5); // wrong unit
      if (u.includes("open.er-api")) return { rates: {} };
      return { usd: { eur: 0.894 } }; // jsDelivr / fawazahmed0 shape
    });
    expect(await fetchUsdToEur()).toBe(0.894);
  });

  it("throws when every source fails", async () => {
    stubFetch(() => new Error("down"));
    await expect(fetchUsdToEur()).rejects.toThrow();
  });
});
