const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const setupSockets = require("./sockets");

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
    }
});

setupSockets(io);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
