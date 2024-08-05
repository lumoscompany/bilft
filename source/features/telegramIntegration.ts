import {
  initMainButton,
  initMiniApp,
  initThemeParams,
  initUtils,
  on,
  postEvent,
  retrieveLaunchParams,
} from "@telegram-apps/sdk";
import { batch, createSignal, onCleanup } from "solid-js";

export const launchParams = retrieveLaunchParams();
export const authData = launchParams.initDataRaw;
const [themeParams, cleanUpThemeParams] = initThemeParams();
export const utils = initUtils();
const [miniApp, cleanupMiniApp] = initMiniApp();
const [mainButton, cleanupMainButton] = initMainButton();

export { mainButton, miniApp, themeParams };
export const platform = launchParams.platform;
export const userHasPremium = !!launchParams.initData?.user?.isPremium;

let _isApple: boolean;
export const isApple = () => {
  if (_isApple === undefined)
    _isApple = platform === "ios" || platform === "macos";

  return _isApple;
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupMiniApp();
    cleanUpThemeParams();
    cleanupMainButton();
  });
}

export const createTgScreenSize = () => {
  const [width, setWidth] = createSignal(window.innerWidth);
  const [height, setHeight] = createSignal(window.innerHeight);
  const [heightTransition, setHeightTransition] = createSignal(
    window.innerHeight,
  );
  const [isReady, setIsReady] = createSignal(false);

  onCleanup(
    on("viewport_changed", (e) => {
      if (e.is_state_stable) {
        batch(() => {
          setIsReady(true);
          setHeight(e.height);
          setWidth(e.width);
        });
      }

      setHeightTransition(e.height);
    }),
  );
  postEvent("web_app_request_viewport");

  return {
    width,
    height,
    isReady,
    heightTransition,
  };
};

export type TelegramScreenSize = ReturnType<typeof createTgScreenSize>;
