import { assertOk } from "@/common";
import { useCleanup } from "@/lib/solid";
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  useContext,
  type ParentProps,
} from "solid-js";
import { useScreenSize } from "./screenSize";

let maxScreenSize = 0;
const orientation = window.matchMedia("(orientation: portrait)");

const useKeyboardStatusImpl = () => {
  const [isKeyboardOpen, setIsKeyboardOpen] = createSignal(false);
  const [isPortrait, setIsPortrait] = createSignal(orientation.matches);

  const { height } = useScreenSize();

  useCleanup((signal) => {
    orientation.addEventListener(
      "change",
      () => {
        setIsPortrait(orientation.matches);
      },
      { signal },
    );
  });

  createEffect(() => {
    height();

    if (!isPortrait()) {
      setIsKeyboardOpen(false);
      return;
    }
    if (maxScreenSize < height()) {
      maxScreenSize = height();
    }

    setIsKeyboardOpen(maxScreenSize * 0.8 > height());
  });

  const estimateKeyboardSize = createMemo((prev: null | number) => {
    if (isKeyboardOpen()) {
      return Math.max(prev ?? 0, maxScreenSize - height());
    }
    return prev;
  }, null);

  return {
    isKeyboardOpen,
    isPortrait,
    estimateKeyboardSize,
  };
};

const keyboardStatus = createContext<{
  isKeyboardOpen(): boolean;
  isPortrait(): boolean;
  estimateKeyboardSize(): number | null;
} | null>(null);
export const KeyboardStatusProvider = (props: ParentProps) => (
  <keyboardStatus.Provider value={useKeyboardStatusImpl()}>
    {props.children}
  </keyboardStatus.Provider>
);

export const useKeyboardStatus = () => {
  const ctx = useContext(keyboardStatus);
  assertOk(ctx);

  return ctx;
};
