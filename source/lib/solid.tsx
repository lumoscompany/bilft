import { createEffect, createMemo, createSignal, onCleanup, untrack, type Accessor } from "solid-js";

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

export type RefFunction<T> = (el: T) => void;
export type Ref<T> = T | undefined | RefFunction<T>;
export const mergeRefs = <T extends any>(...refsFuncs: Ref<T>[]): RefFunction<T> => {
  return (arg) => {
    for (const ref of refsFuncs) {
      ref && (ref as RefFunction<T>)(arg);
    }
  };
};

export type TransitionPresenceStatus = "presenting" | "present" | "hiding" | "hidden";
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
  const [status, setStatus] = createSignal<TransitionPresenceStatus>(
    params.when() ? (params.element() ? "present" : "presenting") : "hidden",
  );

  const whenOrPrev = createMemo<T | undefined | null | false>((prev) =>
    status() === "hidden" ? null : status() !== "hiding" && params.when() ? params.when() : prev,
  );

  createDisposeEffect(() => {
    if (!show() || untrack(() => status() === "hiding")) {
      status();
      return;
    }

    setStatus("presenting");

    requestAnimationFrame(() => {
      setStatus((cur) => (cur === "presenting" ? "present" : cur));
    });

    return () => {
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
        } else {
          Promise.race([
            new Promise<void>((resolve) => {
              setTimeout(resolve, timeout);
            }),
            newAnimationsPromise,
          ]).finally(dismiss);
        }
      });
    };
  });

  return {
    present: whenOrPrev,
    status,
  };
};
