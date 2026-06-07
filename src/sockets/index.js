const registerConnection = require("./connection");
const registerSession = require("./session.socket");
const registerGame = require("./game.socket");

module.exports = function(io) {
    io.on("connection", (socket) => {
        registerConnection(io, socket);
        registerSession(io, socket);
        registerGame(io, socket);
    });
};
