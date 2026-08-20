export async function sendDevLink(kind: "verify" | "reset", url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && process.env.MAIL_FROM) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: process.env.MAIL_TO_OVERRIDE?.split(",") ?? [],
        subject: kind === "verify" ? "Verifikasi email Kranjang" : "Reset password Kranjang",
        text: url,
      }),
    }).catch((error) => {
      console.error("[kranjang-mail] resend failed", error);
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[kranjang-mail] ${kind}: ${url}`);
  }
}
