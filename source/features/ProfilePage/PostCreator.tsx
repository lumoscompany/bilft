import type { model } from "@/api";
import {
  fetchMethod,
  fetchMethodCurry,
  getWalletError,
  keysFactory,
  type CreateNoteRequest,
} from "@/api/api";
import type { CreateCommentRequest } from "@/api/model";
import {
  assertOk,
  clsxString,
  platform,
  utils,
  type StyleProps,
} from "@/common";
import { BottomDialog } from "@/features/BottomDialog";
import {
  ArrowPointDownIcon,
  ArrowUpIcon,
  CloseIcon,
  RefreshIcon,
  SuccessIcon,
  UnlinkIcon,
  YoCoinIcon,
} from "@/icons";
import {
  SignalHelper,
  createTransitionPresence,
  mergeRefs,
  useCleanup,
  type Ref,
} from "@/lib/solid";
import { useTonConnectUI } from "@/lib/ton-connect-solid";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { postEvent } from "@tma.js/sdk";
import { AxiosError } from "axios";
import {
  Match,
  Show,
  Switch,
  batch,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
  type Accessor,
  type ComponentProps,
} from "solid-js";
import { LoadingSvg } from "../LoadingSvg";
import { disconnectWallet } from "../SetupTonWallet";
import { useKeyboardStatus } from "../keyboardStatus";

const buttonClass =
  "transition-transform duration-200 active:scale-[98%] bg-accent p-[12px] font-inter text-[17px] leading-[22px] text-button-text text-center rounded-xl self-stretch";

const YOKEN_DECIMALS = 9;

const yokenAmountToFloat = (amount: string) =>
  Number(amount) / 10 ** YOKEN_DECIMALS;
const trimAddress = (address: string) =>
  `${address.slice(0, 4)}...${address.slice(-4)}`;

const CheckboxUI = () => (
  <div class="relative isolate flex aspect-square w-5 items-center justify-center rounded-md border-[1.5px] border-accent">
    <div class="absolute inset-0 -z-10 rounded-[3px] bg-accent opacity-0 transition-opacity group-[[data-checked]]:opacity-100" />
    <svg
      class="text-white opacity-0 transition-opacity group-[[data-checked]]:opacity-100"
      width="10"
      height="8"
      viewBox="0 0 10 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0.75 3.99992L3.58 6.82992L9.25 1.16992"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
);

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

// [TODO]: share number with backend

