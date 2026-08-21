export type SendMailInput = {
  to: string[];
  subject: string;
  text: string;
  /** Jika diisi, log dev memakai format `[kranjang-mail] ${devKind}: ${text}` (auth verify/reset). */
  devKind?: "verify" | "reset";
};

function resolveRecipients(to: string[]) {
  const override = process.env.MAIL_TO_OVERRIDE?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (override && override.length > 0) {
    return override;
  }
  return to.filter(Boolean);
}

export async function sendMail(input: SendMailInput): Promise<{ delivered: boolean; to: string[] }> {
  const recipients = resolveRecipients(input.to);
  const apiKey = process.env.RESEND_API_KEY;

  if (apiKey && process.env.MAIL_FROM && recipients.length > 0) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: recipients,
        subject: input.subject,
        text: input.text,
      }),
    }).catch((error) => {
      console.error("[kranjang-mail] resend failed", error);
    });
    return { delivered: true, to: recipients };
  }

  if (process.env.NODE_ENV !== "production") {
    if (input.devKind) {
      console.log(`[kranjang-mail] ${input.devKind}: ${input.text}`);
    } else {
      console.log(`[kranjang-mail] ${input.subject} -> ${recipients.join(",") || "(none)"}`);
      console.log(input.text);
    }
  }

  return { delivered: false, to: recipients };
}

export async function sendDevLink(kind: "verify" | "reset", url: string): Promise<void> {
  await sendMail({
    to: [],
    subject: kind === "verify" ? "Verifikasi email Kranjang" : "Reset password Kranjang",
    text: url,
    devKind: kind,
  });
}
