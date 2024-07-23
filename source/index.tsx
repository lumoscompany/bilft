import { render } from "solid-js/web";
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
import { createComputed, onCleanup, onMount } from "solid-js";
import { Toaster } from "solid-sonner";
import { CommentsPage } from "./features/CommentsPage/CommentsPage";
import { KeyboardStatusProvider } from "./features/keyboardStatus";
import { createNavigatorFromStartParam } from "./features/navigation";
import { createRouterWithPageTransition } from "./features/pageTransitions";
import { parseStartParam } from "./features/parseStartParam";
import { useFixSafariScroll } from "./features/safariScrollFix";
import { ScreenSizeProvider } from "./features/screenSize";
import {
  createTgScreenSize,
  launchParams,
  platform,
  themeParams,
} from "./features/telegramIntegration";
import { AppQueryClientProvider } from "./queryClient";

bindThemeParamsCSSVars(themeParams);

const App = () => {
  const navigator = createNavigatorFromStartParam(
    launchParams.startParam ? parseStartParam(launchParams.startParam) : null,
  );
  navigator.attach();
  onCleanup(() => {
    void navigator.detach();
  });

  const Router = createRouterWithPageTransition(navigator);

  onMount(() => {
    postEvent("web_app_ready");
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
