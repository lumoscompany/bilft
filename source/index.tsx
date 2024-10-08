import { Portal, render } from "solid-js/web";
import "unfonts.css";
import "./index.css";

import { ProfilePage } from "@/features/ProfilePage/ProfilePage";
import {
  getTonconnectManifestUrl,
  SetupTonWallet,
} from "@/features/SetupTonWallet";
import { TonConnectProvider } from "@/lib/ton-connect-solid";
import { Route } from "@solidjs/router";
import { bindThemeParamsCSSVars, postEvent } from "@telegram-apps/sdk";
import { createComputed, createSignal, onCleanup, onMount } from "solid-js";
import { Toaster } from "solid-sonner";
import { CommentsPage } from "./features/CommentsPage/CommentsPage";
import { KeyboardStatusProvider } from "./features/keyboardStatus";
import {
  createNavigatorFromStartParam,
  NavigationReadyProvider,
} from "./features/navigation";
import { PageLayout } from "./features/PagesLayout";
import { createRouterWithPageTransition } from "./features/pageTransitions";
import { parseStartParam } from "./features/parseStartParam";
import { useFixSafariScroll } from "./features/safariScrollFix";
import { ScreenSizeProvider } from "./features/screenSize";
import {
  createTgScreenSize,
  launchParams,
  miniApp,
  platform,
  themeParams,
} from "./features/telegramIntegration";
import { AppQueryClientProvider } from "./queryClient";

const cleanup = bindThemeParamsCSSVars(themeParams);
if (import.meta.hot) {
  import.meta.hot.dispose(cleanup);
}
const dispose = (() => {
  let textOpposite: string;
  const updateTextOpposite = () => {
    textOpposite = themeParams.isDark ? "#000" : "#FFF";
    document.documentElement.style.setProperty(
      "--theme-text-opposite-color",
      textOpposite,
    );
  };

  themeParams.on("change", () => {
    updateTextOpposite();
  });
  updateTextOpposite();
  return () => {
    themeParams.off("change", updateTextOpposite);
  };
})();

if (import.meta.hot) {
  import.meta.hot.dispose(dispose);
}

miniApp.setHeaderColor("secondary_bg_color");

const createIsResolved = (pr: Promise<unknown>) => {
  const [isResolved, setIsResolved] = createSignal(false);
  pr.then(() => setIsResolved(true));

  return isResolved;
};

const App = () => {
  const navigator = createNavigatorFromStartParam(
    launchParams.startParam ? parseStartParam(launchParams.startParam) : null,
  );
  const isNavigationReady = createIsResolved(navigator.attach());
  onCleanup(() => {
    void navigator.detach();
  });

  const Router = createRouterWithPageTransition(navigator);

  postEvent("web_app_setup_swipe_behavior", { allow_vertical_swipe: false });
  onMount(() => {
    miniApp.ready();
    postEvent("web_app_expand");
  });

  const windowSize = createTgScreenSize();
  createComputed(() => {
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
            <NavigationReadyProvider value={isNavigationReady}>
              <Router root={PageLayout}>
                <Route
                  component={ProfilePage}
                  path={"/board/:idWithoutPrefix"}
                />
                <Route component={CommentsPage} path={"/comments/:noteId"} />
              </Router>
            </NavigationReadyProvider>
          </TonConnectProvider>

          <Portal>
            <Toaster
              position="top-center"
              richColors
              toastOptions={{
                classes: {
                  title: "font-inter",
                  toast: "rounded-xl",
                },
              }}
              theme={miniApp.isDark ? "dark" : "light"}
            />
          </Portal>
        </KeyboardStatusProvider>
      </ScreenSizeProvider>
    </AppQueryClientProvider>
  );
};

render(() => <App />, document.getElementById("root") as HTMLElement);
