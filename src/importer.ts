// Import a coin from a dealer product page (acheter-or-argent.fr).
//
// The dealer site sends no CORS headers, so this static app can't fetch its
// pages. Instead a bookmarklet runs ON the product page, grabs the raw spec
// text + price + title, and opens this app with them in the query string.
// All parsing happens here (not in the bookmarklet), so a layout change on the
// dealer site only needs an app update — never a bookmark reinstall.
//
// Query params understood by the app:
//   Raw (sent by the bookmarklet): t = spec text, p = price text,
//                                   n = page title, u = page URL
//   Explicit (hand-written links):  metal=gold|silver, gross=<g>, fine=<g>,
//                                   purity=<‰>, price=<€>, name=<text>
// Explicit params win over values parsed from the raw text.

import { COINS, type Coin, type Metal } from "./coins";

export const TROY_OZ_G = 31.1034768;

export interface ImportedCoin {
  name: string;
  metal?: Metal;
  /** Gross weight in grams (whole lot, multiplied out for "25 x 1 g"). */
  grossGrams?: number;
  /** Fine metal in grams (whole lot). */
  fineGrams?: number;
  /** Purity in per mille (999.9, 916.7, 900…). */
  permille?: number;
  priceEur?: number;
  sourceUrl?: string;
}

/** Parse "1 234,56", "1.234,56", "1,234.56", "953,04 €" → number (NaN if none). */
export function parseDecimal(raw: string | null | undefined): number {
  if (!raw) return NaN;
  let s = String(raw).replace(/[\s\u00a0\u202f€]/g, "");
  s = s.replace(/[^\d.,-]/g, "");
  if (!s) return NaN;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  const decimalAt = Math.max(lastDot, lastComma);
  if (decimalAt === -1) return Number(s);
  const intPart = s.slice(0, decimalAt).replace(/[.,]/g, "");
  return Number(`${intPart}.${s.slice(decimalAt + 1)}`);
}

// A number possibly with a "25 x " lot multiplier in front.
const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const LOT = String.raw`(?:(\d+)\s*[x×]\s*)?`;

function grams(text: string, label: RegExp): number | undefined {
  // Unit may be glued to the next field ("16,07 GrTitre"), so no boundary.
  const re = new RegExp(label.source + String.raw`\s*:\s*` + LOT + NUM + String.raw`\s*(k?)g`, "i");
  const m = text.match(re);
  if (!m) return undefined;
  const qty = m[1] ? Number(m[1]) : 1;
  const g = parseDecimal(m[2]) * (m[3] ? 1000 : 1); // "1 kg" bars
  return Number.isFinite(g) && g > 0 ? g * qty : undefined;
}

/** Parse the dealer's spec text into structured coin data. */
export function parseSpecText(text: string): Omit<ImportedCoin, "name" | "priceEur" | "sourceUrl"> {
  const out: Omit<ImportedCoin, "name" | "priceEur" | "sourceUrl"> = {};

  // Metal: "Métal : or" / "Composition : Argent" (may be glued to the next
  // field, e.g. "Métal : OrPoids : …", so no trailing word boundary).
  const mm = text.match(/(?:M[ée]tal|Composition)\s*:\s*(argent|or)/i);
  if (mm) out.metal = mm[1].toLowerCase() === "or" ? "gold" : "silver";

  // Purity: "Titre : 999,9/1000", "Titrage : 916,7 ‰", "Titre : 90 %".
  const pm = text.match(new RegExp(String.raw`Titr(?:e|age)\s*:\s*` + NUM + String.raw`\s*(\/\s*1000|‰|%)?`, "i"));
  if (pm) {
    let v = parseDecimal(pm[1]);
    if (pm[2] === "%") v *= 10;
    else if (v <= 1) v *= 1000; // "0,900"
    if (v > 0 && v <= 1000) out.permille = v;
  }

  out.fineGrams = grams(text, /Poids\s+fin/);
  out.grossGrams = grams(text, /Poids\s+brut/) ?? grams(text, /Poids(?!\s+fin)/);

  // Missing purity but both weights given → derive it.
  if (!out.permille && out.fineGrams && out.grossGrams)
    out.permille = (out.fineGrams / out.grossGrams) * 1000;
  // Missing fine weight → derive from gross × purity.
  if (!out.fineGrams && out.grossGrams && out.permille)
    out.fineGrams = out.grossGrams * (out.permille / 1000);

  return out;
}

