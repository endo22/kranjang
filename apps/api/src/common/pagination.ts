export function parsePagination(limitRaw?: string, offsetRaw?: string) {
  const parsedLimit = Number(limitRaw);
  const parsedOffset = Number(offsetRaw);
  const limit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, Math.trunc(parsedLimit))) : 50;
  const offset = Number.isFinite(parsedOffset) ? Math.max(0, Math.trunc(parsedOffset)) : 0;
  return { limit, offset };
}

export function paginated<T>(items: T[], total: number) {
  return { items, total };
}
