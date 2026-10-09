# Chats

The groups the bot is in.

## Entry points

| Entry point | Called by |
| --- | --- |
| `addIfAbsent` (`db/chatRepository.ts`) | `telegram/chatRegistration.ts`, when the bot is added to a group or a group is created with it; `/follow`, in case the bot missed the join |
| `findBotPin`, `saveBotPin` | `telegram/botPin.ts`: the one message the bot keeps pinned in the chat |
| `listChatsWithBotPin` | the daily pinned list refresh (`telegram/commands/games/pinnedList.ts`) |

## Data

Owns the `chats` table (`db/`): the chat's id, its name when the bot met it, and the message the
bot has pinned there (`bot_pinned_message_id`, migration `AddChatBotPinnedMessage`). The bot keeps
at most one pin per chat and only ever unpins or edits that one, never a pin someone else made.

## Files

Only `db/`: the `Chat` entity and `chatRepository`. There is no logic beyond storing a chat.
