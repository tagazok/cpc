import { describe, expect, it } from "vitest";
import { pct, sign } from "./format";

describe("pct", () => {
  it.each([
    [4.3, "+4.3%"],
    [0, "+0.0%"],
    [-23.2, "−23.2%"],
    [-0.04, "+0.0%"],
    [15.24, "+15.2%"],
  ])("%s → %s", (n, want) => {
    expect(pct(n)).toBe(want);
  });

  it("never prints two signs", () => {
    expect(pct(-23.2)).not.toMatch(/[−-]{2}/);
  });
});

describe("sign", () => {
  it("uses + for zero and − for negatives", () => {
    expect([sign(1), sign(0), sign(-1)]).toEqual(["+", "+", "−"]);
  });
});
