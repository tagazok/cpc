import { describe, expect, it } from "vitest";
import fixtures from "./__fixtures__/aoa.json";
import {
  TROY_OZ_G,
  bookmarkletHref,
  matchLibraryCoin,
  parseDecimal,
  parseSpecText,
  readImportFromUrl,
} from "./importer";

// Real product pages captured from acheter-or-argent.fr (2026-10-30).
const fx = (slug: string) => {
  const f = fixtures.find((x) => x.slug === slug);
  if (!f) throw new Error(`missing fixture ${slug}`);
  return f;
};
/** Build the query string the bookmarklet would send for a fixture. */
const bmQuery = (slug: string) => {
  const f = fx(slug);
  return "?" + new URLSearchParams({ t: f.text, p: f.price, n: f.title, u: `https://www.acheter-or-argent.fr/index2.php/produit/${slug}/` });
};

describe("parseDecimal", () => {
  it.each([
    ["953,04 €", 953.04],
    ["4436,22\u00a0€", 4436.22],
    ["3.900,50", 3900.5],
    ["3,900.50", 3900.5],
    ["3 900,50", 3900.5],
    ["999,9", 999.9],
    ["", NaN],
  ])("%s → %s", (raw, want) => {
    expect(parseDecimal(raw)).toEqual(want);
  });
});

describe("parseSpecText on real pages", () => {
  it.each([
    // slug, metal, gross g, fine g, permille
    ["1-4-oz-panthere-seymour-tudor-beasts-2026-or", "gold", 7.78, 7.78, 999.9],
    ["demi-souverain-or-2027-charles-iii", "gold", 3.99, 3.66, 916.7],
    ["5-oz-grand-maple-leaf-2026", "silver", 155.53, 155.53, 999.9],
    ["1-souverain-1911-c-george-v-or-1843", "gold", 7.98, 7.98 * 0.9167, 916.7],
    ["50-pesos-1946-mo-centenario-or", "gold", 41.77, 41.77 * 0.9, 900],
    ["10-pesos-or-simon-bolivar-bogota-1919-1315", "gold", 16.07, 16.07 * 0.916, 916],
    ["5-francs-1855-bb-napoleon-iii-tete-nue-argent-1950", "silver", 24.8, 24.8 * 0.9, 900],
    ["x25-maple-gram-or-9999-1000-2026", "gold", 25, 25, 999.9],
  ])("%s", (slug, metal, gross, fine, permille) => {
    const p = parseSpecText(fx(slug).text);
    expect(p.metal).toBe(metal);
    expect(p.grossGrams).toBeCloseTo(gross, 3);
    expect(p.fineGrams).toBeCloseTo(fine, 3);
    expect(p.permille).toBeCloseTo(permille, 3);
  });

  it("handles fields glued together without separators", () => {
    const p = parseSpecText("Métal : OrPoids : 16,07 GrTitre : 916 ‰Diamètre : 26 mm");
    expect(p).toMatchObject({ metal: "gold", grossGrams: 16.07, permille: 916 });
  });

  it("handles kilo bars and percent purity", () => {
    const p = parseSpecText("Métal : argent Poids : 1 kg Titre : 99,9 %");
    expect(p.grossGrams).toBe(1000);
    expect(p.permille).toBeCloseTo(999);
  });

  it("returns nothing for text with no specs", () => {
    expect(parseSpecText("Hello world")).toEqual({ fineGrams: undefined, grossGrams: undefined });
  });
});

describe("readImportFromUrl + matchLibraryCoin", () => {
  it("returns null without import params", () => {
    expect(readImportFromUrl("")).toBeNull();
    expect(readImportFromUrl("?utm_source=x")).toBeNull();
  });

  it("1/4 oz Panthère → generic gold 1/4 oz, price + clean name", () => {
    const imp = readImportFromUrl(bmQuery("1-4-oz-panthere-seymour-tudor-beasts-2026-or"))!;
    expect(imp.name).toBe("1/4 oz panthère seymour tudor beasts 2026 or");
    expect(imp.priceEur).toBe(953.37);
    expect(imp.sourceUrl).toContain("acheter-or-argent.fr");
    expect(matchLibraryCoin(imp)?.id).toBe("generic-gold-quarter");
  });

  it("1911 Sovereign → named Sovereign, '#1843' stripped from name", () => {
    const imp = readImportFromUrl(bmQuery("1-souverain-1911-c-george-v-or-1843"))!;
    expect(imp.name).toBe("Souverain 1911 C george V or");
    expect(matchLibraryCoin(imp)?.name).toBe("Gold Sovereign");
  });

  it("Centenario → named 50 Pesos", () => {
    const imp = readImportFromUrl(bmQuery("50-pesos-1946-mo-centenario-or"))!;
    expect(matchLibraryCoin(imp)?.name).toMatch(/Centenario|50 Pesos/);
  });

  it("5 oz silver Maple → no library match (custom)", () => {
    const imp = readImportFromUrl(bmQuery("5-oz-grand-maple-leaf-2026"))!;
    expect(imp.metal).toBe("silver");
    expect(matchLibraryCoin(imp)).toBeUndefined();
  });

  it("silver never matches a gold coin of the same weight", () => {
    const imp = readImportFromUrl(`?metal=silver&fine=${TROY_OZ_G}`)!;
    expect(matchLibraryCoin(imp)?.id).toBe("generic-silver-1oz");
  });

  it("explicit params build a prefill link and win over parsed text", () => {
    const imp = readImportFromUrl("?metal=gold&gross=6,4516&purity=900&price=520,50&name=Napo&t=M%C3%A9tal%20%3A%20argent")!;
    expect(imp).toMatchObject({ metal: "gold", grossGrams: 6.4516, permille: 900, priceEur: 520.5, name: "Napo" });
    expect(imp.fineGrams).toBeCloseTo(5.80644, 4);
    expect(matchLibraryCoin(imp)?.id).toBe("napoleon-20fr");
  });
});

describe("bookmarkletHref", () => {
  it("is a javascript: URL embedding the app URL and is valid JS", () => {
    const href = bookmarkletHref("https://tagazok.github.io/cpc/");
    expect(href.startsWith("javascript:")).toBe(true);
    const src = decodeURIComponent(href.slice("javascript:".length));
    expect(src).toContain('"https://tagazok.github.io/cpc/"');
    // Parses as JavaScript (throws SyntaxError otherwise).
    expect(() => new Function(src)).not.toThrow();
  });
});
