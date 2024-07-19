import { fetchMethodCurry, keysFactory } from "@/api/api";
import { onOptionalCleanup } from "@/lib/solid";
import { useTonConnectUI } from "@/lib/ton-connect-solid";
import { createMutation, useQueryClient } from "@tanstack/solid-query";
import type { TonConnectUI } from "@tonconnect/ui";
import { createEffect } from "solid-js";

const random32Byte = () => {
  const buf = Buffer.alloc(32);
  crypto.getRandomValues(buf);

  return buf.toString("hex");
};

const Ref = {
  make: <T>(value: T) => ({
    value,
  }),
};

export const walletLinkedTarget = new EventTarget();
const walletDisconnection = Ref.make<null | Promise<void>>(null);
export const disconnectWallet = (wallet: TonConnectUI) => {
  if (wallet.connected && !walletDisconnection.value) {
    walletDisconnection.value = wallet.disconnect().finally(() => {
      walletDisconnection.value = null;
    });
  }

  return walletDisconnection.value;
};

export const SetupTonWallet = () => {
  const [tonConnectUI] = useTonConnectUI();
  // application specific logic
  createEffect(() => {
    tonConnectUI()?.setConnectRequestParameters({
      state: "ready",
      value: { tonProof: random32Byte() },
    });
  });

  const queryClient = useQueryClient();
  const linkWalletMutation = createMutation(() => ({
    mutationFn: fetchMethodCurry("/me/linkWallet"),
    onSuccess: async (data) => {
      walletLinkedTarget.dispatchEvent(new Event("wallet-linked"));
      queryClient.setQueryData(keysFactory.me.queryKey, data);

      const ton = tonConnectUI();
      if (ton) {
        void disconnectWallet(ton);
      }
    },
    retry: 3,
  }));

  createEffect(() =>
    onOptionalCleanup(
      tonConnectUI()?.onStatusChange((e) => {
        if (
          e?.connectItems?.tonProof &&
          "proof" in e.connectItems.tonProof &&
          e.account.publicKey
        ) {
          linkWalletMutation.mutate({
            address: e.account.address,
            proof: e.connectItems.tonProof.proof,
            publicKey: e.account.publicKey,
            stateInit: e.account.walletStateInit,
          });
        }
      }),
    ),
  );

  return null;
};

export const getTonconnectManifestUrl = () => {
  const url = new URL(window.location.href);
  url.hash = "";
  for (const [key] of url.searchParams) {
    url.searchParams.delete(key);
  }

  url.pathname = "tonconnect-manifest.json";
  return url.toString();
};
