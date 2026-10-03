import { z } from "zod";

// Challonge → bot, GET api.challonge.com/v1/tournaments/<slug>.json?include_participants=1&include_matches=1.
// Challonge sends dozens more tournament, participant and match settings; all of them are ignored
// like the ones shown here.

export const bracketExample = {
  tournament: {
    id: 9876543, // ignored
    name: "Example Match Play 2026",
    url: "abc123xy", // ignored
    tournament_type: "single elimination", // ignored
    state: "underway", // ignored
    started_at: "2026-09-01T10:00:00.000+03:00", // ignored
    completed_at: null, // ignored
    created_at: "2026-08-20T12:00:00.000+03:00", // ignored
    updated_at: "2026-09-15T18:30:00.000+03:00", // ignored
    participants_count: 4, // ignored
    game_name: "Disc Golf", // ignored
    full_challonge_url: "https://challonge.com/abc123xy", // ignored
    participants: [
      {
        participant: {
          id: 111,
          tournament_id: 9876543, // ignored
          name: "Player One",
          seed: 1, // ignored
          active: true, // ignored
          final_rank: null, // ignored
          checked_in: false, // ignored
          username: null, // ignored
          display_name: "Player One",
          created_at: "2026-08-20T12:05:00.000+03:00", // ignored
          updated_at: "2026-08-20T12:05:00.000+03:00", // ignored
        },
      },
      {
        participant: {
          id: 222, tournament_id: 9876543, name: "Player Two", seed: 2, active: true, final_rank: null, checked_in: false,
          username: "player_two", display_name: "Player Two",
          created_at: "2026-08-20T12:06:00.000+03:00", updated_at: "2026-08-20T12:06:00.000+03:00",
        },
      },
    ],
    matches: [
      {
        match: {
          id: 333, // ignored
          tournament_id: 9876543, // ignored
          identifier: "A", // ignored
          round: 1,
          state: "complete",
          player1_id: 111,
          player2_id: 222,
          winner_id: 111,
          loser_id: 222, // ignored
          scores_csv: "2-1",
          player1_prereq_match_id: null, // ignored
          player2_prereq_match_id: null, // ignored
          started_at: "2026-09-01T10:00:00.000+03:00", // ignored
          completed_at: "2026-09-05T19:00:00.000+03:00", // ignored
          created_at: "2026-09-01T10:00:00.000+03:00", // ignored
          updated_at: "2026-09-05T19:00:00.000+03:00", // ignored
        },
      },
      {
        match: {
          id: 334, tournament_id: 9876543, identifier: "B", round: 2, state: "pending",
          player1_id: 111, player2_id: null, winner_id: null, loser_id: null, scores_csv: "",
          player1_prereq_match_id: 333, player2_prereq_match_id: 335, started_at: null, completed_at: null,
          created_at: "2026-09-01T10:00:00.000+03:00", updated_at: "2026-09-05T19:00:00.000+03:00",
        },
      },
    ],
  },
};

// Challonge v1 wraps each item ({ participant: {...} }, { match: {...} }) and the whole reply ({ tournament });
// the bare forms are accepted too.
const optionalId = z.number().int().nullish().transform(value => value ?? null);

const participantFields = z.object({
  id: z.number().int(),
  name: z.string().nullish(),
  display_name: z.string().nullish(),
});
const participantSchema = z.union([
  z.object({ participant: participantFields }).transform(wrapped => wrapped.participant),
  participantFields,
]);

const matchFields = z.object({
  round: z.number().int(),
  player1_id: optionalId,
  player2_id: optionalId,
  winner_id: optionalId,
  state: z.enum(["complete", "open", "pending"]),
  scores_csv: z.string().nullish().transform(value => value ?? null),
});
const matchSchema = z.union([z.object({ match: matchFields }).transform(wrapped => wrapped.match), matchFields]);

const tournamentFields = z.object({
  name: z.string().nullish(),
  participants: z.array(participantSchema),
  matches: z.array(matchSchema),
});

export const bracketSchema = z.union([
  z.object({ tournament: tournamentFields }).transform(wrapped => wrapped.tournament),
  tournamentFields,
]);
