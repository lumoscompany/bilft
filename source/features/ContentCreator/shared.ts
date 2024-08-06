import type { model } from "@/api";
import {
  changeWalletErrorBody,
  fetchMethodCurry,
  keysFactory,
  walletErrorBodyOf,
} from "@/api/api";
import { SignalHelper } from "@/lib/solid";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { createMemo } from "solid-js";
import type { ModalStatus } from "./common";

export const createUnlinkMutation = (
  walletError: () => null | model.WalletOrLimitError,
  onUnlinkCauseError: (value: model.WalletOrLimitError) => unknown,
  onFallbackError: (value: model.WalletOrLimitError | null) => unknown,
) => {
  const queryClient = useQueryClient();

  return createMutation(() => ({
    mutationFn: fetchMethodCurry("/me/unlinkWallet"),
    onMutate: () => {
      const curWalletError = walletError();
      if (curWalletError) {
        onUnlinkCauseError(
          changeWalletErrorBody(curWalletError, {
            reason: "no_connected_wallet",
            payload: walletErrorBodyOf(curWalletError).payload,
          }),
        );
      }
      const curData = queryClient.getQueryData(keysFactory.me.queryKey);

      queryClient.setQueryData(keysFactory.me.queryKey, (data) =>
        data ? { ...data, wallet: undefined } : undefined,
      );

      return {
        curWalletError,
        curData,
      };
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(keysFactory.me.queryKey, ctx?.curData);
      if (!walletError()) {
        return;
      }
      onFallbackError(ctx?.curWalletError ?? null);
    },
  }));
};

export const createOptimisticModalStatus = (
  error: () => null | model.WalletOrLimitError,
) => {
  const meQuery = createQuery(() => keysFactory.me);
  const walletErrorBody = () => {
    let _error: model.WalletOrLimitError | null;
    if ((_error = error())) {
      return walletErrorBodyOf(_error);
    }
    return null;
  };

  const hasEnoughMoney = createMemo(() => {
    const curWalletError = walletErrorBody();
    const tokensBalance = meQuery.data?.wallet?.tokens.yo;
    if (!curWalletError || !tokensBalance) {
      return false;
    }
    return (
      BigInt(curWalletError.payload.requiredBalance) <= BigInt(tokensBalance)
    );
  });

  const modalStatus = (): ModalStatus | null =>
    SignalHelper.map(error, (error): ModalStatus | null => {
      if (!error) {
        return null;
      }
      const isPrivate = error.error.reason === "reached_limit";
      if (hasEnoughMoney()) {
        return {
          isPrivate,
          type: "success",
          data: null,
        };
      }

      if (
        walletErrorBodyOf(error).reason === "no_connected_wallet" &&
        meQuery.data?.wallet
      ) {
        return {
          isPrivate,
          type: "error",
          data: changeWalletErrorBody(error, {
            reason: "insufficient_balance",
            payload: walletErrorBodyOf(error).payload,
          }),
        };
      }
      return {
        isPrivate,
        type: "error",
        data: error,
      };
    });

  return modalStatus;
};
