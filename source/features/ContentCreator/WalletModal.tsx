import { keysFactory } from "@/api/api";
import { clsxString, utils, type StyleProps } from "@/common";
import {
  ArrowPointDownIcon,
  CloseIcon,
  RefreshIcon,
  SuccessIcon,
  UnlinkIcon,
  YoCoinIcon,
} from "@/icons";
import { createTransitionPresence, mergeRefs, useCleanup } from "@/lib/solid";
import { useTonConnectUI } from "@/lib/ton-connect-solid";
import { createQuery } from "@tanstack/solid-query";
import { postEvent } from "@telegram-apps/sdk";
import {
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  onCleanup,
  untrack,
  type Accessor,
  type ComponentProps,
} from "solid-js";
import { disconnectWallet } from "../SetupTonWallet";
import { CheckboxUI, type ModalStatus } from "./common";

const buttonClass =
  "transition-transform duration-200 active:scale-[98%] bg-accent p-[12px] font-inter text-[17px] leading-[22px] text-button-text text-center rounded-xl self-stretch";
const YOKEN_DECIMALS = 9;

const yokenAmountToFloat = (amount: string) =>
  Number(amount) / 10 ** YOKEN_DECIMALS;
const trimAddress = (address: string) =>
  `${address.slice(0, 4)}...${address.slice(-4)}`;

const WalletControlPopup = (
  props: StyleProps & { address: string; onUnlink(): void } & Pick<
      ComponentProps<"div">,
      "ref"
    >,
) => {
  const [show, setShow] = createSignal(false);
  const [divRef, setDivRef] = createSignal<HTMLDivElement>();

  createEffect(() => {
    if (!show()) {
      return;
    }

    useCleanup((signal) => {
      window.addEventListener(
        "click",
        (ev) => {
          if (
            ev.target instanceof HTMLElement &&
            !divRef()?.contains(ev.target)
          ) {
            setShow(false);
            ev.preventDefault();
            ev.stopPropagation();
          }
        },
        {
          signal,
          capture: true,
        },
      );
    });
  });

  const [buttonRef, setButtonRef] = createSignal<HTMLButtonElement>();

  const { present, status } = createTransitionPresence({
    element: buttonRef,
    when: show,
  });

  return (
    <div
      ref={mergeRefs(setDivRef, props.ref)}
      class={clsxString(
        "absolute left-1/2 flex translate-x-[-50%] select-none flex-col items-center gap-[10px]",
        props.class ?? "",
      )}
    >
      <button
        onClick={() => {
          setShow((curShow) => !curShow);
        }}
        class="flex flex-row items-center gap-1 rounded-[10px] bg-bg px-[10px] py-[6px] font-inter text-[12px] text-text transition-transform active:scale-[97%]"
      >
        {trimAddress(props.address)}
        <ArrowPointDownIcon />
      </button>

      <Show when={present()}>
        <button
          ref={setButtonRef}
          onPointerDown={() => {
            postEvent("web_app_trigger_haptic_feedback", {
              type: "impact",
              impact_style: "heavy",
            });
          }}
          onClick={() => {
            setShow(false);
            props.onUnlink();
          }}
          class={clsxString(
            "absolute top-[calc(100%+10px)] -mx-[40px] text-destructive-text transition-transform",
            "flex flex-row gap-1 rounded-xl bg-section-bg px-2 py-[10px] text-center font-inter text-[15px] leading-[18px] animate-duration-300 active:scale-[97%]",
            status() === "hiding" ? "animate-fade-out" : "animate-fade",
          )}
        >
          Unlink wallet
          <UnlinkIcon />
        </button>
      </Show>
    </div>
  );
};

const createDelayed = <T extends number | boolean | string | null | undefined>(
  source: Accessor<T>,
  shouldDelay: () => boolean,
  delayMs: number,
) => {
  const [sig, setSig] = createSignal(source());

  createEffect(() => {
    const newSig = source();
    if (newSig === untrack(sig)) {
      return;
    }
    if (!untrack(shouldDelay)) {
      setSig(() => newSig);
      return;
    }

    const id = setTimeout(() => {
      setSig(() => newSig);
    }, delayMs);

    onCleanup(() => {
      clearTimeout(id);
    });
  });

  return sig;
};

