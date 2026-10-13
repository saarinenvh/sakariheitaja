import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ dotenvConfig: vi.fn() }));
vi.mock("dotenv", () => ({ default: { config: mocks.dotenvConfig }, config: mocks.dotenvConfig }));

import type { Transformer } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { createBot } from "../bot";
import { messageLengthGuard } from "../messageLimit";

const BOT_INFO: UserFromGetMe = {
  id: 1, is_bot: true, first_name: "Sakke", username: "sakke_test_bot", can_join_groups: true,
  can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false,
  has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false,
};

it("creates the bot without loading an environment file; config.ts loads ENV_FILE once", () => {
  expect(createBot("123:abc").token).toBe("123:abc");
  expect(mocks.dotenvConfig).not.toHaveBeenCalled();
});

it("sends a handler's replies through the length guard too", async () => {
  const bot = createBot("123:abc");
  bot.botInfo = BOT_INFO;
  let handlerTransformers: Transformer[] = [];
  bot.command("hepit", ctx => {
    handlerTransformers = ctx.api.config.installedTransformers();
  });

  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: 1, date: 0, chat: { id: -100, type: "group", title: "SakariPelit" }, from: { id: 42, is_bot: false, first_name: "Ville" },
      text: "/hepit", entities: [{ type: "bot_command", offset: 0, length: 6 }],
    },
  });

  expect(bot.api.config.installedTransformers()).toEqual([messageLengthGuard]);
  expect(handlerTransformers).toEqual([messageLengthGuard]);
});
