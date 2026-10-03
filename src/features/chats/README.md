# Chats

The groups the bot is in.

## Entry points

| Entry point | Called by |
| --- | --- |
| `db/chatRepository.addIfAbsent` | `telegram/chatRegistration.ts`, when the bot is added to a group or a group is created with it; `/follow`, in case the bot missed the join |

## Data

Owns the `chats` table (`db/`).

## Files

Only `db/`: the `Chat` entity and `chatRepository`. There is no logic beyond storing a chat.
