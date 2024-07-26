import type {
  TonConnectUI,
  TonConnectUiOptions,
  WalletsModal,
} from "@tonconnect/ui";
import {
  createContext,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  useContext,
  type Accessor,
  type ParentProps,
  type Setter,
} from "solid-js";
import { onOptionalCleanup } from "./solid";

const TonContext = createContext<null | (() => TonConnectUI | null)>(null);

const useTonContext = () => {
  const ctx = useContext(TonContext);

  if (!ctx) {
    throw new Error("TonContext not found");
  }

  return ctx;
};

export const useTonConnectModal = (): [
  Accessor<WalletsModal["state"] | null>,
  Pick<WalletsModal, "open" | "close">,
] => {
  const [tonConnectUI] = useTonConnectUI();
  const [state, setState] = createSignal(tonConnectUI()?.modal.state ?? null);

  createEffect(() =>
    onOptionalCleanup(
      tonConnectUI()?.onModalStateChange((ev) => {
        setState(ev);
      }),
    ),
  );

  return [
    state,
    {
      open: () => tonConnectUI()?.modal.open(),
      close: () => tonConnectUI()?.modal.close(),
    },
  ];
};

export const useTonWallet = (): Accessor<TonConnectUI["wallet"]> => {
  const ctx = useTonContext();

  const [wallet, setWallet] = createSignal(ctx()?.wallet ?? null);

  createEffect(() => {
    const tonConnectUI = ctx();
    if (!tonConnectUI) {
      return;
    }
    setWallet(tonConnectUI.wallet);

    onCleanup(
      tonConnectUI.onStatusChange((newState) => {
        setWallet(newState);
      }),
    );
  });

  return wallet;
};

export const useTonConnectUI = (): [
  Accessor<TonConnectUI | null>,
  Setter<TonConnectUiOptions>,
] => {
  const ctx = useTonContext();

  return [
    ctx,
    (data) => {
      const tonConnectUI = ctx();
      if (!tonConnectUI) {
        throw new Error("Cannot set props of unexisting ConnectUI");
      }

      tonConnectUI.uiOptions =
        typeof data === "function" ? data(tonConnectUI.uiOptions) : data;

      return tonConnectUI.uiOptions;
    },
  ];
};

export const TonConnectProvider = (
  props: ParentProps<{
    manifestUrl: string;
  }>,
) => {
  const [tonConnectModuleResource] = createResource(
    () => import("@tonconnect/ui"),
  );

  const tonConnectUI = createMemo(() => {
    if (!tonConnectModuleResource.latest) {
      return null;
    }

    const ui = new tonConnectModuleResource.latest.TonConnectUI({
      manifestUrl: props.manifestUrl,
    });

    return ui;
  });

  return (
    <TonContext.Provider value={tonConnectUI}>
      {props.children}
    </TonContext.Provider>
  );
};
