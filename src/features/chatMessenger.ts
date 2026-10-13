/** Telegram refuses a message longer than this; the bot's message length guard sends a longer one in parts. */
export const TELEGRAM_MESSAGE_LIMIT = 4096;

/** How features send to a Telegram chat. bot/ implements it, so features never depend on the bot. */
export interface ChatMessenger {
  sendText(chatId: number, text: string): Promise<void>;
  /** An HTML message without link previews. */
  sendHtml(chatId: number, html: string): Promise<void>;
  /** An animation from a URL: a GIF, or a silent MP4 like Giphy's. */
  sendAnimation(chatId: number, url: string): Promise<void>;
}
