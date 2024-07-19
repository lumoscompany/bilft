import { createTransitionPresence, useCleanup } from "@/lib/solid";
import { type StyleProps } from "@/lib/types";
import { useNavigate, useSearchParams } from "@solidjs/router";
import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
  type Accessor,
  type JSX,
} from "solid-js";
import { Portal } from "solid-js/web";
import { scrollableElement } from "./scroll";

const useModalNavigation = ({
  onClose,
  show: _show,
}: {
  onClose(): void;
  show: Accessor<boolean>;
}) => {
  const show = createMemo(_show);

  const [params, setParams] = useSearchParams<{
    modals?: string;
  }>();
  const navigate = useNavigate();

  let isSet = false;
  createEffect(() => {
    if (!show()) {
      return;
    }

    const id = Math.random().toString(16).slice(2);
    untrack(() => {
      setParams(
        {
          ...params,
          modals: params.modals ? `${params.modals}.${id}` : id,
        },
        {
          replace: false,
        },
      );
    });
    isSet = false;

    createEffect(() => {
      // expensive operation, but not a big deal
      const includesId = params.modals?.split(".").includes(id);
      if (includesId) {
        isSet = true;
        return;
      }
      if (!isSet) {
        return;
      }
      onClose();
      isSet = false;
    });

    onCleanup(() => {
      if (isSet) {
        navigate(-1);
      }
    });
  });
};

export const BottomDialog = <T,>(
  props: StyleProps & {
    when: T | undefined | null | false;
    onClose(): void;
    children: (accessor: Accessor<NoInfer<T>>) => JSX.Element;
  },
) => {
  const [dialogRef, setDialogRef] = createSignal<HTMLDialogElement>();

  const transitionPresence = createTransitionPresence({
    when: () => props.when,
    element: dialogRef,
  });
  useModalNavigation({
    onClose: () => props.onClose(),
    show: () => transitionPresence.status() !== "hidden",
  });

  createEffect(() => {
    if (!transitionPresence.present()) {
      return;
    }

    const curOverflowY = scrollableElement.style.overflowY;
    scrollableElement.style.overflowY = "clip";
    onCleanup(() => {
      scrollableElement.style.overflowY = curOverflowY;
    });

    useCleanup((signal) => {
      window.addEventListener(
        "keydown",
        (e) => {
          if (e.key === "Escape") {
            props.onClose();
          }
        },
        {
          signal,
        },
      );
    });
  });

  return (
    <Show when={transitionPresence.present()}>
      {(data) => (
        <Portal>
          <div
            style={
              transitionPresence.status() === "hiding" ||
              transitionPresence.status() === "presenting"
                ? {
                    "--opacity": 0,
                    "--translateY": "100%",
                  }
                : {
                    "--opacity": 1,
                    "--translateY": "0%",
                  }
            }
            ref={setDialogRef}
            class="fixed inset-0 z-50 flex flex-col contain-strict"
          >
            <button
              class="absolute inset-0 bg-black/60 opacity-[var(--opacity,0)] transition-opacity duration-300"
              onClick={() => {
                props.onClose();
              }}
            />
            <div class="mt-auto translate-y-[var(--translateY,100%)] rounded-t-[30px] bg-secondary-bg px-4 transition-transform duration-300">
              {props.children(data)}
            </div>
          </div>
          {/* <dialog
            onCancel={(e) => {
              e.preventDefault();
              props.onClose();
            }}
            ref={dialogRef}
            class="backdrop:opacity-[var(--opacity,0)] transition-transform backdrop:transition-opacity duration-300 translate-y-[var(--translateY,100%)] w-screen mx-0 bg-secondary-bg max-w-[9999999px] mb-0 px-4 outline-none backdrop:bg-black/30 rounded-t-[30px]"
          >
            {props.children(data)}
          </dialog> */}
        </Portal>
      )}
    </Show>
  );
};
