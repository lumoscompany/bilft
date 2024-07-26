export type StyleProps = {
  class?: string;
};

// Original implementation: https://github.com/sindresorhus/type-fest/blob/8a45ba048767aaffcebc7d190172d814a739feb0/source/opaque.d.ts#L116
declare const tag: unique symbol;
export type TagContainer<Token> = {
  readonly [tag]: Token;
};

type Tag<Token extends PropertyKey, TagMetadata> = TagContainer<{
  [K in Token]: TagMetadata;
}>;

export type Tagged<
  Type,
  TagName extends PropertyKey,
  TagMetadata = never,
> = Type & Tag<TagName, TagMetadata>;

export type GetTagMetadata<
  Type extends Tag<TagName, unknown>,
  TagName extends PropertyKey,
> = Type[typeof tag][TagName];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UnwrapTagged<TaggedType extends Tag<PropertyKey, any>> =
  RemoveAllTags<TaggedType>;

type RemoveAllTags<T> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Tag<PropertyKey, any>
    ? {
        [ThisTag in keyof T[typeof tag]]: T extends Tagged<
          infer Type,
          ThisTag,
          T[typeof tag][ThisTag]
        >
          ? RemoveAllTags<Type>
          : never;
      }[keyof T[typeof tag]]
    : T;

export type CreateUnit<T, TTypes extends string> = Tagged<T, "unit", TTypes>;
