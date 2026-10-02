# Bagtags

Each chat's bag tags: who holds which number. `/bagtag` shows, sets and removes them; at a round
end `finishRound` swaps the tags among the tracked players who played, by their results, and posts
the announcement. Stored in `bagtags.json` in `DATA_DIR` (see `docs/architecture/data.md`).
