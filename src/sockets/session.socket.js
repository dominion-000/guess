"use strict";

const { sessionManager } = require("../domain/sessionManager");

module.exports = function (io, socket) {

    socket.on("create-session", (name, cb) => {
        name = String(name ?? "").trim();
        if (!name) return cb?.({ error: "Name is required" });

        const session = sessionManager.createSession(socket.id);

        socket.join(session.id);
        socket.data.sessionId = session.id;
        socket.data.name      = name;

        sessionManager.addPlayer(session.id, {
            socketId: socket.id,
            name,
            score: 0,
        });

        cb?.({ success: true, sessionId: session.id, isMaster: true });

        io.to(session.id).emit(
            "session-update",
            sessionManager.getPublicSession(session.id)
        );
    });

    socket.on("join-session", ({ sessionId, name } = {}, cb) => {
        sessionId = String(sessionId ?? "").trim().toUpperCase();
        name      = String(name      ?? "").trim();

        if (!name)      return cb?.({ error: "Name is required" });
        if (!sessionId) return cb?.({ error: "Session ID is required" });

        const session = sessionManager.getSession(sessionId);
        if (!session)   return cb?.({ error: "Session not found" });

        if (session.state === "PLAYING")
            return cb?.({ error: "Game in progress, cannot join now" });

        const isMaster = session.masterSocketId === socket.id;

        socket.join(sessionId);
        socket.data.sessionId = sessionId;
        socket.data.name      = name;

        sessionManager.addPlayer(sessionId, {
            socketId: socket.id,
            name,
            score: 0,
        });

        cb?.({ success: true, isMaster });

        io.to(sessionId).emit(
            "session-update",
            sessionManager.getPublicSession(sessionId)
        );
    });

    socket.on("leave-session", () => {
        const sessionId = socket.data.sessionId;
        if (!sessionId) return;

        socket.leave(sessionId);
        socket.data.sessionId = null;

        const session = sessionManager.removePlayer(sessionId, socket.id);
        if (!session) return; // session was deleted (last player left)

        io.to(sessionId).emit(
            "session-update",
            sessionManager.getPublicSession(sessionId)
        );
    });

    socket.on("create-round", ({ question, answer } = {}, cb) => {
        const sessionId = socket.data.sessionId;
        const session   = sessionManager.getSession(sessionId);

        if (!session)
            return cb?.({ error: "No session" });

        if (session.masterSocketId !== socket.id)
            return cb?.({ error: "Not game master" });

        if (session.state === "PLAYING")
            return cb?.({ error: "Cannot change question while game is in progress" });

        question = String(question ?? "").trim();
        answer   = String(answer   ?? "").trim().toLowerCase();

        if (!question) return cb?.({ error: "Question is required" });
        if (!answer)   return cb?.({ error: "Answer is required" });

        sessionManager.createRound(sessionId, question, answer);

        cb?.({ success: true });

        io.to(sessionId).emit(
            "session-update",
            sessionManager.getPublicSession(sessionId)
        );
    });
};
