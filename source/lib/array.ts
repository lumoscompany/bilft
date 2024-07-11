import { assertOk } from "./assert";

const cmpAsc = (a: number, b: number) => a - b;

export const ArrayHelper = {
  /**
   *
   * @returns index missing element
   */
  findGapAsc: (arr: number[]) => {
    for (let i = 1; i < arr.length; ++i) {
      const prev = arr[i - 1];
      const cur = arr[i];

      if (cur - prev > 1) {
        return i;
      }
    }
    return null;
  },
  max: (arr: number[]) => {
    let max = arr[0] ?? 0;
    for (let i = 0; i < arr.length; ++i) {
      max = Math.max(max, arr[i]);
    }

    return max;
  },
  sortNumbersAsc: (arr: number[]) => arr.toSorted(cmpAsc),
  // sortNumbersDesc: (arr: number[]) => arr.toSorted(cmpAsc),
  toInsertedInUniqueSortedArray: (arr: number[], newItems: number[]) => {
    assertOk(newItems.length > 0);
    let prevIndex = arr.findIndex((it) => it >= newItems[0]);
    if (prevIndex === -1) {
      prevIndex = arr.length;
    }

    let lastIndex = arr.findLastIndex((it) => it <= newItems.at(-1)!);
    if (lastIndex === -1) {
      lastIndex = prevIndex;
    } else {
      lastIndex += 1;
    }

    return arr.toSpliced(prevIndex, lastIndex - prevIndex, ...newItems);
  },
};
