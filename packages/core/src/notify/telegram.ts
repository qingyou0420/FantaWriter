import type { NotifyFormat } from "./format.js";

export interface TelegramConfig {
  readonly botToken: string;
  readonly chatId: string;
}

export async function sendTelegram(
  config: TelegramConfig,
  message: string,
  format: NotifyFormat = "markdown",
): Promise<void> {
  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: message,
      // Plain-text mode: omit parse_mode so Telegram renders the message as-is.
      ...(format === "markdown" ? { parse_mode: "Markdown" } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram send failed: ${response.status} ${body}`);
  }
}