const MAX_POST_LENGTH = 1200;
function PostInput(
  props: StyleProps & {
    value: string;
    onChange: (s: string) => void;
    onSubmit: () => void;
    isLoading: boolean;
    isAnonymous: boolean;
    setIsAnonymous: (status: boolean) => void;
    ref?: Ref<HTMLFormElement>;
  },
) {
  let inputRef!: HTMLTextAreaElement | undefined;
  let formRef!: HTMLFormElement | undefined;
  const trimmedText = createMemo(() => props.value.trim());
  const isEmpty = () => trimmedText().length === 0;
  const symbolsRemaining = () => MAX_POST_LENGTH - trimmedText().length;
  const [isFocused, setIsFocused] = createSignal(false);

  if (platform === "ios") {
    createEffect(() => {
      if (!isFocused()) {
        return;
      }

      useCleanup((signal) => {
        let state: null | "start" | "move" = null;
        window.addEventListener("touchstart", () => (state = "start"), {
          signal,
        });
        window.addEventListener("touchmove", () => (state = "move"), {
          signal,
        });
        window.addEventListener("touchcancel", () => (state = null), {
          signal,
        });
        window.addEventListener("touchend", () => (state = null), {
          signal,
        });
        window.addEventListener(
          "scroll",
          (e) => {
            if (
              inputRef &&
              state === "move" &&
              e.target &&
              (e.target instanceof Element || e.target instanceof Document) &&
              !formRef?.contains(e.target)
            ) {
              inputRef.blur();
            }
          },
          {
            passive: true,
            signal,
            capture: true,
          },
        );
      });
    });
  }
  const { isKeyboardOpen } = useKeyboardStatus();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        props.onSubmit();
      }}
      ref={mergeRefs(formRef, props.ref)}
      class={clsxString(
        "flex flex-col items-stretch justify-between gap-[10px] overflow-hidden rounded-[20px] border border-[#AAA] border-opacity-15 bg-section-bg p-4",
        props.class ?? "",
      )}
    >
      <div
        class='-mr-4 grid max-h-[calc(var(--tgvh)*40)] flex-1 grid-cols-1 overflow-y-auto pr-3 font-inter text-[16px] leading-[21px] [scrollbar-gutter:stable] after:invisible after:whitespace-pre-wrap after:break-words after:font-[inherit] after:content-[attr(data-value)_"_"] after:[grid-area:1/1/2/2] [&>textarea]:[grid-area:1/1/2/2]'
        data-value={props.value}
      >
        <textarea
          placeholder="Text me here..."
          rows={1}
          value={props.value}
          onInput={(e) => {
            props.onChange(e.target.value);
          }}
          onFocus={() => {
            setIsFocused(true);
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
          inert={props.isLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey && props.value.length > 0) {
              e.preventDefault();
              props.onSubmit();
            }
          }}
          ref={inputRef}
          class="w-full max-w-full resize-none overflow-hidden break-words border-none bg-transparent placeholder:select-none focus:border-none focus:outline-none"
        />
      </div>
      <div class="h-separator w-full bg-separator" />
      <div class="flex flex-row items-center p-[2px]">
        <label
          class="group mr-auto flex cursor-pointer select-none flex-row items-center"
          data-checked={props.isAnonymous ? "" : undefined}
        >
          <input
            onChange={(e) => {
              // preventing keyboard from closing
              if (isKeyboardOpen()) {
                inputRef?.focus();
              }
              props.setIsAnonymous(e.target.checked);
            }}
            checked={props.isAnonymous}
            type="checkbox"
            class="invisible h-0 w-0"
          />
          <CheckboxUI />

          <div class="ml-2 font-inter text-[16px] leading-[22px] text-subtitle">
            Send anonymously
          </div>
        </label>

        <Show when={symbolsRemaining() < MAX_POST_LENGTH / 4}>
          <p
            class={clsxString(
              "ml-auto font-inter text-[16px] leading-[16px]",
              symbolsRemaining() > 0 ? "text-hint" : "text-destructive-text",
            )}
          >
            {symbolsRemaining()}
          </p>
        </Show>
        <button
          disabled={isEmpty() || props.isLoading || symbolsRemaining() <= 0}
          class="relative ml-2 flex aspect-square w-7 items-center justify-center overflow-hidden rounded-full [&:disabled>svg>path]:fill-gray-400 [&>svg>path]:fill-accent"
        >
          <Show fallback={<ArrowUpIcon />} when={props.isLoading}>
            <div role="status">
              <LoadingSvg class="w-7 fill-gray-300 text-gray-600" />
              <span class="sr-only">Loading...</span>
            </div>
          </Show>
        </button>
      </div>
    </form>
  );
}

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

