module.exports = function(io, socket) {
    console.log(`Connected: ${socket.id}`);

    // Prepare per-client state container
    socket.data.playerId = null;
    socket.data.sessionId = null;
    socket.data.name = null;

    socket.on("disconnect", () => {
        console.log(`Disconnected: ${socket.id}`);
    });
};
