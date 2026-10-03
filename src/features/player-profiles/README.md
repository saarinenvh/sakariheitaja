# Player profiles

Each tracked player's form, per chat: games played, average place as a share of the division's
field, and hot, cold or steady form. Updated at each round end, once per competition. Nothing
reads them into commentary yet; where they belong for good is ticket EfY0S63X.

## Entry points

| Entry point | Called by |
| --- | --- |
| `updateProfiles` | `finishRound` (`../live-scoring/roundFinalizer.ts`) |
| `getProfile`, `buildProfileSnippet` | no caller yet |

## Data

Stored in `player_profiles.json` in `DATA_DIR`, not in the database (see
`docs/architecture/data.md`).

## Files

| File | Does |
| --- | --- |
| `playerProfiles.ts` | The store: reads profiles, scores each player's place against their division, saves. |
| `policy.ts` | A profile after one more round: the running average and the form rule. |
| `prompts.ts` | A profile as a Finnish phrase for the model. |
