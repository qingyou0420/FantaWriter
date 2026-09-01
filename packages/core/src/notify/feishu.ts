import type { NotifyFormat } from "./format.js";

export interface FeishuConfig {
  readonly webhookUrl: string;
}

export async function sendFeishu(
  config: FeishuConfig,
  title: string,
  content: string,
  format: NotifyFormat = "markdown",
): Promise<void> {
  const payload = format === "text"
    ? {
        msg_type: "text",
        content: { text: `${title}\n\n${content}` },
      }
    : {
        msg_type: "interactive",
        card: {
          header: {
            title: { tag: "plain_text", content: title },
            template: "blue",
          },
          elements: [
            {
              tag: "markdown",
              content,
            },
          ],
        },
      };
  const response = await fetch(config.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Feishu send failed: ${response.status} ${body}`);
  }
}
