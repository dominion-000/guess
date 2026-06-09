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
    }

    _updateState(session) {
        if (session.state === STATES.PLAYING) {
            return;
        }

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

        if (!session) {
            return null;
        }

        return {
            id: session.id,

            state: session.state,

            playerCount:
                session.players.length,

            roundReady:
                session.round !== null,

            players:
                session.players.map(
                    player => ({
                        name: player.name,
                        score: player.score,
                        isMaster:
                            player.socketId ===
                            session.masterSocketId,
                    })
                ),
        };
    }

    deleteSession(id) {
        this.sessions.delete(id);
    }

    addPlayer(sessionId, player) {
        const session =
            this.getSession(sessionId);

        if (!session) {
            return null;
        }

        session.players.push(player);

        this._updateState(session);

        return session;
    }

    removePlayer(sessionId, socketId) {
        const session =
            this.getSession(sessionId);

        if (!session) {
            return null;
        }

        session.players =
            session.players.filter(
                player =>
                    player.socketId !==
                    socketId
            );

        if (
            session.masterSocketId ===
            socketId &&
            session.players.length
        ) {
            session.masterSocketId =
                session.players[0]
                    .socketId;
        }

        if (
            session.players.length ===
            0
        ) {
            session.round = null;
        }

        this._updateState(session);

        return session;
    }

    createRound(
        sessionId,
        question,
        answer
    ) {
        const session =
            this.getSession(sessionId);

        if (!session) {
            return null;
        }

        session.round = {
            question,
            answer,
            winner: null,
            active: false,
            startedAt: null,
            expiresAt: null,
        };

        this._updateState(session);

        return session;
    }

    canStart(sessionId) {
        const session =
            this.getSession(sessionId);

        if (!session) {
            return false;
        }

        return (
            session.state ===
            STATES.READY
        );
    }

    _generateId() {
        return randomUUID()
            .slice(0, 6)
            .toUpperCase();
    }
}

module.exports = {
    sessionManager: new SessionManager(),
    STATES,
};
