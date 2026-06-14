"use strict";

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

        session.state =
            session.players.length >= 3 && session.round !== null
                ? STATES.READY
                : STATES.WAITING;
    }

    _generateId() {
        return randomUUID().slice(0, 6).toUpperCase();
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

        session.players = session.players.filter(p => p.socketId !== socketId);

        if (session.players.length === 0) {
            this.deleteSession(sessionId);
            return null;
        }

        if (session.masterSocketId === socketId) {
            session.masterSocketId = session.players[0].socketId;
        }

        let roundAborted = false;
        let abortedRoundInfo = null;

        if (session.state === STATES.PLAYING && session.round?.active) {
            const activePlayers = session.players.filter(
                p => p.socketId !== session.masterSocketId
            );

            if (activePlayers.length === 0) {
                abortedRoundInfo = {
                    reason: "aborted",
                    answer: session.round.answer,
                    winnerSocketId: null,
                    winnerName: null,
                };

                clearTimeout(this.timers.get(sessionId));
                this.timers.delete(sessionId);

                session.round = null;
                session.state = STATES.WAITING;
                roundAborted = true;
            }
        }

        if (!roundAborted) {
            this._updateState(session);
        }

        return { session, roundAborted, abortedRoundInfo };
    }

    createRound(sessionId, question, answer) {
        const session = this.getSession(sessionId);
        if (!session) return null;

        if (session.state === STATES.PLAYING) return null;

        session.round = {
            question,
            answer,
            winner: null,
            active: false,
            startedAt: null,
            expiresAt: null,
            attempts: {},
            result: null,
        };

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

        this.timers.set(sessionId, null);

        return session;
    }

    registerRoundTimer(sessionId, timerId) {
        this.timers.set(sessionId, timerId);
    }

    endRound(sessionId, reason) {
        const session = this.getSession(sessionId);
        if (!session) return null;
        if (!session.round || !session.round.active) return null;

        clearTimeout(this.timers.get(sessionId));
        this.timers.delete(sessionId);

        session.round.active = false;
        session.round.result = reason;

        const roundResult = {
            reason,
            answer: session.round.answer,
            winnerSocketId: session.round.winner,
            winnerName: reason === "win"
                ? (session.players.find(p => p.socketId === session.round.winner)?.name ?? null)
                : null,
        };

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

    submitGuess(sessionId, socketId, guess) {
        const session = this.getSession(sessionId);
        if (!session) return { error: "No session" };
        if (session.state !== STATES.PLAYING) return { error: "Game not active" };

        const round = session.round;
        if (!round || !round.active) return { error: "Round finished" };
        if (round.winner) return { error: "Round finished" };

        const attempts = round.attempts[socketId] ?? 3;
        if (attempts <= 0) return { error: "No attempts left" };

        round.attempts[socketId] = attempts - 1;

        guess = String(guess).trim().toLowerCase();

        if (guess === round.answer) {
            const player = session.players.find(p => p.socketId === socketId);
            round.winner = socketId;

            if (player) player.score += 10;

            const endResult = this.endRound(sessionId, "win");

            return {
                correct: true,
                player: player?.name,
                roundResult: endResult?.roundResult ?? null,
            };
        }

        return {
            correct: false,
            attemptsLeft: round.attempts[socketId],
        };
    }

    canStart(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) return false;
        return session.state === STATES.READY;
    }
}

module.exports = {
    SessionManager,
    sessionManager: new SessionManager(),
    STATES,
};
