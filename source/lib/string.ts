export const isEmpty = (value: string) => {
  for (let i = 0; i < value.length; ++i) {
    if (value[i] !== " " && value[i] !== "\n") {
      return false;
    }
  }
  return true;
};
