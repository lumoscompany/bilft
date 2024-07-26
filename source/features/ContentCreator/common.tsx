import type { model } from "@/api";

export const CheckboxUI = () => (
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

export type ModalStatus =
  | {
      type: "error";
      data: model.WalletError;
    }
  | {
      type: "success";
      data: null;
    };

export const ErrorHelper = {
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
