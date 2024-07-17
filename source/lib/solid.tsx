import {
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  onCleanup,
  onMount,
  untrack,
  type Accessor,
} from "solid-js";

export type Dispose = () => void;
export const createDisposeEffect = (effect: () => Dispose | void) =>
  createEffect((prevDispose: void | Dispose) => {
    if (prevDispose) {
      untrack(prevDispose);
    }

    return effect();
  });

export const useCleanup = (callback: (signal: AbortSignal) => void) => {
  const abortController = new AbortController();

  callback(abortController.signal);

  onCleanup(() => {
    abortController.abort();
  });
};

export const useObserverCleanup = (
  callback: () => null | { disconnect(): void },
) => {
  const observer = callback();
  if (observer) {
    onCleanup(() => observer.disconnect());
  }
};

export const useCleanupTimeout = (callback: () => void, delay: number) => {
  const timeoutId = setTimeout(callback, delay);

  onCleanup(() => clearTimeout(timeoutId));
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
}): {
  present: Accessor<T | undefined | null | false>;
  status: Accessor<TransitionPresenceStatus>;
} => {
  const timeout = params.timeout ?? 2000;
  const show = createMemo(() => !!params.when());
  const whenAndNoElement = params.when() && !params.element();
  const [status, setStatus] = createSignal<TransitionPresenceStatus>(
    params.when() ? (params.element() ? "present" : "presenting") : "hidden",
  );
  if (whenAndNoElement) {
    onMount(() => {
      setStatus(
        params.when()
          ? params.element()
            ? "present"
            : "presenting"
          : "hidden",
      );
    });
  }

  const whenOrPrev = createMemo<T | undefined | null | false>((prev) =>
    status() === "hidden"
      ? null
      : status() !== "hiding" && params.when()
        ? params.when()
        : prev,
  );

  // we need to execute effect before render
  createRenderEffect(() => {
    if (!show() || untrack(() => status() === "hiding")) {
      status();
      return;
    }

    setStatus("presenting");

    requestAnimationFrame(() => {
      setStatus((cur) => (cur === "presenting" ? "present" : cur));
    });

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

        let newAnimationsPromise: Promise<unknown> | null = null;

        for (const anim of curAnimations) {
          if (prevAnimations.includes(anim)) {
            continue;
          }
          newAnimationsPromise = newAnimationsPromise
            ? newAnimationsPromise.finally(() => anim.finished)
            : anim.finished;
        }

        if (!newAnimationsPromise) {
          dismiss();
          return;
        }

        Promise.race([
          new Promise<void>((resolve) => {
            setTimeout(resolve, timeout);
          }),
          newAnimationsPromise,
        ]).finally(dismiss);
      });
    });
  });

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

  window.addEventListener("scroll", () => {
    setWindowScrollTop(window.scrollY);
  });

  return windowScrollTop;
};
export const createInnerHeight = () => {
  const [innerHeight, setInnerHeight] = createSignal(window.innerHeight);

  window.addEventListener("resize", () => {
    setInnerHeight(window.innerHeight);
  });

  return innerHeight;
};

export const createInterval = (interval: number, func: () => void) => {
  const id = setInterval(func, interval);
  onCleanup(() => {
    clearInterval(id);
  });
};

type UnwrapSignals<T extends Record<string, unknown>> = {
  [TKey in keyof T]: T[TKey] extends Accessor<infer TValue> ? TValue : T[TKey];
};
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
