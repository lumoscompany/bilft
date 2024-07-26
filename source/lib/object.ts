export const pick = <TObj extends object, TKeys extends keyof TObj>(
  obj: TObj,
  keys: TKeys[],
): Pick<TObj, TKeys> => {
  const res = {} as Pick<TObj, TKeys>;

  for (const key of keys) {
    res[key] = obj[key];
  }

  return res;
};
