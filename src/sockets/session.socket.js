const {
    sessionManager,
} = require("../domain/sessionManager");

module.exports = function(io, socket) {
    socket.on("create-session", (name, cb) => {
        name = String(name ?? "").trim();

        if (!name) {
            return cb?.({
                error: "Name required",
            });
        }

        const session =
            sessionManager.createSession(
                socket.id
            );

        socket.join(session.id);

        socket.data.sessionId =
            session.id;
        socket.data.name = name;

        sessionManager.addPlayer(
            session.id,
            {
                socketId: socket.id,
                name,
                score: 0,
            }
        );

        cb?.({
            success: true,
            sessionId: session.id,
        });

        io.to(session.id).emit(
            "session-update",
            sessionManager.getPublicSession(
                session.id
            )
        );
    });

    socket.on(
        "join-session",
        ({ sessionId, name }, cb) => {
            sessionId = String(
                sessionId ?? ""
            )
                .trim()
                .toUpperCase();

            name = String(
                name ?? ""
            ).trim();

            if (!name) {
                return cb?.({
                    error: "Name required",
                });
            }

            const session =
                sessionManager.getSession(
                    sessionId
                );

            if (!session) {
                return cb?.({
                    error:
                        "Session not found",
                });
            }

            if (
                session.state ===
                "PLAYING"
            ) {
                return cb?.({
                    error:
                        "Game in progress",
                });
            }

            socket.join(sessionId);

            socket.data.sessionId =
                sessionId;
            socket.data.name = name;

            sessionManager.addPlayer(
                sessionId,
                {
                    socketId: socket.id,
                    name,
                    score: 0,
                }
            );

            io.to(sessionId).emit(
                "session-update",
                sessionManager.getPublicSession(
                    sessionId
                )
            );

            cb?.({
                success: true,
            });
        }
    );

    socket.on(
        "leave-session",
        () => {
            const sessionId =
                socket.data.sessionId;

            if (!sessionId)
                return;

            socket.leave(sessionId);

            const session =
                sessionManager.removePlayer(
                    sessionId,
                    socket.id
                );

            socket.data.sessionId =
                null;

            if (!session)
                return;

            if (
                session.players
                    .length === 0
            ) {
                sessionManager.deleteSession(
                    sessionId
                );

                return;
            }

            io.to(sessionId).emit(
                "session-update",
                sessionManager.getPublicSession(
                    sessionId
                )
            );
        }
    );

    socket.on(
        "create-round",
        (
            { question, answer },
            cb
        ) => {
            const sessionId =
                socket.data.sessionId;

            const session =
                sessionManager.getSession(
                    sessionId
                );

            if (!session) {
                return cb?.({
                    error:
                        "No session",
                });
            }

            if (
                session.masterSocketId !==
                socket.id
            ) {
                return cb?.({
                    error:
                        "Not game master",
                });
            }

            question = String(
                question ?? ""
            ).trim();

            answer = String(
                answer ?? ""
            )
                .trim()
                .toLowerCase();

            if (
                !question ||
                !answer
            ) {
                return cb?.({
                    error:
                        "Invalid round",
                });
            }

            sessionManager.createRound(
                sessionId,
                question,
                answer
            );

            io.to(sessionId).emit(
                "session-update",
                sessionManager.getPublicSession(
                    sessionId
                )
            );

            cb?.({
                success: true,
            });
        }
    );
};
