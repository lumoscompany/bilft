import { assertOk } from "@/common";
import { createContext, useContext } from "solid-js";

const ScreenSizeContext = createContext<null | {
  width(): number;
  height(): number;
  heightTransition(): number;
}>(null);

export const ScreenSizeProvider = ScreenSizeContext.Provider;
export const useScreenSize = () => {
  const ctx = useContext(ScreenSizeContext);
  assertOk(ctx);

  return ctx;
};
