import {
  createBeforeLeave,
  createRouter as createSolidRouter,
  type BaseRouterProps,
} from "@solidjs/router";
import { getVirtualizerHandle, scrollableElement } from "./scroll";

import type {
  BrowserNavigator,
  BrowserNavigatorEvents,
} from "@telegram-apps/sdk";
import { getHash, urlToPath } from "@telegram-apps/sdk";
import type { Component } from "solid-js";
import { onCleanup } from "solid-js";

/**
 * Guard against selector being an invalid CSS selector.
 * @param selector - CSS selector.
 */
function querySelector<T extends Element>(selector: string) {
  try {
    return document.querySelector<T>(selector);
  } catch {
    return null;
  }
}

/**
 * Scrolls to specified hash.
 * @param hash - hash to scroll to.
 * @param fallbackTop - should scroll be performed to the beginning of the page in case
 * hash was not found on the page.
 */
function scrollToHash(hash: string, fallbackTop: boolean) {
  const el = querySelector(`#${hash}`);
  if (el) {
    el.scrollIntoView();
    return;
  }

  if (fallbackTop) {
    window.scrollTo(0, 0);
  }
}

type ChangeEvent = BrowserNavigatorEvents<unknown>["change"] & {
  _delay?: Promise<void>;
};

/**
 * Creates a new Router for the application.
 * @param navigator - browser navigator.
 */
export function createRouter<State>(
  navigator: BrowserNavigator<State>,
  on: BrowserNavigator<State>["on"],
): Component<BaseRouterProps> {
  const { confirm, subscribe } = createBeforeLeave();

  return createSolidRouter({
    get: () => navigator.path,
    init: (notify) =>
      on(
        "change",
        () => notify(),
        // (e: ChangeEvent) => e._delay?.then(() => notify()) ?? notify(),
      ),
    set: ({ value, state, ...next }) => {
      // TODO: We should check all cases with the "state" variable. Not sure, if it always fits
      //  the typing of State.
      if (next.replace) {
        navigator.replace(value, state as State);
      } else {
        navigator.push(value, state as State);
      }

      const hash = getHash(value);
      if (hash) {
        scrollToHash(hash, next.scroll || false);
      }
    },
    utils: {
      go: (delta) => navigator.go(delta),
      renderPath: (path) => navigator.renderPath(path),
      parsePath: (path) => urlToPath(navigator.parsePath(path)),
      beforeLeave: {
        subscribe,
        confirm: (to, options) => {
          const isConfirmed = confirm(to, options);
          if (!isConfirmed) {
            return false;
          }

          // redirecting via tma.js, to startViewTransition first
          if (typeof to === "number") {
            navigator.go(to);
          } else if (options?.replace) {
            // [TODO]: handle state param or never use it
            navigator.replace(to);
          } else {
            // [TODO]: handle state param or never use it
            navigator.push(to);
          }

          return false;
        },
      },
    },
  });
}

export const createRouterWithPageTransition = ({
  dangerousWillBePatched_navigator: navigator,
}: {
  dangerousWillBePatched_navigator: BrowserNavigator<unknown>;
}): Component<BaseRouterProps> => {
  const startViewTransition = document.startViewTransition?.bind(document);

  let idToScrollPosition: Map<string, number>;
  if (startViewTransition) {
    // we need to make it, but our own, cause of junk frame after popstate
    history.scrollRestoration = "manual";
    idToScrollPosition = new Map<string, number>();
    let lastViewTransitionFinish: Promise<void> | null = null;
    onCleanup(
      navigator.on("change", (e: ChangeEvent) => {
        if (
          (e.from.hash === e.to.hash &&
            e.from.pathname === e.to.pathname &&
            e.from.search !== e.to.search) ||
          // do not react on replace
          e.delta === 0
        ) {
          return;
        }
        idToScrollPosition.set(e.from.id, scrollableElement.scrollTop);

        // garbage collecting obsolete pages scroll positions
        if (idToScrollPosition.size > 100) {
          const currentPagesIds = new Set<string>();

          for (const { id } of navigator.history) {
            currentPagesIds.add(id);
          }

          const idsForRemove: string[] = [];
          for (const [id] of idToScrollPosition) {
            if (!currentPagesIds.has(id)) {
              idsForRemove.push(id);
            }
          }
          for (const id of idsForRemove) {
            idToScrollPosition.delete(id);
          }
        }

        document.documentElement.dataset.navigationDir =
          e.delta > 0 ? "forward" : "backward";

        const transition = startViewTransition();
        e._delay = transition.ready;

        lastViewTransitionFinish = transition.finished;

        lastViewTransitionFinish.finally(() => {
          if (lastViewTransitionFinish === transition.finished) {
            delete document.documentElement.dataset.navigationDir;
            lastViewTransitionFinish = null;
          }
        });
      }),
    );
  }
  const on: typeof navigator.on = (evName, callback) => {
    return navigator.on(evName, (e: ChangeEvent, ...rest) => {
      if (!e._delay) {
        // @ts-expect-error unions
        callback(e, ...rest);
        return;
      }
      e._delay.finally(() => {
        // @ts-expect-error unions
        callback(e, ...rest);

        // waiting for layout to scroll work properly
        queueMicrotask(() => {
          const virtualizerHandle = getVirtualizerHandle();
          if (virtualizerHandle) {
            virtualizerHandle.scrollTo(idToScrollPosition.get(e.to.id) ?? 0);
            return;
          }
          scrollableElement.scrollTo({
            behavior: "instant",
            top: idToScrollPosition.get(e.to.id) ?? 0,
          });
        });
      });
    });
  };

  return createRouter(
    navigator,
    startViewTransition ? on : navigator.on.bind(navigator),
  );
};
