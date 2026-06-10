const socket = io();

let currentSession = null;

const homePanel = document.getElementById("home-panel");
const lobbyPanel = document.getElementById("lobby-panel");

const nameInput = document.getElementById("name");
const sessionInput = document.getElementById("session");

const sessionCode = document.getElementById("session-code");
const sessionState = document.getElementById("session-state");
const playerCount = document.getElementById("player-count");
const players = document.getElementById("players");

const masterPanel =
    document.getElementById("master-panel");

const waitingPanel =
    document.getElementById("waiting-panel");

const questionInput =
    document.getElementById("question");

const answerInput =
    document.getElementById("answer");

const roundReady =
    document.getElementById("round-ready");

document
.getElementById("create")
.onclick = () => {

    const name =
        nameInput.value.trim();

    if (!name) {
        alert("Enter name");
        return;
    }

    socket.emit(
        "create-session",
        name,
        res => {

            if (res.error) {
                alert(res.error);
                return;
            }

            currentSession =
                res.sessionId;

            homePanel.style.display =
                "none";

            lobbyPanel.style.display =
                "block";
        }
    );
};

document
.getElementById("join")
.onclick = () => {

    const name =
        nameInput.value.trim();

    const sessionId =
        sessionInput.value
        .trim()
        .toUpperCase();

    if (
        !name ||
        !sessionId
    ) {
        alert("Fill fields");
        return;
    }

    socket.emit(
        "join-session",
        {
            sessionId,
            name,
        },
        res => {

            if (res.error) {
                alert(res.error);
                return;
            }

            currentSession =
                sessionId;

            homePanel.style.display =
                "none";

            lobbyPanel.style.display =
                "block";
        }
    );
};

document
.getElementById(
    "create-round"
)
.onclick = () => {

    socket.emit(
        "create-round",
        {
            question:
                questionInput.value,

            answer:
                answerInput.value,
        },
        res => {

            if (
                res.error
            ) {
                alert(
                    res.error
                );
            }
        }
    );
};

socket.on(
    "session-update",
    session => {

        sessionCode.textContent =
            session.id;

        sessionState.textContent =
            session.state;

        playerCount.textContent =
            session.playerCount;

        roundReady.textContent =
            session.roundReady
            ? "Yes"
            : "No";

        players.innerHTML = "";

        let amMaster = false;

        session.players.forEach(
            player => {

                const li =
                document.createElement(
                    "li"
                );

                li.textContent =
                player.isMaster
                ? `★ ${player.name} (${player.score})`
                : `${player.name} (${player.score})`;

                players.appendChild(
                    li
                );

                if (
                    player.isMaster &&
                    player.name ===
                    nameInput.value.trim()
                ) {
                    amMaster = true;
                }
            }
        );

        masterPanel.style.display =
            amMaster
            ? "block"
            : "none";

        waitingPanel.style.display =
            amMaster
            ? "none"
            : "block";
    }
);
