export function sendDevLink(kind: "verify" | "reset", url: string): void {
  console.log(`[kranjang-mail] ${kind}: ${url}`);
}
