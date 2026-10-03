// Whether a question is about match play at all, and whether it asks who someone plays next.
// Only a match-play question loads the match-play context and fetches the bracket: loaded into
// every question, its example framing made the model answer unrelated chat with bracket talk.
// A "who plays next" question gets one deterministic line; any other match-play question gets
// the whole bracket.
const MATCH_PLAY_KEYWORDS = ["reikäpeli", "match play", "matchplay", "bracket", "vastustaj", "eliminoi", "pudonneet", "pudonnut", "kaavio", "turnauskaavio"];
const OPPONENT_KEYWORDS = ["vastustaj", "seuraava peli", "seuraavaks", "pelaan seuraavaksi", "ketä vastaan"];

export function isMatchPlayQuestion(text: string): boolean {
  return MATCH_PLAY_KEYWORDS.some(kw => text.toLowerCase().includes(kw));
}

export function isOpponentQuestion(text: string): boolean {
  return OPPONENT_KEYWORDS.some(kw => text.toLowerCase().includes(kw));
}
