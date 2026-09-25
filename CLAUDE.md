# CLAUDE.md

## Project Overview

This project is a Telegram bot ("Sakke") that provides live disc golf commentary based on real-time scoring data.

The bot:

* Polls a live scoring API (e.g. Metrix)
* Detects changes in player scores
* Generates commentary messages
* Stores historical results in a database
* Maintains long-term player performance data

The system was refactored from legacy code into TypeScript; what follows is the
architecture it settled on and the rules that still apply.

---

## Core Principles

* DO NOT break existing data compatibility
* Prefer incremental refactoring over full rewrites
* Keep logic modular and testable
* Avoid tight coupling between polling, parsing, and commentary
* All new features must work with existing historical data

---

## Architecture

### High-level flow

1. Poll live API
2. Detect changes
3. Normalize events
4. Generate commentary
5. Send to Telegram
6. Persist results

---

## Key Modules

### 1. Poller

Responsible for:

* Fetching live data (interval-based)
* Handling rate limits
* Stopping when round is finished

Constraints:

* Must be resilient to API failures
* Should not spam requests unnecessarily

---

### 2. Change Detection

Responsible for:

* Comparing previous state vs current state
* Detecting meaningful events:

  * Birdie
  * Bogey
  * Double bogey+
  * Lead changes
  * Round completion

Important:

* Must be deterministic
* Must avoid duplicate events

---

### 3. Event Normalization

Convert raw API data into structured events:

Example:

```ts
{
	type: "birdie",
	playerId: string,
	hole: number,
	scoreRelative: -1,
	timestamp: number
}
```

---

### 4. Commentary Engine

Responsible for generating human-like commentary.

Inputs:

* Event
* Player history
* Round context

Outputs:

* Text message

Future:

* Personality tuning
* Multiple commentary styles

---

### 5. Player Knowledge System (Future)

Goal:

* Build persistent understanding of players

Data source:

* Historical round results
* Hole-by-hole performance

Constraints:

* No external data available
* Only fairway results

Possible insights:

* Consistency
* Strong/weak holes
* Clutch performance
* Rating estimation

Storage options:

* Database tables (preferred)
* Optional markdown summaries (secondary)

---

### 6. Persistence Layer

Using:

* TypeORM
* MariaDB (existing database)

Requirements:

* Maintain compatibility with existing schema
* Migrations must be safe
* Table naming should move to snake_case

---

## Database Notes

* Existing data is critical → DO NOT DROP
* Migration strategy:

  1. Dump production database
  2. Modify locally
  3. Validate
  4. Re-import to production

---

## Coding Guidelines

* Language: TypeScript
* Prefer explicit types over `any`
* Use async/await (no callbacks)
* Keep functions small and focused
* Avoid side effects

---

## Example Patterns

### Good

* Pure functions for event detection
* Clear separation between IO and logic

### Bad

* Mixing API calls + business logic
* Hidden state mutations

---

## Development Workflow

* Run locally via Node.js
* Use WSL environment
* Docker support planned (not required initially)

---

## Future Features

* Smart polling scheduler
* Player profiles
* AI-generated commentary improvements
* Voice integration (Sakke server)
* Local LLM integration

---

## Notes for Claude

When modifying code:

* Always preserve existing behavior unless explicitly changing it
* Prefer refactoring over rewriting
* Ask for clarification if unsure about data model
* Avoid introducing breaking changes to database structure
* Keep compatibility with historical data

---

## Priority Tasks

1. Refactor polling logic
2. Extract change detection module
3. Build event system
4. Improve commentary generation
5. Add player knowledge system

---
