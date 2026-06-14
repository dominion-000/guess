"use strict";

const { sessionManager } = require("../domain/sessionManager");

module.exports = function (io, socket) {
    console.log(`[+] Connected:    ${socket.id}`);

    socket.data.sessionId = null;
    socket.data.name      = null;

    socket.on("disconnect", () => {
        console.log(`[-] Disconnected: ${socket.id}`);

        const sessionId = socket.data.sessionId;
        if (!sessionId) return;
        socket.leave(sessionId);

        const result = sessionManager.removePlayer(sessionId, socket.id);

        if (!result) return;

        const { roundAborted, abortedRoundInfo } = result;

        if (roundAborted && abortedRoundInfo) {
            io.to(sessionId).emit("round-ended", abortedRoundInfo);
        }
        const updated = sessionManager.getPublicSession(sessionId);
        if (updated) io.to(sessionId).emit("session-update", updated);
    });
};
