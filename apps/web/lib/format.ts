export function formatRp(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

export function todayIso() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
