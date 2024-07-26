import {
  initMiniApp,
  initThemeParams,
  initUtils,
  on,
  postEvent,
  retrieveLaunchParams,
} from "@telegram-apps/sdk";
import { createSignal, onCleanup } from "solid-js";

export const launchParams = retrieveLaunchParams();
export const authData = launchParams.initDataRaw;
const [themeParams, cleanUpThemeParams] = initThemeParams();
export const utils = initUtils();
const [miniApp, cleanupMiniApp] = initMiniApp();

export { miniApp, themeParams };
export const platform = launchParams.platform;

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cleanupMiniApp();
    cleanUpThemeParams();
  });
}

export const createTgScreenSize = () => {
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
