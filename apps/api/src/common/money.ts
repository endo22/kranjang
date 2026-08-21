export function asNumber(value: { toString(): string } | number | string): number {
  return Number(value);
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundQty(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
