import { describe, expect, it } from "vitest";
import { ArrayHelper } from "./array";

describe(ArrayHelper.toInsertedInUniqueSortedArray, () => {
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

  it("must work with empty array", () => {
    expect(ArrayHelper.toInsertedInUniqueSortedArray([], [1, 2, 3])).toEqual([
      1, 2, 3,
    ]);
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
    expect(ArrayHelper.findGapAsc([1, 3, 4, 5, 6, 7, 10])).toBe(1);
  });
  it("shouldn't detect false gaps", () => {
    expect(ArrayHelper.findGapAsc([1, 2, 3, 4])).toBe(null);

    expect(ArrayHelper.findGapAsc([-12, -11, -10])).toBe(null);
  });
});

describe(ArrayHelper.findLastGapAsc, () => {
  it("handles array with gap", () => {
    expect(ArrayHelper.findLastGapAsc([1, 3])).toBe(0);
    expect(ArrayHelper.findLastGapAsc([1, 2, 3, 4, 5, 6, 7, 10])).toBe(6);
    expect(ArrayHelper.findLastGapAsc([1, 3, 4, 5, 6, 7, 10])).toBe(5);
  });

  it("shouldn't detect false gaps", () => {
    expect(ArrayHelper.findLastGapAsc([1, 2, 3, 4])).toBe(null);

    expect(ArrayHelper.findLastGapAsc([-12, -11, -10])).toBe(null);
  });
});

describe(ArrayHelper.getSideChanges, () => {
  it("must return false if there is no insertion", () => {
    expect(ArrayHelper.getSideChanges([], [], Object.is, 0)).toEqual([
      null,
      false,
      false,
    ]);
    expect(
      ArrayHelper.getSideChanges([1, 2, 3], [1, 2, 3], Object.is, 0),
    ).toEqual([0, false, false]);
  });
  it("must return back changes index", () => {
    expect(
      ArrayHelper.getSideChanges([1, 2, 3, 4], [1, 3, 4], Object.is, 0),
    ).toEqual([0, false, true]);

    expect(
      ArrayHelper.getSideChanges(
        [1, 2, 3, 4],
        [1, 2, 3, 4, 5, 6],
        Object.is,
        0,
      ),
    ).toEqual([0, false, true]);

    expect(
      ArrayHelper.getSideChanges([1, 2, 3, 4, 5, 7], [7, 4, 5], Object.is, 3),
    ).toEqual([1, true, true]);

    expect(
      ArrayHelper.getSideChanges([1, 2, 3, 4, 5, 7], [7, 4, 5], Object.is, 5),
    ).toEqual([0, true, true]);

    expect(
      ArrayHelper.getSideChanges([1, 2, 3, 4], [1, 3, 4], Object.is, 0),
    ).toEqual([0, false, true]);

    expect(
      ArrayHelper.getSideChanges(
        [1, 2, 3, 4],
        [1, 2, 3, 4, 5, 6],
        Object.is,
        0,
      ),
    ).toEqual([0, false, true]);
  });
});

describe(ArrayHelper.oneSideChange, () => {
  it("must change nothing if nothing is changed", () => {
    expect(
      ArrayHelper.oneSideChange([1, 2, 3], [1, 2, 3], Object.is, 0),
    ).toEqual({
      front: false,
      data: [1, 2, 3],
    });
  });
  it("must edit right part", () => {
    expect(
      ArrayHelper.oneSideChange([1, 2, 3], [1, 2, 3, 5, 6], Object.is, 0),
    ).toEqual({
      front: false,
      data: [1, 2, 3, 5, 6],
    });

    expect(
      ArrayHelper.oneSideChange([1, 2, 3, 4, 5], [5, 6, 1], Object.is, 0),
    ).toEqual({
      front: false,
      data: [1],
    });
  });
  it("must edit left part if right didn't change", () => {
    expect(
      ArrayHelper.oneSideChange([1, 2, 3, 4, 5], [1, 2, 5], Object.is, 4),
    ).toEqual({
      front: true,
      data: [1, 2, 5],
    });
  });
  it("must fulfill empty array", () => {
    expect(ArrayHelper.oneSideChange([], [1, 2, 5], Object.is, 0)).toEqual({
      front: false,
      data: [1, 2, 5],
    });
  });
  it("must edit array in two calls", () => {
    const anchorEl = 4;
    const prev = [1, 2, 3, anchorEl, 5, 7];
    const next = [10, 12, anchorEl, 8, 33];

    const firstRun = ArrayHelper.oneSideChange(
      prev,
      next,
      Object.is,
      prev.indexOf(anchorEl),
    );
    expect(firstRun).toEqual({
      front: false,
      data: [1, 2, 3, 4, 8, 33],
    });
    expect(
      ArrayHelper.oneSideChange(
        firstRun.data,
        next,
        Object.is,
        firstRun.data.indexOf(anchorEl),
      ),
    ).toEqual({
      front: true,
      data: next,
    });
  });
});

describe(ArrayHelper.isEqual, () => {
  it("works with primitives", () => {
    expect(ArrayHelper.isEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(ArrayHelper.isEqual([1, 2, 3], [1, 2])).toBe(false);
    expect(ArrayHelper.isEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(ArrayHelper.isEqual([1, 2, 3], [1, 2, 3, 4])).toBe(false);
  });

  it("works with objects", () => {
    const isAEqual = (a: { a: number }, b: { a: number }) => a.a === b.a;
    expect(
      ArrayHelper.isEqual([{ a: 1 }, { a: 2 }], [{ a: 1 }, { a: 2 }], isAEqual),
    ).toBe(true);
    expect(
      ArrayHelper.isEqual([{ a: 1 }, { a: 2 }], [{ a: 1 }], isAEqual),
    ).toBe(false);
    expect(
      ArrayHelper.isEqual([{ a: 1 }, { a: 2 }], [{ a: 1 }, { a: 3 }], isAEqual),
    ).toBe(false);
    expect(
      ArrayHelper.isEqual(
        [{ a: 1 }, { a: 2 }],
        [{ a: 1 }, { a: 2 }, { a: 3 }],
        isAEqual,
      ),
    ).toBe(false);
  });
});
