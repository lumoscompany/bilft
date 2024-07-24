import { describe, expect, it } from "vitest";
import { pointIsInsideBox } from "./point";

describe(pointIsInsideBox, () => {
  it("corrctly handles points without hit slop", () => {
    expect(pointIsInsideBox(0, 0, -2, -2, 4, 4)).toBe(true);

    expect(pointIsInsideBox(0, 0, -2, -2, 2, 2)).toBe(true);
    expect(pointIsInsideBox(-2, -2, -2, -2, 2, 2)).toBe(true);

    expect(pointIsInsideBox(-2, 0, -2, -2, 2, 2)).toBe(true);

    expect(pointIsInsideBox(-1, 0, -2, -2, 1, 2)).toBe(true);

    // x outside
    expect(pointIsInsideBox(0, 0, -2, -2, 1, 2)).toBe(false);

    // y outside
    expect(pointIsInsideBox(0, 0, -2, -3, 2, 2)).toBe(false);

    // x y outside
    expect(pointIsInsideBox(0, 0, -3, -3, 2, 2)).toBe(false);
  });

  it("correctly handles points with histlop", () => {
    // x
    expect(pointIsInsideBox(0, 0, -4, -3, 3.2, 2, 1)).toBe(true);

    // y
    expect(pointIsInsideBox(0, 0, 0, -3.2, 3, 3, 1)).toBe(true);
    // both
    expect(pointIsInsideBox(0, 0, -3, -3, 2, 2, 1)).toBe(true);
  });
});
