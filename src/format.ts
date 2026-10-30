/** "+" for zero/positive, a real minus sign for negative. */
export function sign(n: number): string {
  return n >= 0 ? "+" : "−";
}

/** Signed percentage, e.g. "+4.3%" / "−23.2%". The sign is printed once. */
export function pct(n: number): string {
  const r = Number(n.toFixed(1)); // round first so -0.04 reads "+0.0%", not "−0.0%"
  return `${sign(r)}${Math.abs(r).toFixed(1)}%`;
}
