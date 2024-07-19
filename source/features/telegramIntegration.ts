import { retrieveLaunchParams, initThemeParams, initUtils } from "@telegram-apps/sdk";

export const launchParams = retrieveLaunchParams();
export const authData = launchParams.initDataRaw;
export const [themeParams] = initThemeParams();
export const utils = initUtils();
export const platform = launchParams.platform;
