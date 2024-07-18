import type { Note } from "@/api/model";
import { clamp } from "@/common";
import { ArrayHelper, type IsEqual } from "@/lib/array";
import { useSearchParams } from "@solidjs/router";
import { batch, createEffect, createSignal } from "solid-js";

export const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

const REVERSED_KEY = "reversed";
export function useReversed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isReversed = () => searchParams[REVERSED_KEY] === "true";

  return [
    isReversed,
    (newIsReversed: boolean) => {
      setSearchParams(
        {
          ...searchParams,
          [REVERSED_KEY]: newIsReversed ? "true" : "false",
        },
        {
          replace: true,
          scroll: false,
        },
      );
    },
  ] as const;
}
export const createCommentsPageUrl = (note: Note, reversed: boolean) => {
  const baseUrl = `/comments/${note.id}`;
  if (!reversed) {
    return baseUrl;
  }

  const params = new URLSearchParams([[REVERSED_KEY, String(reversed)]]);
  return `${baseUrl}?${params.toString()}`;
};

export const createOneSideArraySync = <T>(
  arr: () => T[],
  anchorElement: () => number,
  isEqual: IsEqual<T>,
) => {
  const [sig, setArr] = createSignal(arr());
  const [isInsertingBefore, setIsInsertingBefore] = createSignal(false);

  const [hasTimer, setHasTimer] = createSignal(false);
  let animationEndPromise: null | Promise<void> = null;
  createEffect(() => {
    if (hasTimer()) {
      return;
    }
    const equal = ArrayHelper.isEqual(sig(), arr(), isEqual);
    // console.log(
    //   unwrapUntrackSignals({
    //     sig,
    //     arr,
    //     equal,
    //     anchorElement,
    //   }),
    // );

    if (equal) {
      return;
    }

    setHasTimer(true);
    const pr = Promise.withResolvers<void>();
    animationEndPromise = pr.promise;

    // delaying rerenders to release event loop
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const res = ArrayHelper.oneSideChange(
            sig(),
            arr(),
            isEqual,
            clamp(anchorElement(), 0, sig().length - 1),
          );

          batch(() => {
            setArr(res.data);
            setIsInsertingBefore(res.front);
          });
        } finally {
          pr.resolve();
          animationEndPromise = null;
          setHasTimer(false);
        }
      });
    });
  });

  return [sig, isInsertingBefore, () => animationEndPromise] as const;
};

export const IntAvg = (a: number, b: number) => ((a + b) / 2) | 0;