const ModalContent = (props: {
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

type ModalStatus =
  | {
      type: "error";
      data: model.WalletError;
    }
  | {
      type: "success";
      data: null;
    };

const ErrorHelper = {
  tryCatchAsync: async <T, TPossibleError>(
    callback: () => Promise<Exclude<T, null>>,
    isPossibleError: (value: unknown) => value is Exclude<TPossibleError, null>,
  ): Promise<[null, TPossibleError] | [T, null]> =>
    ErrorHelper.tryCatchAsyncMap(callback, (error) => {
      const isError = isPossibleError(error);
      if (!isError) {
        return null;
      }
      return error;
    }),
  tryCatchAsyncMap: async <T, TPossibleError>(
    callback: () => Promise<Exclude<T, null>>,
    mapAndFilterError: (value: unknown) => null | Exclude<TPossibleError, null>,
  ): Promise<[null, TPossibleError] | [T, null]> => {
    try {
      return [await callback(), null];
    } catch (err) {
      const target = mapAndFilterError(err);

      if (target === null) {
        throw err;
      }
      return [null, target];
    }
  },
};

// hard to generalize
export const CommentCreator = (
  props: { noteId: string; onCreated(): void; boardId: string } & StyleProps & {
      ref?: Ref<HTMLFormElement>;
    },
) => {
  const queryClient = useQueryClient();

  const [inputValue, setInputValue] = createSignal("");
  const [isAnonymous, setIsAnonymous] = createSignal(false);
  const [walletError, setWalletError] = createSignal<model.WalletError | null>(
    null,
  );
  const addCommentMutation = createMutation(() => ({
    mutationFn: (request: CreateCommentRequest) => {
      return ErrorHelper.tryCatchAsyncMap(
        () => fetchMethod("/note/createComment", request),
        (error) => {
          if (typeof error !== "object" && error === null) {
            return null;
          }

          if (!(error instanceof AxiosError) || !error.response) {
            return null;
          }
          const walletError = getWalletError(error.response);
          if (!walletError) {
            return null;
          }

          return walletError;
        },
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: keysFactory.comments({
          noteId: props.noteId,
        }).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: keysFactory.notes({
          board: props.boardId,
        }).queryKey,
      });
    },
    onMutate: ({ type }) => {
      if (type === "public") {
        setWalletError(null);
      }
    },
    onSuccess: ([comment, walletError]) => {
      if (!comment) {
        setWalletError(walletError);
        return;
      }
      queryClient.setQueryData(
        keysFactory.comments({
          noteId: props.noteId,
        }).queryKey,
        (data) => {
          if (!data || !data.pages || data.pages.length < 1) {
            return data;
          }
          const lastPage = data.pages.at(-1);
          assertOk(lastPage);

          const pages = data.pages.slice(0, -1);

          pages.push({
            count: lastPage.count,
            items: [...lastPage.items, comment],
          });

          return {
            pageParams: data.pageParams,
            pages,
          };
        },
      );

      batch(() => {
        setInputValue("");
        setIsAnonymous(false);
        setWalletError(null);
        props.onCreated();
      });
    },
  }));

  const unlinkMutation = createMutation(() => ({
    mutationFn: fetchMethodCurry("/me/unlinkWallet"),
    onMutate: () => {
      const curWalletError = walletError();
      if (curWalletError) {
        setWalletError({
          error: {
            reason: "no_connected_wallet",
            payload: curWalletError.error.payload,
          },
        });
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
      setWalletError(ctx?.curWalletError ?? null);
    },
  }));

  const meQuery = createQuery(() => keysFactory.me);

  const hasEnoughMoney = createMemo(() => {
    const curWalletError = walletError();
    const tokensBalance = meQuery.data?.wallet?.tokens.yo;
    if (!curWalletError || !tokensBalance) {
      return;
    }
    return (
      BigInt(curWalletError.error.payload.requiredBalance) <=
      BigInt(tokensBalance)
    );
  });

  const modalStatus = (): ModalStatus | null =>
    SignalHelper.map(walletError, (error) =>
      !error
        ? null
        : hasEnoughMoney()
          ? {
              type: "success",
              data: null,
            }
          : {
              type: "error",
              data: error,
            },
    );
  const sendContent = (anonymous: boolean) =>
    addCommentMutation.mutate({
      noteID: props.noteId,
      content: inputValue(),
      type: anonymous ? "anonymous" : "public",
    });

  return (
    <>
      <PostInput
        ref={props.ref}
        isAnonymous={isAnonymous()}
        setIsAnonymous={setIsAnonymous}
        class={props.class}
        isLoading={addCommentMutation.isPending}
        onSubmit={() => {
          if (!inputValue) {
            return;
          }

          sendContent(isAnonymous());
        }}
        value={inputValue()}
        onChange={setInputValue}
      />
      <BottomDialog
        onClose={() => {
          setWalletError(null);
        }}
        when={modalStatus()}
      >
        {(status) => (
          <ModalContent
            onSend={() => {
              sendContent(isAnonymous());
              setWalletError(null);
            }}
            status={status()}
            onClose={() => {
              setWalletError(null);
            }}
            onUnlinkWallet={() => {
              unlinkMutation.mutate();
            }}
            onSendPublic={() => {
              sendContent(false);
            }}
          />
        )}
      </BottomDialog>
    </>
  );
};

export const PostCreator = (props: { boardId: string } & StyleProps) => {
  const queryClient = useQueryClient();

  const [inputValue, setInputValue] = createSignal("");
  const [isAnonymous, setIsAnonymous] = createSignal(false);
  const [walletError, setWalletError] = createSignal<model.WalletError | null>(
    null,
  );
  const addNoteMutation = createMutation(() => ({
    mutationFn: (request: CreateNoteRequest) => {
      return ErrorHelper.tryCatchAsyncMap(
        () => fetchMethod("/board/createNote", request),
        (error) => {
          if (typeof error !== "object" && error === null) {
            return null;
          }

          if (!(error instanceof AxiosError) || !error.response) {
            return null;
          }
          const walletError = getWalletError(error.response);
          if (!walletError) {
            return null;
          }

          return walletError;
        },
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: keysFactory.notes({
          board: props.boardId,
        }).queryKey,
      });
    },
    onMutate: ({ type }) => {
      if (type === "public") {
        setWalletError(null);
      }
    },
    onSuccess: ([note, walletError]) => {
      if (!note) {
        setWalletError(walletError);
        return;
      }
      queryClient.setQueryData(
        keysFactory.notes({
          board: props.boardId,
        }).queryKey,
        (data) => {
          if (!data || !data.pages || data.pages.length < 1) {
            return data;
          }
          const firstPage = data.pages[0];

          return {
            pageParams: data.pageParams,
            pages: [
              {
                data: [
                  {
                    ...note,
                    commentsCount: 0,
                  },
                  ...firstPage.data,
                ],
                next: firstPage.next,
              },
              ...data.pages.slice(1),
            ],
          };
        },
      );

      batch(() => {
        setInputValue("");
        setIsAnonymous(false);
        setWalletError(null);
      });
    },
  }));

  const unlinkMutation = createMutation(() => ({
    mutationFn: fetchMethodCurry("/me/unlinkWallet"),
    onMutate: () => {
      const curWalletError = walletError();
      if (curWalletError) {
        setWalletError({
          error: {
            reason: "no_connected_wallet",
            payload: curWalletError.error.payload,
          },
        });
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
      setWalletError(ctx?.curWalletError ?? null);
    },
  }));

  const meQuery = createQuery(() => keysFactory.me);

  const hasEnoughMoney = createMemo(() => {
    const curWalletError = walletError();
    const tokensBalance = meQuery.data?.wallet?.tokens.yo;
    if (!curWalletError || !tokensBalance) {
      return;
    }
    return (
      BigInt(curWalletError.error.payload.requiredBalance) <=
      BigInt(tokensBalance)
    );
  });

  const modalStatus = (): ModalStatus | null =>
    SignalHelper.map(walletError, (error) =>
      !error
        ? null
        : hasEnoughMoney()
          ? {
              type: "success",
              data: null,
            }
          : {
              type: "error",
              data: error,
            },
    );
  const sendContent = (anonymous: boolean) =>
    addNoteMutation.mutate({
      board: props.boardId,
      content: inputValue(),
      type: anonymous ? "public-anonymous" : "public",
    });

  return (
    <>
      <PostInput
        isAnonymous={isAnonymous()}
        setIsAnonymous={setIsAnonymous}
        class={props.class}
        isLoading={addNoteMutation.isPending}
        onSubmit={() => {
          if (!inputValue) {
            return;
          }

          sendContent(isAnonymous());
        }}
        value={inputValue()}
        onChange={setInputValue}
      />
      <BottomDialog
        onClose={() => {
          setWalletError(null);
        }}
        when={modalStatus()}
      >
        {(status) => (
          <ModalContent
            onSend={() => {
              sendContent(isAnonymous());
              setWalletError(null);
            }}
            status={status()}
            onClose={() => {
              setWalletError(null);
            }}
            onUnlinkWallet={() => {
              unlinkMutation.mutate();
            }}
            onSendPublic={() => {
              sendContent(false);
            }}
          />
        )}
      </BottomDialog>
    </>
  );
};
