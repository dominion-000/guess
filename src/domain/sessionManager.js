const { randomUUID } = require("crypto");

const STATES = {
    WAITING: "WAITING",
    READY: "READY",
    PLAYING: "PLAYING",
    FINISHED: "FINISHED",
};

class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.timers = new Map();
    }

    _updateState(session) {
        if (session.state === STATES.PLAYING) return;

        const hasRound = session.round !== null;

        session.state =
            session.players.length >= 3 && hasRound
                ? STATES.READY
                : STATES.WAITING;
    }

    createSession(hostSocketId) {
        const id = this._generateId();

        const session = {
            id,
            players: [],
            masterSocketId: hostSocketId,
            state: STATES.WAITING,
            round: null,
            createdAt: Date.now(),
        };

        this.sessions.set(id, session);
        return session;
    }

    getSession(id) {
        return this.sessions.get(id);
    }

    getPublicSession(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) return null;

        return {
            id: session.id,
            state: session.state,
            playerCount: session.players.length,
            roundReady: session.round !== null,
            masterSocketId: session.masterSocketId,
            players: session.players.map(p => ({
                socketId: p.socketId,
                name: p.name,
                score: p.score,
                isMaster: p.socketId === session.masterSocketId,
            })),
        };
    }

    deleteSession(id) {
        clearTimeout(this.timers.get(id));
        this.timers.delete(id);
        this.sessions.delete(id);
    }

    addPlayer(sessionId, player) {
        const session = this.getSession(sessionId);
        if (!session) return null;

        session.players.push(player);
        this._updateState(session);
        return session;
    }

    removePlayer(sessionId, socketId) {
        const session = this.getSession(sessionId);
        if (!session) return null;

        session.players = session.players.filter(
            p => p.socketId !== socketId
        );

        if (
            session.masterSocketId === socketId &&
            session.players.length
        ) {
            session.masterSocketId =
                session.players[0].socketId;
        }

        if (session.players.length === 0) {
            this.deleteSession(sessionId);
            return null;
        }

        this._updateState(session);
        return session;
    }

    createRound(sessionId, question, answer) {
        const session = this.getSession(sessionId);
        if (!session) return null;

        session.round = {
            question,
            answer,
            winner: null,
            active: false,
            startedAt: null,
            expiresAt: null,
            attempts: {},
        };

        if (
            session.round &&
            session.round.active
        ) {
            return null;
        }

        this._updateState(session);
        return session;
    }

    startGame(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) return null;

        if (session.state !== STATES.READY) return null;

        session.state = STATES.PLAYING;

        session.round.active = true;
        session.round.startedAt = Date.now();
        session.round.expiresAt = Date.now() + 60000;

        session.players.forEach(p => {
            session.round.attempts[p.socketId] = 3;
        });

        this.timers.set(
            sessionId,
            setTimeout(() => {
                this.endRound(sessionId, "timeout");
            }, 60000)
        );

        return session;
    }

    submitGuess(sessionId, socketId, guess) {
        const session = this.getSession(sessionId);

        if (!session) {
            return { error: "No session" };
        }

        if (session.state !== STATES.PLAYING) {
            return { error: "Game not active" };
        }

        const round = session.round;

        if (!round || !round.active) {
            return { error: "Round finished" };
        }

        if (round.winner) {
            return { error: "Round finished" };
        }

        const attempts =
            round.attempts[socketId] ?? 3;

        if (attempts <= 0) {
            return {
                error: "No attempts left",
            };
        }

        round.attempts[socketId] =
            attempts - 1;

        guess = String(guess)
            .trim()
            .toLowerCase();

        if (guess === round.answer) {
            const player = session.players.find(p => p.socketId === socketId);

            round.winner = socketId;

            if (player) {
                player.score += 10;
            }

            const endResult = this.endRound(sessionId, "win");

            return {
                correct: true,
                player: player?.name,
                roundResult: endResult?.roundResult ?? null,
            };
        }

        return {
            correct: false,
            attemptsLeft:
                round.attempts[socketId],
        };
    }

    endRound(sessionId, reason) {
        const session = this.getSession(sessionId);
        if (!session) return null;
        if (!session.round || !session.round.active) return null;

        clearTimeout(this.timers.get(sessionId));
        this.timers.delete(sessionId);

        session.state = STATES.FINISHED;
        session.round.active = false;
        session.round.result = reason;

        // Capture round result info before wiping
        const roundResult = {
            reason,
            answer: session.round.answer,
            winnerSocketId: session.round.winner,
            winnerName: reason === "win"
                ? session.players.find(p => p.socketId === session.round.winner)?.name ?? null
                : null,
        };

        // rotate master
        if (session.players.length > 1) {
            const currentIndex = session.players.findIndex(
                p => p.socketId === session.masterSocketId
            );
            const next = session.players[
                (currentIndex + 1) % session.players.length
            ];
            session.masterSocketId = next.socketId;
        }

        session.round = null;
        session.state = STATES.WAITING;

        this._updateState(session);

        return { session, roundResult };
    }

    canStart(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) return false;

        return session.state === STATES.READY;
    }

    _generateId() {
        return randomUUID().slice(0, 6).toUpperCase();
    }
}

module.exports = {
    sessionManager: new SessionManager(),
    STATES,
};
