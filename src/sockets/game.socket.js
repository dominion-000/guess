"use strict";

const { sessionManager } = require("../domain/sessionManager");

module.exports = function (io, socket) {

    socket.on("start-game", (cb) => {
        const sessionId = socket.data.sessionId;
        const session   = sessionManager.getSession(sessionId);

        if (!session)
            return cb?.({ error: "No session" });

        if (session.masterSocketId !== socket.id)
            return cb?.({ error: "Not game master" });

        if (!session.round)
            return cb?.({ error: "No question set" });

        const started = sessionManager.startGame(sessionId);
        if (!started)
            return cb?.({ error: "Cannot start — need 3+ players and a question" });

        const { expiresAt } = started.round;

        const timerId = setTimeout(() => {
            const s = sessionManager.getSession(sessionId);
            if (!s || !s.round || !s.round.active) return; // already ended by win

            const ended = sessionManager.endRound(sessionId, "timeout");
            if (!ended) return;

            io.to(sessionId).emit("round-ended", ended.roundResult);

            const updated = sessionManager.getPublicSession(sessionId);
            if (updated) io.to(sessionId).emit("session-update", updated);

        }, expiresAt - Date.now());

        sessionManager.registerRoundTimer(sessionId, timerId);

        io.to(sessionId).emit("game-started", {
            question: started.round.question,
            expiresAt,
        });

        io.to(sessionId).emit(
            "session-update",
            sessionManager.getPublicSession(sessionId)
        );

        cb?.({ success: true });
    });

    socket.on("submit-guess", (guess, cb) => {
        const sessionId = socket.data.sessionId;
        const session   = sessionManager.getSession(sessionId);

        if (!session)
            return cb?.({ error: "No session" });

        if (session.masterSocketId === socket.id)
            return cb?.({ error: "Game master cannot guess" });

        const result = sessionManager.submitGuess(sessionId, socket.id, guess);

        cb?.(result);

        if (result.error) return;

        io.to(sessionId).emit("guess-result", {
            socketId: socket.id,
            player:   socket.data.name,
            result,
        });

        if (result.correct && result.roundResult) {
            io.to(sessionId).emit("round-ended", result.roundResult);
        }

        const updated = sessionManager.getPublicSession(sessionId);
        if (updated) io.to(sessionId).emit("session-update", updated);
    });
};
