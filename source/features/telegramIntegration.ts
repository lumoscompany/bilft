import {
  initThemeParams,
  initUtils,
  on,
  postEvent,
  retrieveLaunchParams,
} from "@telegram-apps/sdk";
import { createSignal, onCleanup } from "solid-js";

export const launchParams = retrieveLaunchParams();
export const authData = launchParams.initDataRaw;
export const [themeParams] = initThemeParams();
export const utils = initUtils();
export const platform = launchParams.platform;

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
