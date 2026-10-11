/** How features send to a Telegram chat. bot/ implements it, so features never depend on the bot. */
export interface ChatMessenger {
  sendText(chatId: number, text: string): Promise<void>;
  /** An HTML message without link previews. */
  sendHtml(chatId: number, html: string): Promise<void>;
  /** An animation from a URL: a GIF, or a silent MP4 like Giphy's. */
  sendAnimation(chatId: number, url: string): Promise<void>;
}
