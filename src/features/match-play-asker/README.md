# Match-play asker

Answers questions about the club's match-play bracket when Sakari is named: who plays whom,
who is next. `bracket.ts` reads the Challonge bracket (`ChallongeClient`) and finds the player
the question is about; `matchPlayAsker.ts` gives the model the bracket facts with
`prompts/asker.md` and the context notes. Returns nothing when the question isn't about match
play, and the text listener falls back to a heckle.
