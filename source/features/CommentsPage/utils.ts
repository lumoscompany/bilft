import { ArrayHelper, type IsEqual } from "@/lib/array";
import { assertOk } from "@/lib/assert";
import { clamp } from "@/lib/clamp";
import { useSearchParams } from "@solidjs/router";
import { batch, createEffect, createSignal, on, onCleanup } from "solid-js";
import { createMutable } from "solid-js/store";
import { COMMENTS_REVERSED_KEY } from "../navigation";

export const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

export function useReversed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isReversed = () => searchParams[COMMENTS_REVERSED_KEY] === "true";

  return [
    isReversed,
    (newIsReversed: boolean) => {
      setSearchParams(
        {
          ...searchParams,
          [COMMENTS_REVERSED_KEY]: newIsReversed ? "true" : "false",
        },
        {
          replace: true,
          scroll: false,
        },
      );
    },
  ] as const;
}

export const createOneSideArraySync = <T>(
  input: () => T[],
  anchorElement: () => number,
  isEqual: IsEqual<T>,
) => {
  const [output, setOutput] = createSignal(input());
  const [isInsertingBefore, setIsInsertingBefore] = createSignal(false);

  const [hasTimer, setHasTimer] = createSignal(false);
  let animationEndPromise: null | Promise<void> = null;
  createEffect(() => {
    if (hasTimer()) {
      return;
    }

    const equal = ArrayHelper.isEqual(output(), input(), isEqual);
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
            output(),
            input(),
            isEqual,
            clamp(anchorElement(), 0, output().length - 1),
          );

          batch(() => {
            setIsInsertingBefore(res.front);
            setOutput(res.data);
          });
        } finally {
          pr.resolve();
          assertOk(animationEndPromise === pr.promise);
          animationEndPromise = null;
          setHasTimer(false);
        }
      });
    });
  });

  return [output, isInsertingBefore, () => animationEndPromise] as const;
};

export const IntAvg = (a: number, b: number) => ((a + b) / 2) | 0;

export function createListMarginTop(defaultMarginTop: number) {
  const [scrollMarginTop, setScrollMarginTop] =
    createSignal<number>(defaultMarginTop);
  const beforeListElements = createMutable<Record<string, HTMLElement>>({});
  createEffect(() => {
    const maxTopFromEntries = (entires: ResizeObserverEntry[]) => {
      let maxScrollTop: number | null = null;
      for (const entry of entires) {
        const curMarginTopPlusSize =
          (entry?.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height) +
          entry.target.scrollTop;

        maxScrollTop =
          maxScrollTop === null
            ? curMarginTopPlusSize
            : Math.max(curMarginTopPlusSize, maxScrollTop);
      }

      return maxScrollTop;
    };

    const maxTopFromElements = (elements: HTMLElement[]) => {
      let maxScrollTop: number | null = null;
      for (const element of elements) {
        const curMarginTopPlusSize = element.scrollTop + element.offsetHeight;

        maxScrollTop =
          maxScrollTop === null
            ? curMarginTopPlusSize
            : Math.max(curMarginTopPlusSize, maxScrollTop);
      }

      return maxScrollTop;
    };

    const onNewMaxTopScroll = (newMarginTopScroll: number | null) => {
      if (
        newMarginTopScroll !== null &&
        Math.abs(scrollMarginTop() - newMarginTopScroll) >= 2
      ) {
        setScrollMarginTop(newMarginTopScroll);
      }
    };

    const observer = new ResizeObserver((entries) => {
      onNewMaxTopScroll(maxTopFromEntries(entries));
    });

    createEffect(
      on(
        () => Object.values(beforeListElements),
        (elements) => {
          for (const el of elements) {
            observer.observe(el);
          }

          onCleanup(() => {
            for (const el of elements) {
              observer.unobserve(el);
            }
          });
          onNewMaxTopScroll(maxTopFromElements(elements));
        },
      ),
    );
  });

  return [
    scrollMarginTop,
    (elId: string) => (beforeListElement: HTMLElement) => {
      onCleanup(() => {
        delete beforeListElements[elId];
      });
      beforeListElements[elId] = beforeListElement;
    },
  ] as const;
}
