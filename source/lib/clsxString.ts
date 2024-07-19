export const clsxString = (...items: string[]) => {
  let res = "";
  for (const it of items) {
    if (it.length === 0) {
      continue;
    }

    if (res.length > 0) {
      res += " ";
    }
    res += it;
  }

  return res;
};
