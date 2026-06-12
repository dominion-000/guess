# Guess.

A real-time multiplayer guessing game.
Built with Node.js, Express, Socket.IO, and EJS. 

---

## How it works

One player creates a session and becomes the **Game Master**. Others join using the session ID. The Game Master sets a question and an answer, then starts the round.
Every other player has **3 attempts** and **60 seconds** to guess the correct answer.
The first player to guess correctly wins **10 points** and becomes the next Game Master.
A session lives as long as at least one player is in it. When the last player leaves, it is deleted.

---

## Game rules

| Rule | Detail |
|---|---|
| Minimum players to start | 3 |
| Attempts per player | 3 |
| Round duration | 60 seconds |
| Points for a correct answer | 10 |
| Points on timeout | 0 |
| Can players join mid-game? | No |
| Who starts the next round? | Next player in join order |

### Session states

```
WAITING  →  READY  →  PLAYING  →  WAITING
```

- **WAITING** — fewer than 3 players, or no question set
- **READY** — 3+ players and a question set; master can start
- **PLAYING** — round is active; no new players can join
- **FINISHED** — transitional state during round cleanup; resolves back to WAITING

---

## Stack

- Node.js
- Express
- Socket.IO
- EJS
- Nodemon

---

## Getting started

```sh
npm install
npm run dev
npm start
```

The server starts at `http://localhost:3000`.

---

## Notes

- Answers are **case-insensitive** and trimmed before comparison.
- The Game Master cannot submit guesses — only players can.
- Wrong guesses are private, only the guesser sees their own failed attempts in the feed. This prevents other players getting hints.
- Sessions are held entirely in memory. Restarting the server clears all active sessions.

