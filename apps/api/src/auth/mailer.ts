export function sendDevLink(kind: "verify" | "reset", url: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[kranjang-mail] ${kind}: ${url}`);
  }
}
