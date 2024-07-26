/**
 * Naming convention has intention how well it will go if prefix function name with module name
 * @example ```ts
 * const NumberHelper = {
 *   pow(item: number, factor: number) => item ** factor
 * }
 * const NumberHelperPow = (item: number, factor: number) => item ** factor
 * ```
 */

export type PxString = `${number}px`;
export const PxStringFromNumber = (value: number): PxString => `${value}px`;
