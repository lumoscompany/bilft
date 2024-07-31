import { keysFactory, type CreateNoteRequest } from "@/api/api";
import type { NoteWithComment } from "@/api/model";
import {
  AvatarIcon,
  AvatarIconEntryLoading,
  AvatarIconEntryMakeGenerated,
  AvatarIconEntryMakeLoaded,
} from "@/features/BoardNote/AvatarIcon";
import { BoardNote } from "@/features/BoardNote/BoardNote";
import { LoadingSvg } from "@/features/LoadingSvg";
import {
  ProfileIdAddPrefix,
  ProfileIdWithoutPrefixCheck,
  getSelfUserId,
  isEqualIds,
  type ProfileIdWithoutPrefix,
} from "@/features/idUtils";
import {
  AnonymousHintIcon,
  ArrowPointUp,
  PrivateHintIcon,
  PublicHintIcon,
  ShareProfileIcon,
} from "@/icons";
import { assertOk } from "@/lib/assert";
import { clsxString } from "@/lib/clsxString";
import { type StyleProps } from "@/lib/types";
import { queryClient } from "@/queryClient";
import { A, useParams } from "@solidjs/router";
import { createInfiniteQuery, createQuery } from "@tanstack/solid-query";
import {
  Match,
  Show,
  Switch,
  batch,
  createMemo,
  type ParentProps,
} from "solid-js";
import { Virtualizer } from "virtua/solid";
import { BottomDialog } from "../BottomDialog";
import { createCommentsPageUrl } from "../CommentsPage/utils";
import { createInputState } from "../ContentCreator/CommentCreator";
import { PostInput } from "../ContentCreator/PostInput";
import {
  SEND_ANONYMOUS_DESCRIPTION,
  SEND_ANONYMOUS_TITLE,
  SEND_PRIVATE_DESCRIPTION,
  SEND_PRIVATE_TITLE,
  SEND_PUBLIC_DESCRIPTION,
  SEND_PUBLIC_TITLE,
  VariantEntryMake,
  VariantSelector,
} from "../ContentCreator/VariantSelector";
import { WalletModalContent } from "../ContentCreator/WalletModal";
import { createNoteMutation } from "../ContentCreator/post";
import {
  createOptimisticModalStatus,
  createUnlinkMutation,
} from "../ContentCreator/shared";
import { useInfiniteScroll } from "../infiniteScroll";
import { scrollableElement, setVirtualizerHandle } from "../scroll";
import { utils } from "../telegramIntegration";
import { CommentNoteFooterLayout } from "./CommantNoteFooterLayour";

const UserStatus = (props: ParentProps<StyleProps>) => (
  <article class={clsxString("relative flex flex-col", props.class ?? "")}>
    <svg
      class="absolute left-0 top-0 text-accent"
      width="21"
      height="20"
      viewBox="0 0 21 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 0.04006C4.46481 4.16015 5.65964 5.81985 5.65964 19.9819C20.3365 16.2557 21.9956 13.836 19.8257 7.41852C11.0669 2.45015 2.95905 -0.37397 0 0.04006Z"
        fill="currentColor"
      />
    </svg>
    <div class="ml-1 min-h-[38px] self-start rounded-3xl bg-accent px-4 py-2">
      {props.children}
    </div>
  </article>
);

