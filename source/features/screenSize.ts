import { assertOk } from "@/lib/assert";
import { createContext, useContext } from "solid-js";
import type { TelegramScreenSize } from "./telegramIntegration";

const ScreenSizeContext = createContext<null | TelegramScreenSize>(null);

export const ScreenSizeProvider = ScreenSizeContext.Provider;
export const useScreenSize = () => {
  const ctx = useContext(ScreenSizeContext);
  assertOk(ctx);

  return ctx;
};
