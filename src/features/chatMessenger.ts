/** How features send to a Telegram chat. bot/ implements it, so features never depend on the bot. */
export interface ChatMessenger {
  sendText(chatId: number, text: string): Promise<void>;
  /** An HTML message without link previews. */
  sendHtml(chatId: number, html: string): Promise<void>;
}
