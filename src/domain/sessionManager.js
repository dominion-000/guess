const { randomUUID } = require("crypto");

class SessionManager {
    constructor() {
        this.sessions = new Map();
    }

    createSession(hostSocketId) {
        const id = this._generateId();

        const session = {
            id,
            players: [],
            masterSocketId: hostSocketId,
            state: "WAITING",
            currentQuestion: null,
            currentAnswer: null,
            createdAt: Date.now()
        };

        this.sessions.set(id, session);

        return session;
    }

    getSession(id) {
        return this.sessions.get(id);
    }

    deleteSession(id) {
        this.sessions.delete(id);
    }

    addPlayer(sessionId, player) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        session.players.push(player);
        return session;
    }

    removePlayer(sessionId, socketId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.players = session.players.filter(p => p.socketId !== socketId);

        return session;
    }

    _generateId() {
        return randomUUID().slice(0, 6).toUpperCase();
    }
}

module.exports = new SessionManager();
