import {
  createMemo,
  createRenderEffect,
  createSignal,
  onCleanup,
  untrack,
  type Accessor,
} from "solid-js";

export type Dispose = () => void;

export const useCleanup = (callback: (signal: AbortSignal) => void) => {
  const abortController = new AbortController();

  callback(abortController.signal);

  onCleanup(() => {
    abortController.abort();
  });
};
export const onOptionalCleanup = (callback: undefined | Dispose) => {
  callback && onCleanup(callback);
};

export const useObserverCleanup = (
  callback: () => null | { disconnect(): void },
) => {
  const observer = callback();
  if (observer) {
    onCleanup(() => observer.disconnect());
  }
};

export const createTimeout = (callback: () => void, delay: number) => {
  const timeoutId = setTimeout(callback, delay);

  onCleanup(() => clearTimeout(timeoutId));
};

export const createInterval = (func: () => void, interval: number) => {
  const id = setInterval(func, interval);
  onCleanup(() => {
    clearInterval(id);
  });
};

export type RefFunction<T> = (el: T) => void;
export type Ref<T> = T | undefined | RefFunction<T>;
export const mergeRefs = <T,>(...refsFuncs: Ref<T>[]): RefFunction<T> => {
  return (arg) => {
    for (const ref of refsFuncs) {
      ref && (ref as RefFunction<T>)(arg);
    }
  };
};

export type TransitionPresenceStatus =
  | "presenting"
  | "present"
  | "hiding"
  | "hidden";
export const createTransitionPresence = <T,>(params: {
  when: Accessor<T | undefined | null | false>;
  element: Accessor<undefined | HTMLElement>;
  timeout?: number;
  animateInitial?: boolean;
}): {
  present: Accessor<T | undefined | null | false>;
  status: Accessor<TransitionPresenceStatus>;
} => {
  const timeout = params.timeout ?? 2000;
  const show = createMemo(() => !!params.when());
  const [status, setStatus] = createSignal<TransitionPresenceStatus>(
    params.when()
      ? params.animateInitial
        ? "presenting"
        : "present"
      : "hidden",
  );

  const whenOrPrev = createMemo<T | undefined | null | false>((prev) =>
    status() === "hidden"
      ? null
      : status() !== "hiding" && params.when()
        ? params.when()
        : prev,
  );

  // we need to execute effect before render
  createRenderEffect((shouldPresentWithAnimation: boolean): boolean => {
    if (!show() || untrack(() => status() === "hiding")) {
      status();
      return true;
    }
    if (shouldPresentWithAnimation) {
      setStatus("presenting");

      requestAnimationFrame(() => {
        setStatus((cur) => (cur === "presenting" ? "present" : cur));
      });
    } else {
      setStatus("present");
    }

    onCleanup(() => {
      const dismiss = () => {
        setStatus("hidden");
      };

      const _element = params.element();
      if (!_element) {
        dismiss();
        return;
      }

      const prevAnimations = _element.getAnimations({
        subtree: true,
      });
      setStatus("hiding");

      queueMicrotask(() => {
        const curAnimations = _element.getAnimations({
          subtree: true,
        });
        // console.log({
        //   curAnimations,
        //   prevAnimations,
        // });

        const filteredAnimations = curAnimations.filter(
          (it) => !prevAnimations.includes(it),
        );

        if (filteredAnimations.length === 0) {
          dismiss();
          return;
        }

        Promise.race([
          new Promise<void>((resolve) => {
            setTimeout(resolve, timeout);
          }),
          Promise.allSettled(filteredAnimations.map((it) => it.finished)),
        ]).finally(dismiss);
      });
    });

    return true;
  }, !!params.animateInitial);

  return {
    present: whenOrPrev,
    status,
  };
};

export const SignalHelper = {
  map: <T, R>(sig: Accessor<T>, map: (value: T) => R) => map(sig()),
};

export const createWindowScrollTop = () => {
  const [windowScrollTop, setWindowScrollTop] = createSignal(window.screenTop);

  useCleanup((signal) =>
    window.addEventListener(
      "scroll",
      () => {
        setWindowScrollTop(window.scrollY);
      },
      { signal },
    ),
  );

  return windowScrollTop;
};
export const createInnerHeight = () => {
  const [innerHeight, setInnerHeight] = createSignal(window.innerHeight);

  useCleanup((signal) =>
    window.addEventListener(
      "resize",
      () => {
        setInnerHeight(window.innerHeight);
      },
      { signal },
    ),
  );

  return innerHeight;
};

type UnwrapSignals<T extends Record<string, unknown>> = {
  [TKey in keyof T]: T[TKey] extends Accessor<infer TValue> ? TValue : T[TKey];
};
/**
 *
 * @description useful for console logging bunch of signals
 * @returns
 */
export const unwrapSignals = <T extends Record<string, unknown>>(
  obj: T,
): UnwrapSignals<T> => {
  const copy: Partial<UnwrapSignals<T>> = {};

  for (const key in obj) {
    const val = obj[key];
    if (typeof val === "function") {
      copy[key] = val();
    } else {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      copy[key] = val;
    }
  }

  return copy as UnwrapSignals<T>;
};

export const unwrapUntrackSignals = <T extends Record<string, unknown>>(
  obj: T,
): UnwrapSignals<T> => untrack(() => unwrapSignals(obj));

// export const createDelayed = <
//   T extends number | string | null | undefined | boolean,
// >(
//   source: Accessor<T>,
// ) => {
//   const [shouldDelay, setShouldDelay] = createSignal(false);
//   const output = createMemo<T>(
//     (prev) => (shouldDelay() ? prev : source()),
//     source(),
//   );
//   let waitPr: Promise<void>;
//   const delay = (time: number) => {
//     setShouldDelay(true);

//     setTimeout(() => {
//       setShouldDelay(false);
//     }, time);
//   };

//   return [output, delay];
// };
