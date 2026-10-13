// Coin library.
//
// Two kinds of entries:
//
//  1. GENERIC bullion — defined only by metal + fine troy-ounce fraction
//     (1 oz, 1/2 oz, 1/4 oz, 1/10 oz, …). Covers Krugerrand / Maple / Eagle /
//     Philharmonic / Britannia / Buffalo / Libertad and every other modern
//     bullion coin, because for premium-vs-spot the only thing that matters is
//     the fine metal content. No gross weight / purity / country needed.
//
//  2. NAMED historic coins whose weight is odd and specific (Napoléon,
//     Sovereign, $20 Double Eagle, the Pesos series, 20 Marks, Ducats,
//     100 Corona). Here the exact coin IS the information, so we keep full
//     specs.
//
// Melt value = fineOz × spot(EUR/oz). We store fineOz authoritatively.
// troy oz = 31.1034768 g.

export type Metal = "gold" | "silver";

export interface Coin {
  id: string;
  name: string;
  metal: Metal;
  /** Fine metal content in troy ounces (what melt value is computed from). */
  fineOz: number;
  /** True for the generic metal+fraction entries. */
  generic?: boolean;
  /** Gross coin weight in grams (named coins only, display). */
  grossGrams?: number;
  /** Fineness, e.g. 0.9 for 90% (named coins only, display). */
  purity?: number;
  country?: string;
  note?: string;
}

const TROY_OZ_G = 31.1034768;

// Generic fractional sizes, shared by both metals.
const FRACTIONS: { label: string; oz: number; idSuffix: string }[] = [
  { label: "1 oz", oz: 1, idSuffix: "1oz" },
  { label: "1/2 oz", oz: 0.5, idSuffix: "half" },
  { label: "1/4 oz", oz: 0.25, idSuffix: "quarter" },
  { label: "1/10 oz", oz: 0.1, idSuffix: "tenth" },
  { label: "1/20 oz", oz: 0.05, idSuffix: "twentieth" },
];

function genericCoins(metal: Metal): Coin[] {
  const metalLabel = metal === "gold" ? "Gold" : "Silver";
  return FRACTIONS.map((f) => ({
    id: `generic-${metal}-${f.idSuffix}`,
    name: `${metalLabel} bullion — ${f.label}`,
    metal,
    fineOz: f.oz,
    generic: true,
    note: `Any ${f.label} ${metal} bullion coin (${f.oz} oz fine).`,
  }));
}

export const COINS: Coin[] = [
  // ——— Generic bullion (metal + fraction) ———
  ...genericCoins("gold"),
  ...genericCoins("silver"),

  // ——— Named historic / odd-weight gold coins ———
  {
    id: "napoleon-20fr",
    name: "20 Francs Napoléon",
    metal: "gold",
    fineOz: 5.805 / TROY_OZ_G,
    grossGrams: 6.4516,
    purity: 0.9,
    country: "France",
    note: "6.4516 g gross × 0.900 = 5.805 g fine.",
  },
  {
    id: "napoleon-10fr",
    name: "10 Francs Napoléon",
    metal: "gold",
    fineOz: 2.9025 / TROY_OZ_G,
    grossGrams: 3.2258,
    purity: 0.9,
    country: "France",
  },
  {
    id: "sovereign",
    name: "Gold Sovereign",
    metal: "gold",
    fineOz: 7.322381 / TROY_OZ_G,
    grossGrams: 7.98805,
    purity: 0.9167,
    country: "UK",
    note: "22k, 7.3224 g fine gold.",
  },
  {
    id: "half-sovereign",
    name: "Half Sovereign",
    metal: "gold",
    fineOz: 3.66119 / TROY_OZ_G,
    grossGrams: 3.99402,
    purity: 0.9167,
    country: "UK",
  },
  {
    id: "20-dollar-double-eagle",
    name: "$20 Double Eagle",
    metal: "gold",
    fineOz: 0.9675,
    grossGrams: 33.436,
    purity: 0.9,
    country: "USA",
    note: "0.9675 oz fine (pre-1933 Liberty/Saint-Gaudens).",
  },
  {
    id: "10-dollar-eagle",
    name: "$10 Eagle",
    metal: "gold",
    fineOz: 0.48375,
    grossGrams: 16.718,
    purity: 0.9,
    country: "USA",
  },
  {
    id: "dos-pesos",
    name: "Dos Pesos (2 Pesos)",
    metal: "gold",
    fineOz: 1.50463 / TROY_OZ_G,
    grossGrams: 1.66666,
    purity: 0.9,
    country: "Mexico",
    note: "1.5046 g fine.",
  },
  {
    id: "cinco-pesos",
    name: "Cinco Pesos (5 Pesos)",
    metal: "gold",
    fineOz: 3.75 / TROY_OZ_G,
    grossGrams: 4.16666,
    purity: 0.9,
    country: "Mexico",
  },
  {
    id: "diez-pesos",
    name: "Diez Pesos (10 Pesos)",
    metal: "gold",
    fineOz: 7.5 / TROY_OZ_G,
    grossGrams: 8.33333,
    purity: 0.9,
    country: "Mexico",
  },
  {
    id: "centenario-50pesos",
    name: "Centenario (50 Pesos)",
    metal: "gold",
    fineOz: 37.5 / TROY_OZ_G,
    grossGrams: 41.66666,
    purity: 0.9,
    country: "Mexico",
    note: "1.2057 oz fine gold.",
  },
  {
    id: "20-marks",
    name: "20 Marks (German Empire)",
    metal: "gold",
    fineOz: 7.16845 / TROY_OZ_G,
    grossGrams: 7.965,
    purity: 0.9,
    country: "Germany",
  },
  {
    id: "ducat-1",
    name: "1 Ducat (Austria)",
    metal: "gold",
    fineOz: 3.4909 / TROY_OZ_G,
    grossGrams: 3.4909,
    purity: 0.986,
    country: "Austria",
    note: "3.4909 g gross, ~3.442 g fine (0.986).",
  },
  {
    id: "ducat-4",
    name: "4 Ducat (Austria)",
    metal: "gold",
    fineOz: 13.7566 / TROY_OZ_G,
    grossGrams: 13.9636,
    purity: 0.986,
    country: "Austria",
  },
  {
    id: "100-corona",
    name: "100 Corona (Austria)",
    metal: "gold",
    fineOz: 30.4878 / TROY_OZ_G,
    grossGrams: 33.875,
    purity: 0.9,
    country: "Austria",
    note: "0.98 oz fine.",
  },
];

export function coinById(id: string): Coin | undefined {
  return COINS.find((c) => c.id === id);
}