const UserProfilePage = (props: {
  isSelf: boolean;
  id: ProfileIdWithoutPrefix;
}) => {
  const boardQuery = createQuery(() =>
    keysFactory.board({
      value: ProfileIdAddPrefix(props.id),
    }),
  );

  const getBoardId = () => props.id;

  const notesQuery = createInfiniteQuery(() => ({
    ...keysFactory.notes({
      board: getBoardId(),
    }),
    reconcile: "id",
  }));
  const notes = createMemo(() =>
    notesQuery.isSuccess ? notesQuery.data.pages.flatMap((it) => it.data) : [],
  );

  useInfiniteScroll(() => {
    if (notesQuery.hasNextPage && !notesQuery.isFetchingNextPage) {
      notesQuery.fetchNextPage();
    }
  });

  const beforeNavigateToComment = (note: NoteWithComment) => {
    const boardId = boardQuery.data?.id;
    if (!boardId) return;

    const targetQueryKey = keysFactory.note(note.id).queryKey;
    queryClient.setQueryData(
      targetQueryKey,
      (data) =>
        data ?? {
          ...note,
          boardId,
        },
    );
    queryClient.setQueryDefaults(targetQueryKey, {
      staleTime: 1_000,
    });
  };

  const variants = [
    VariantEntryMake(
      "public",
      SEND_PUBLIC_TITLE,
      SEND_PUBLIC_DESCRIPTION,
      PublicHintIcon,
    ),
    VariantEntryMake(
      "anonym",
      SEND_ANONYMOUS_TITLE,
      SEND_ANONYMOUS_DESCRIPTION,
      AnonymousHintIcon,
    ),
    VariantEntryMake(
      "private",
      SEND_PRIVATE_TITLE,
      SEND_PRIVATE_DESCRIPTION,
      PrivateHintIcon,
    ),
  ] as const;
  type Variant = (typeof variants)[number]["value"];
  const [
    [inputValue, setInputValue],
    [walletError, setWalletError],
    [variant, setVariant],
  ] = createInputState<Variant, true>(variants[0].value);

  const addNoteMutation = createNoteMutation(
    () => {
      const id = boardQuery.data?.id;
      assertOk(id);
      return id;
    },
    async () => {
      batch(() => {
        setWalletError(null);
        setInputValue("");
      });
    },
    () => {
      setWalletError(null);
    },
    (error) => {
      setWalletError(error);
    },
  );

  const unlinkMutation = createUnlinkMutation(
    walletError,
    setWalletError,
    setWalletError,
  );

  const optimisticModalStatus = createOptimisticModalStatus(walletError);

  const variantMap = {
    public: "public",
    anonym: "public-anonymous",
    private: "private",
  } satisfies Record<Variant, CreateNoteRequest["type"]>;

  const sendNote = (type: Variant) => {
    addNoteMutation.mutate({
      content: inputValue(),
      board: props.id,
      type: variantMap[type],
    });
  };

  const name = () =>
    boardQuery.data?.profile?.title ?? boardQuery.data?.name ?? " ";

  return (
    <main class="flex min-h-screen flex-col pb-6 pt-4 text-text">
      <section class="sticky top-0 z-10 mx-2 flex flex-row items-center gap-3 bg-secondary-bg px-2 py-2">
        <AvatarIcon
          size={48}
          entry={(() => {
            let photo: string | undefined;
            if ((photo = boardQuery.data?.profile?.photo)) {
              return AvatarIconEntryMakeLoaded(photo);
            }

            let _name: string;
            if ((_name = name()) && _name !== " ") {
              return AvatarIconEntryMakeGenerated(_name, props.id);
            }
            return AvatarIconEntryLoading;
          })()}
        />
        <div class="flex flex-1 flex-row justify-between">
          <div class="flex flex-1 flex-col">
            <p class="relative font-inter text-[20px] font-bold leading-6">
              {name()}
              <Show when={boardQuery.isLoading}>
                <div class="absolute inset-y-1 left-0 right-[50%] animate-pulse rounded-xl bg-gray-600" />
              </Show>
            </p>
            {/* TODO: add date */}
            {/* <p class="text-[15px] font-inter leading-[22px]">Member since Jan 2021</p> */}
          </div>

          <button
            class="transition-opacity active:opacity-50"
            onClick={() => {
              const url = new URL(import.meta.env.VITE_SELF_BOT_WEBAPP_URL);
              url.searchParams.set("startapp", `id${props.id}`);

              const shareText =
                boardQuery.data?.profile?.title ?? boardQuery.data?.name ?? "";
              const shareUrl = url.toString();
              utils.shareURL(shareUrl, shareText);
            }}
          >
            <span class="sr-only">Share profile</span>
            <ShareProfileIcon class="text-accent" />
          </button>
        </div>
      </section>

      <UserStatus class="mx-4 mt-2 text-button-text">
        {boardQuery.isLoading
          ? "Loading..."
          : boardQuery.data?.profile?.description}
      </UserStatus>

      <div class={"px-4 pt-2 contain-layout contain-style"}>
        <PostInput
          preventScrollTouches={false}
          isLoading={addNoteMutation.isPending}
          onSubmit={() => {
            if (!inputValue) {
              return;
            }

            sendNote(variant());
          }}
          value={inputValue()}
          onChange={setInputValue}
          showChildren
        >
          <VariantSelector
            estimatePopoverSize={110}
            setValue={setVariant}
            value={variant()}
            variants={variants}
          />
        </PostInput>

        <BottomDialog
          onClose={() => {
            setWalletError(null);
          }}
          when={optimisticModalStatus()}
        >
          {(status) => (
            <WalletModalContent
              onSend={() => {
                sendNote(variant());
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
                sendNote("public");
              }}
            />
          )}
        </BottomDialog>
      </div>

      <section class="mt-6 flex flex-1 flex-col">
        <Switch>
          <Match when={notesQuery.isLoading}>
            <div class="flex w-full flex-1 items-center justify-center">
              <LoadingSvg class="w-8 fill-accent text-transparent" />
            </div>
          </Match>
          <Match when={notes().length === 0}>
            <div class="flex flex-col items-center p-8">
              <img
                src="/assets/empty-notes.webp"
                class="aspect-square w-32"
                alt="Questioning banana"
              />
              <strong class="mt-6 text-center font-inter text-[20px] font-medium leading-[25px]">
                It's still empty
              </strong>
              <p class="text-center font-inter text-[17px] leading-[22px] text-subtitle">
                Be the first to post here!
              </p>
            </div>
          </Match>
          <Match when={notes().length > 0}>
            <Virtualizer
              ref={(handle) => setVirtualizerHandle(handle)}
              data={notes()}
              itemSize={160}
              scrollRef={scrollableElement}
              startMargin={282}
            >
              {(note) => (
                <BoardNote class="mx-4 pb-4 contain-content">
                  <BoardNote.Card>
                    <Switch
                      fallback={
                        <BoardNote.AnonymousHeader
                          private={note.type === "private"}
                          createdAt={note.createdAt}
                        />
                      }
                    >
                      <Match when={note.author}>
                        {(author) => (
                          <BoardNote.AuthorHeader
                            name={author().name}
                            avatarUrl={author().photo}
                            authorId={author().id}
                            createdAt={note.createdAt}
                          />
                        )}
                      </Match>
                    </Switch>
                    <BoardNote.Divider class="pointer-events-none" />
                    <BoardNote.ContentLink
                      href={createCommentsPageUrl(note, false)}
                      onClick={() => {
                        beforeNavigateToComment(note);
                      }}
                    >
                      {note.content}
                    </BoardNote.ContentLink>
                  </BoardNote.Card>
                  <Show when={boardQuery.data?.id}>
                    {(boardId) => (
                      <CommentFooter
                        note={note}
                        href={createCommentsPageUrl(note, false)}
                        onNavigateNote={beforeNavigateToComment}
                        boardId={boardId()}
                      />
                    )}
                  </Show>
                </BoardNote>
              )}
            </Virtualizer>

            <Switch>
              <Match when={notesQuery.isFetchingNextPage}>
                <div role="status" class="mx-auto mt-6">
                  <LoadingSvg class="w-8 fill-accent text-transparent" />
                  <span class="sr-only">Next boards is loading</span>
                </div>
              </Match>
              <Match when={notes().length >= 8}>
                <button
                  onClick={() => {
                    scrollableElement.scrollTo({
                      behavior: "smooth",
                      top: 0,
                    });
                  }}
                  class="mx-auto mt-6 flex items-center gap-x-2 font-inter text-[17px] leading-[22px] text-accent transition-opacity active:opacity-50 active:ease-out"
                >
                  Back to top
                  <ArrowPointUp />
                </button>
              </Match>
            </Switch>
          </Match>
        </Switch>
      </section>
    </main>
  );
};

