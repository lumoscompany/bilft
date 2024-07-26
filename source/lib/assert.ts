export function assertOk(value: unknown): asserts value {
  if (!value) {
    throw new Error("Assertion failed " + value);
  }
}
