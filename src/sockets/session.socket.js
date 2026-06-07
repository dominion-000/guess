const sessionManager = require("../domain/sessionManager");

module.exports = function(io, socket) {

    // Create session
    socket.on("create-session", (name, callback) => {
        const session = sessionManager.createSession(socket.id);

        socket.join(session.id);

        socket.data.sessionId = session.id;
        socket.data.name = name;

        session.players.push({
            socketId: socket.id,
            name,
            score: 0
        });

        callback?.(session);
        io.to(session.id).emit("session-update", session);
    });

    // Join session
    socket.on("join-session", ({ sessionId, name }, callback) => {
        const session = sessionManager.getSession(sessionId);

        if (!session) {
            return callback?.({ error: "Session not found" });
        }

        if (session.state !== "WAITING") {
            return callback?.({ error: "Game already in progress" });
        }

        socket.join(sessionId);

        socket.data.sessionId = sessionId;
        socket.data.name = name;

        session.players.push({
            socketId: socket.id,
            name,
            score: 0
        });

        io.to(sessionId).emit("session-update", session);

        callback?.({ success: true, session });
    });

    // Leave session
    socket.on("leave-session", () => {
        const sessionId = socket.data.sessionId;
        if (!sessionId) return;

        socket.leave(sessionId);

        const session = sessionManager.removePlayer(sessionId, socket.id);

        if (session && session.players.length === 0) {
            sessionManager.deleteSession(sessionId);
            return;
        }

        io.to(sessionId).emit("session-update", session);
    });
};
