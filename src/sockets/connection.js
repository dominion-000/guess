"use strict";

const { sessionManager } = require("../domain/sessionManager");

module.exports = function (io, socket) {
    console.log(`[+] Connected:    ${socket.id}`);

    // Initialise socket data
    socket.data.sessionId = null;
    socket.data.name      = null;

    socket.on("disconnect", () => {
        console.log(`[-] Disconnected: ${socket.id}`);

        const sessionId = socket.data.sessionId;
        if (!sessionId) return;

        const session = sessionManager.removePlayer(sessionId, socket.id);

        socket.leave(sessionId);

        if (!session) return;

        io.to(sessionId).emit(
            "session-update",
            sessionManager.getPublicSession(sessionId)
        );
    });
};