export const ProfilePage = () => {
  const selfUserId = getSelfUserId().toString();
  const params = useParams();
  const idWithoutPrefix = () => {
    assertOk(ProfileIdWithoutPrefixCheck(params.idWithoutPrefix));
    return params.idWithoutPrefix;
  };

  return (
    <UserProfilePage
      id={idWithoutPrefix()}
      isSelf={isEqualIds(selfUserId, idWithoutPrefix())}
    />
  );
};

function CommentFooter(props: {
  boardId: string;
  note: NoteWithComment;
  onNavigateNote(note: NoteWithComment, boardId: string): void;
  href: string;
}) {
  return (
    <div class="mx-4 mt-2 flex self-stretch">
      <Switch>
        <Match when={props.note.lastComment}>
          {(lastComment) => (
            <CommentNoteFooterLayout
              commentsCount={props.note.commentsCount}
              lastComment={lastComment()}
              href={props.href}
              onClick={() => props.onNavigateNote(props.note, props.boardId)}
            />
          )}
        </Match>
        <Match when={props.note.commentsCount === 0}>
          <A
            href={props.href}
            onClick={() => props.onNavigateNote(props.note, props.boardId)}
            class="ml-auto font-inter text-[15px] leading-[18px] text-accent transition-opacity active:opacity-70"
          >
            post you reply
          </A>
        </Match>
      </Switch>
    </div>
  );
}
