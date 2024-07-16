import { assertOk } from "./assert";

export type IsEqual<T> = (a: T, b: T) => boolean;

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
  findLastGapAsc: (arr: number[]) => {
    for (let i = arr.length - 2; i >= 0; --i) {
      const prev = arr[i + 1];
      const cur = arr[i];

      if (prev - cur > 1) {
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
  isEqual: <T>(
    prevArray: T[],
    nextArray: T[],
    isEqual: (a: T, b: T) => boolean = Object.is,
  ) => {
    if (prevArray.length !== nextArray.length) {
      return false;
    }
    const length = prevArray.length;
    for (let i = 0; i < length; ++i) {
      if (!isEqual(prevArray[i], nextArray[i])) {
        return false;
      }
    }
    return true;
  },
  hasDirectionChanges: <T>(
    prevArray: T[],
    newArray: T[],
    prevStartIndex: number,
    nextStartIndex: number,
    goBackward: boolean,
    isEqual: IsEqual<T>,
  ) => {
    const step = goBackward ? -1 : 1;
    let iOld = prevStartIndex,
      iNew = nextStartIndex;
    for (
      ;
      iOld >= 0 &&
      iOld < prevArray.length &&
      iNew >= 0 &&
      iNew < newArray.length;
      iNew += step, iOld += step
    ) {
      const prevItem = prevArray[iOld];
      const newItem = newArray[iNew];

      if (!isEqual(prevItem, newItem)) {
        return true;
      }
    }

    return goBackward
      ? iOld !== -1 || iNew !== -1
      : iOld !== prevArray.length || iNew !== newArray.length;
  },
  getSideChanges: <T>(
    prevArray: T[],
    newArray: T[],
    isEqual: IsEqual<T>,
    anchorIndex: number,
  ): [
    newAnchorIndex: number | null,
    changedBefore: boolean,
    changesAfter: boolean,
  ] => {
    if (prevArray.length === 0 && newArray.length === 0) {
      return [null, false, false];
    }
    assertOk(anchorIndex >= 0);
    assertOk(anchorIndex < prevArray.length);

    const prevAnchorItem = prevArray[anchorIndex];

    const newAnchorIndex = newArray.findIndex((it) =>
      isEqual(it, prevAnchorItem),
    );
    if (newAnchorIndex === -1) {
      return [null, true, true];
    }

    return [
      newAnchorIndex,
      ArrayHelper.hasDirectionChanges(
        prevArray,
        newArray,
        anchorIndex,
        newAnchorIndex,
        true,
        isEqual,
      ),
      ArrayHelper.hasDirectionChanges(
        prevArray,
        newArray,
        anchorIndex,
        newAnchorIndex,
        false,
        isEqual,
      ),
    ];
  },
  oneSideChange: <T>(
    prev: T[],
    next: T[],
    isEqual: IsEqual<T>,
    anchor: number,
  ) => {
    if (prev.length === 0 && next.length > 0) {
      return {
        front: false,
        data: [...next],
      };
    }
    const [newAnchor, changedBefore, changedAfter] = ArrayHelper.getSideChanges(
      prev,
      next,
      isEqual,
      anchor,
    );
    if (newAnchor === null) {
      return { front: false, data: [...next] };
    }

    if (changedAfter) {
      return {
        front: false,
        data: [...prev.slice(0, anchor), ...next.slice(newAnchor)],
      };
    }

    if (changedBefore) {
      return {
        front: true,
        data: [...next.slice(0, newAnchor), ...prev.slice(anchor)],
      };
    }

    return { front: false, data: prev };
  },
};