/** Guess the metal from a product title ("… 2026 or", "… argent #1950"). */
function metalFromTitle(title: string): Metal | undefined {
  if (/\bargent\b/i.test(title)) return "silver";
  if (/\bor\b/i.test(title)) return "gold";
  return undefined;
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-–|]\s*acheter-or-argent\.fr\s*$/i, "")
    .replace(/\s*#\d+\s*$/, "")
    .trim();
}

/** Read an import request from the page's query string, or null if none. */
export function readImportFromUrl(search: string): ImportedCoin | null {
  const q = new URLSearchParams(search);
  const keys = ["t", "p", "n", "u", "metal", "gross", "fine", "purity", "price", "name"];
  if (!keys.some((k) => q.has(k))) return null;

  const title = q.get("n") ?? "";
  const parsed = parseSpecText(q.get("t") ?? "");
  const num = (k: string) => {
    const v = parseDecimal(q.get(k));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };

  const metalParam = q.get("metal")?.toLowerCase();
  const metal: Metal | undefined =
    metalParam === "gold" || metalParam === "or"
      ? "gold"
      : metalParam === "silver" || metalParam === "argent"
        ? "silver"
        : parsed.metal ?? metalFromTitle(title);

  const result: ImportedCoin = {
    name: q.get("name")?.trim() || cleanTitle(title) || "Imported coin",
    metal,
    grossGrams: num("gross") ?? parsed.grossGrams,
    fineGrams: num("fine") ?? parsed.fineGrams,
    permille: num("purity") ?? parsed.permille,
    priceEur: num("price") ?? num("p"),
    sourceUrl: q.get("u") ?? undefined,
  };
  if (!result.fineGrams && result.grossGrams && result.permille)
    result.fineGrams = result.grossGrams * (result.permille / 1000);
  if (!result.permille && result.fineGrams && result.grossGrams)
    result.permille = (result.fineGrams / result.grossGrams) * 1000;
  return result;
}

/**
 * Find a library coin with the same metal whose fine content is within 1%.
 * Returns the closest one, or undefined (→ fall back to a custom coin).
 */
export function matchLibraryCoin(imp: ImportedCoin): Coin | undefined {
  if (!imp.metal || !imp.fineGrams) return undefined;
  const fineOz = imp.fineGrams / TROY_OZ_G;
  let best: { coin: Coin; diff: number } | undefined;
  for (const c of COINS) {
    if (c.metal !== imp.metal) continue;
    const diff = Math.abs(c.fineOz - fineOz) / c.fineOz;
    if (diff <= 0.01 && (!best || diff < best.diff)) best = { coin: c, diff };
  }
  return best?.coin;
}

/**
 * The bookmarklet body. Runs on the dealer's product page, so it must be fully
 * self-contained (no imports, no outer references). Kept in plain ES5-ish JS.
 */
function bookmarkletBody(appUrl: string): void {
  var txt = function (sel: string): string {
    var el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return "";
    return ((el as HTMLMetaElement).content || el.innerText || "").trim();
  };
  var spec =
    txt(".woocommerce-product-details__short-description") ||
    txt('meta[property="og:description"]') ||
    txt('meta[name="description"]');
  // Price: sale price (<ins>) first, then the regular product-price widget.
  var price =
    txt('[data-widget_type^="woocommerce-product-price"] ins .amount') ||
    txt('[data-widget_type^="woocommerce-product-price"] .amount') ||
    txt(".summary .price ins .amount") ||
    txt(".summary .price .amount");
  var title = txt('meta[property="og:title"]') || document.title;
  if (!spec) {
    alert("Coin Premium: no coin specs found on this page.");
    return;
  }
  var params = new URLSearchParams({
    t: spec.slice(0, 1500),
    p: price,
    n: title,
    u: location.href,
  });
  window.open(appUrl + "?" + params.toString(), "_blank");
}

/** Build the javascript: URL for the bookmarklet pointing at `appUrl`. */
export function bookmarkletHref(appUrl: string): string {
  const src = `(${bookmarkletBody.toString()})(${JSON.stringify(appUrl)})`;
  return "javascript:" + encodeURIComponent(src);
}
