import "@fontsource-variable/inter";
import { render } from "solid-js/web";
import "./index.css";

import { ProfilePage } from "@/features/ProfilePage/ProfilePage";
import { SetupTonWallet } from "@/features/SetupTonWallet";
import { TonConnectProvider } from "@/lib/ton-connect-solid";
import { Route } from "@solidjs/router";
import {
  bindThemeParamsCSSVars,
  initNavigator,
  on,
  postEvent,
  type BrowserNavigatorAnyHistoryItem,
} from "@telegram-apps/sdk";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { Toaster } from "solid-sonner";
import { CommentsPage } from "./features/CommentsPage/CommentsPage";
import {
  createCommentPagePathname,
  createCommentPageSearchEntries,
} from "./features/CommentsPage/utils";
import { getSelfUserId, removePrefix } from "./features/idUtils";
import { KeyboardStatusProvider } from "./features/keyboardStatus";
import { createRouterWithPageTransition } from "./features/pageTransitions";
import { parseStartParam } from "./features/parseStartParam";
import { useFixSafariScroll } from "./features/safariScrollFix";
import { ScreenSizeProvider } from "./features/screenSize";
import {
  launchParams,
  platform,
  themeParams,
} from "./features/telegramIntegration";
import { AppQueryClientProvider } from "./queryClient";

const getTonconnectManifestUrl = () => {
  const url = new URL(window.location.href);
  url.hash = "";
  for (const [key] of url.searchParams) {
    url.searchParams.delete(key);
  }

  url.pathname = "tonconnect-manifest.json";
  return url.toString();
};

bindThemeParamsCSSVars(themeParams);

const createTgScreenSize = () => {
  const [width, setWidth] = createSignal(window.innerWidth);
  const [height, setHeight] = createSignal(window.innerHeight);
  const [heightTransition, setHeightTransition] = createSignal(
    window.innerHeight,
  );

  onCleanup(
    on("viewport_changed", (e) => {
      if (e.is_state_stable) {
        setHeight(e.height);
        setWidth(e.width);
      }

      setHeightTransition(e.height);
    }),
  );
  postEvent("web_app_request_viewport");

  return {
    width,
    height,
    heightTransition,
  };
};

const createNavigatorFromStartParam = (
  startParam: ReturnType<typeof parseStartParam>,
) => {
  const targetEntry: BrowserNavigatorAnyHistoryItem<unknown> = (() => {
    if (startParam?.type === "note") {
      return {
        pathname: createCommentPagePathname(startParam.data.noteId),
        search: new URLSearchParams(
          createCommentPageSearchEntries(startParam.data.reversed),
        ).toString(),
      };
    }

    return {
      pathname: `/board/${removePrefix(startParam?.data ?? getSelfUserId())}`,
    };
  })();
  const selfEntry: BrowserNavigatorAnyHistoryItem<unknown> = {
    pathname: `/board/${removePrefix(getSelfUserId())}`,
  };
  const historySessionStorageKey = "app-navigator-state";
  const hasPreviousHistory = !!sessionStorage.getItem(historySessionStorageKey);

  const navigator = initNavigator(historySessionStorageKey);
  if (hasPreviousHistory) {
    return navigator;
  }
  if (selfEntry.pathname === targetEntry.pathname) {
    navigator.replace(selfEntry);
    return navigator;
  }
  navigator.replace(selfEntry);
  navigator.push(targetEntry);
  return navigator;
};

const App = () => {
  const navigator = createNavigatorFromStartParam(
    launchParams.startParam ? parseStartParam(launchParams.startParam) : null,
  );
  navigator.attach();
  onCleanup(() => {
    void navigator.detach();
  });

  const Router = createRouterWithPageTransition({
    dangerousWillBePatched_navigator: navigator,
  });

  onMount(() => {
    postEvent("web_app_ready");
    postEvent("web_app_expand");
  });

  const windowSize = createTgScreenSize();
  createEffect(() => {
    document.documentElement.style.setProperty(
      "--tg-screen-size",
      `${windowSize.height()}px`,
    );
  });

  if (platform === "ios") {
    useFixSafariScroll();
  }

  return (
    <AppQueryClientProvider>
      <ScreenSizeProvider value={windowSize}>
        <KeyboardStatusProvider>
          <TonConnectProvider manifestUrl={getTonconnectManifestUrl()}>
            <SetupTonWallet />
            <Router>
              <Route component={ProfilePage} path={"/board/:idWithoutPrefix"} />
              <Route component={CommentsPage} path={"/comments/:noteId"} />
            </Router>
          </TonConnectProvider>

          <Toaster
            position="top-center"
            richColors
            toastOptions={{
              classes: {
                title: "font-inter",
                toast: "rounded-xl",
              },
            }}
            theme={themeParams.isDark ? "dark" : "light"}
          />
        </KeyboardStatusProvider>
      </ScreenSizeProvider>
    </AppQueryClientProvider>
  );
};

render(() => <App />, document.getElementById("root") as HTMLElement);
