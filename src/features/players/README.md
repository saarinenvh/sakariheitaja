# Players

The players a chat follows. Live scoring tracks a round player when the chat has added exactly
that Metrix name.

## Entry points

| Entry point | Called by |
| --- | --- |
| `addToGroup`, `removeFromGroup`, `getGroupPlayers` | `/lisaa`, `/poista`, `/pelaajat` (`telegram/commands/players/`) |
| `db/playerRepository.findByChatId` | live scoring, for the chat's tracked players |

## Data

Owns the `players` and `player_to_chat` tables (`db/`).

## Files

| File | Does |
| --- | --- |
| `players.ts` | Adds a player to a chat (creating the player when new) and removes them. |
| `db/` | The `Player` entity and `playerRepository`. |