export const WalletModalContent = (props: {
  status: ModalStatus;
  onClose(): void;
  onUnlinkWallet(): void;
  onSendPublic(): void;
  onSend(): void;
}) => {
  const status = () => props.status;
  const meQuery = createQuery(() => keysFactory.me);

  const [tonConnectUI] = useTonConnectUI();

  const renderRequiredBalance = (requiredBalance: string) => (
    <span class="text-text">
      {yokenAmountToFloat(requiredBalance).toFixed(0)} YO
    </span>
  );

  const SendAnonymous = (props: StyleProps) => (
    <p
      data-checked=""
      class={clsxString(
        "group flex items-center gap-2 text-center font-inter text-[20px] font-semibold leading-7 text-text",
        props.class ?? "",
      )}
    >
      <CheckboxUI />
      Send anonymously
    </p>
  );
  const delayedIsRefetching = createDelayed(
    () => meQuery.isRefetching,
    () => !meQuery.isRefetching,
    300,
  );

  return (
    <div class="flex min-h-[432px] flex-col pb-2">
      <section class="relative flex items-center justify-end pb-3 pt-5">
        <Show when={meQuery.data?.wallet}>
          {(wallet) => (
            <WalletControlPopup
              onUnlink={() => {
                props.onUnlinkWallet();
              }}
              address={wallet().friendlyAddress}
            />
          )}
        </Show>

        <button
          onClick={() => {
            props.onClose();
          }}
          type="button"
        >
          <span class="sr-only">Close</span>
          <CloseIcon class="text-accent" />
        </button>
      </section>

      <Switch>
        <Match when={status().data}>
          {(walletError) => (
            <section class="mt-5 flex flex-1 flex-col items-center">
              <YoCoinIcon class="mb-6" />
              <SendAnonymous />
              <p class="mt-2 text-center font-inter text-[17px] leading-[22px] text-hint">
                To send a post anonymously, you need to have at least{" "}
                {renderRequiredBalance(
                  walletError().error.payload.requiredBalance,
                )}
                <Switch>
                  <Match
                    when={walletError().error.reason === "insufficient_balance"}
                  >
                    . Please top up your balance
                  </Match>
                  <Match
                    when={walletError().error.reason === "no_connected_wallet"}
                  >
                    {" "}
                    in your wallet balance
                  </Match>
                </Switch>
              </p>
              <Switch>
                <Match
                  when={walletError().error.reason === "insufficient_balance"}
                >
                  <article class="mb-auto mt-5 flex flex-row gap-1">
                    <div class="flex flex-col rounded-[10px] bg-section-bg px-[10px] py-[6px]">
                      <div class="font-inter text-[12px] leading-4 text-subtitle">
                        Your balance
                      </div>
                      <div class="font-inter text-[13px] leading-[18px] text-text">
                        {yokenAmountToFloat(
                          meQuery.data?.wallet?.tokens.yo ?? "0",
                        ).toFixed(0)}{" "}
                        Yo
                      </div>
                    </div>

                    <div class="flex flex-col rounded-[10px] bg-section-bg px-[10px] py-[6px]">
                      <div class="font-inter text-[12px] leading-4 text-subtitle">
                        lacks
                      </div>
                      <div class="font-inter text-[13px] leading-[18px] text-text">
                        {Math.ceil(
                          yokenAmountToFloat(
                            walletError().error.payload.requiredBalance,
                          ) -
                            yokenAmountToFloat(
                              meQuery.data?.wallet?.tokens.yo ?? "0",
                            ),
                        )}{" "}
                        Yo
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        meQuery.refetch();
                      }}
                      inert={meQuery.isFetching}
                      class="flex h-full flex-row items-center gap-1 rounded-[10px] bg-section-bg px-[10px] py-[14px] font-inter text-[13px] leading-[18px] text-text transition-transform active:scale-[97%]"
                    >
                      <RefreshIcon
                        class={clsxString(
                          "origin-center animate-spin text-accent animate-duration-[750ms]",
                          delayedIsRefetching() ? "" : "animate-stop",
                        )}
                      />
                      Refresh
                    </button>
                  </article>

                  <button
                    type="button"
                    class={clsxString("mb-4 mt-7", buttonClass)}
                    onClick={() => {
                      utils.openLink("https://app.dedust.io/swap/TON/YO");
                    }}
                  >
                    Get YO
                  </button>
                </Match>
                <Match
                  when={walletError().error.reason === "no_connected_wallet"}
                >
                  <div class="mt-7 flex flex-1 flex-col justify-center self-stretch">
                    <button
                      type="button"
                      class={clsxString(buttonClass)}
                      onClick={async () => {
                        const ton = tonConnectUI();
                        if (!ton) {
                          return;
                        }

                        await disconnectWallet(ton);
                        ton.modal.open();
                      }}
                    >
                      Connect Wallet
                    </button>
                    <button
                      type="button"
                      class="mb-2 pt-[14px] text-center font-inter text-[17px] leading-[22px] text-accent transition-opacity active:opacity-70"
                      onClick={() => {
                        props.onSendPublic();
                      }}
                    >
                      Never mind, I'll post publicly
                    </button>
                  </div>
                </Match>
              </Switch>
            </section>
          )}
        </Match>

        <Match when={status().type === "success"}>
          <section class="mt-5 flex flex-1 flex-col items-center">
            <SuccessIcon class="mb-6" />

            <SendAnonymous />
            <p class="mt-2 text-center font-inter text-[17px] leading-[22px] text-hint">
              Awesome! Now you have enough YO to post anonymously. Click "Send"
              to post
            </p>

            <div class="mb-auto mt-5 flex flex-col self-center rounded-[10px] bg-section-bg px-[10px] py-[6px]">
              <div class="font-inter text-[12px] leading-4 text-subtitle">
                Your balance
              </div>
              <div class="self-center text-center font-inter text-[13px] leading-[18px] text-text">
                {yokenAmountToFloat(
                  meQuery.data?.wallet?.tokens.yo ?? "0",
                ).toFixed(0)}{" "}
                Yo
              </div>
            </div>

            <button
              type="button"
              class={clsxString("mb-4 mt-7", buttonClass)}
              onClick={() => {
                props.onSend();
              }}
            >
              Send
            </button>
          </section>
        </Match>
      </Switch>
    </div>
  );
};
