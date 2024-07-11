import { describe, expect, it } from "vitest";
import { ArrayHelper } from "./array";

describe(ArrayHelper.toInsertedInUniqueSortedArray.name, () => {
  it("inserts correctly to ordered array", () => {
    expect(
      ArrayHelper.toInsertedInUniqueSortedArray([1, 2, 4], [5, 6]),
    ).toEqual([1, 2, 4, 5, 6]);

    expect(
      ArrayHelper.toInsertedInUniqueSortedArray([1, 2, 3], [5, 6]),
    ).toEqual([1, 2, 3, 5, 6]);

    expect(
      ArrayHelper.toInsertedInUniqueSortedArray([1, 2, 6, 7], [3, 4]),
    ).toEqual([1, 2, 3, 4, 6, 7]);
  });

  it("correctly replaces duplicated elements", () => {
    expect(
      ArrayHelper.toInsertedInUniqueSortedArray([1, 2, 3], [1, 2]),
    ).toEqual([1, 2, 3]);

    expect(
      ArrayHelper.toInsertedInUniqueSortedArray([1, 2, 3, 4], [2, 3]),
    ).toEqual([1, 2, 3, 4]);

    expect(
      ArrayHelper.toInsertedInUniqueSortedArray([1, 2, 3, 4, 5], [5, 6, 7]),
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);

    expect(
      ArrayHelper.toInsertedInUniqueSortedArray([1, 2, 3, 4, 7], [4, 5]),
    ).toEqual([1, 2, 3, 4, 5, 7]);
  });
});

describe(ArrayHelper.max, () => {
  it("returns max number", () => {
    expect(ArrayHelper.max([1, 2, 3])).toBe(3);
    expect(ArrayHelper.max([3, 2, 1])).toBe(3);
    expect(ArrayHelper.max([1])).toBe(1);
    expect(ArrayHelper.max([])).toBe(0);
  });
});

describe(ArrayHelper.findGapAsc, () => {
  it("array with gap", () => {
    expect(ArrayHelper.findGapAsc([1, 3])).toBe(1);

    expect(ArrayHelper.findGapAsc([1, 2, 3, 4, 5, 6, 7, 10])).toBe(7);
  });
  it("shouldn't detect gaps false gaps", () => {
    expect(ArrayHelper.findGapAsc([1, 2, 3, 4])).toBe(null);

    expect(ArrayHelper.findGapAsc([-12, -11, -10])).toBe(null);
  });
});
