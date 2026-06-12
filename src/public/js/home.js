"use strict";

const socket = io();

let myName        = "";
let mySessionId   = null;
let amIMaster     = false;
let isPlaying     = false;
let myAttempts    = 3;
let timerInterval = null;
let currentMode   = "create"; // "create" | "join"

const homePanel  = document.getElementById("home-panel");
const lobbyPanel = document.getElementById("lobby-panel");

// HELPERS
function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function showError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
}

function clearErrors(...ids) {
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = "";
        el.classList.remove("show");
    });
}

function setGuessEnabled(enabled) {
    const input = document.getElementById("guess-input");
    const btn   = document.getElementById("send-btn");
    input.disabled = !enabled;
    btn.disabled   = !enabled;
    if (enabled) input.focus();
}

function updateAttemptsBadge() {
    const badge = document.getElementById("attempts-badge");
    badge.textContent = (isPlaying && !amIMaster && myAttempts > 0)
        ? `${myAttempts}/3`
        : "";
}

function addMsg(type, sender, text) {
    const feed = document.getElementById("feed");
    const div  = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerHTML  = `<span class="msg-sender">${escHtml(sender)}</span>`
                   + `<span class="msg-text">${escHtml(text)}</span>`;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
}

function addBanner(type, title, answerHtml) {
    const feed = document.getElementById("feed");
    const div  = document.createElement("div");
    div.className = `round-banner ${type}`;
    div.innerHTML  = `<div class="round-banner-title">${escHtml(title)}</div>`
                   + `<div class="round-banner-answer">${answerHtml}</div>`;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
}

function startTimer(expiresAt) {
    stopTimer();
    const el = document.getElementById("t-timer");
    el.style.display = "inline";

    function tick() {
        const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        el.textContent = `${left}s`;
        el.className = `timer${left <= 10 ? " urgent" : ""}`;
        if (left <= 0) stopTimer();
    }

    tick();
    timerInterval = setInterval(tick, 250);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    const el = document.getElementById("t-timer");
    if (el) el.style.display = "none";
}

// HOME PANEL
function switchTab(mode) {
    currentMode = mode;
    document.getElementById("tab-create").classList.toggle("active", mode === "create");
    document.getElementById("tab-join").classList.toggle("active", mode === "join");
    document.getElementById("session-field").style.display = mode === "join" ? "block" : "none";
    document.getElementById("action-btn").textContent =
        mode === "create" ? "Create Session" : "Join Session";
    clearErrors("err-name", "err-session", "err-general");
}

window.switchTab = switchTab;

document.getElementById("action-btn").addEventListener("click", () => {
    clearErrors("err-name", "err-session", "err-general");

    const name = document.getElementById("name-input").value.trim();
    if (!name) { showError("err-name", "Name is required"); return; }

    if (currentMode === "create") {
        socket.emit("create-session", name, (res) => {
            if (res.error) { showError("err-general", res.error); return; }
            myName      = name;
            mySessionId = res.sessionId;
            amIMaster   = true;
            enterLobby();
        });
    } else {
        const sid = document.getElementById("session-input").value.trim().toUpperCase();
        if (!sid) { showError("err-session", "Session ID is required"); return; }

        socket.emit("join-session", { sessionId: sid, name }, (res) => {
            if (res.error) { showError("err-general", res.error); return; }
            myName      = name;
            mySessionId = sid;
            amIMaster   = res.isMaster ?? false;
            enterLobby();
        });
    }
});

// Enter key on home inputs
["name-input", "session-input"].forEach(id => {
    document.getElementById(id)?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("action-btn").click();
    });
});

function enterLobby() {
    homePanel.style.display  = "none";
    lobbyPanel.style.display = "grid";
    addMsg("system", "System", mySessionId
        ? `Joined session ${mySessionId}`
        : "Session created");
}

// LOBBY CONTROLS
document.getElementById("leave-btn").addEventListener("click", () => {
    socket.emit("leave-session");
    stopTimer();

    // Reset all state
    myName = ""; mySessionId = null; amIMaster = false;
    isPlaying = false; myAttempts = 3;

    document.getElementById("feed").innerHTML         = "";
    document.getElementById("players-list").innerHTML = "";
    document.getElementById("name-input").value       = "";
    document.getElementById("session-input").value    = "";

    lobbyPanel.style.display = "none";
    homePanel.style.display  = "flex";
});

document.getElementById("create-round-btn").addEventListener("click", () => {
    clearErrors("err-question", "err-answer", "err-round");

    const q = document.getElementById("question-input").value.trim();
    const a = document.getElementById("answer-input").value.trim();

    if (!q) { showError("err-question", "Question is required"); return; }
    if (!a) { showError("err-answer",   "Answer is required");   return; }

    socket.emit("create-round", { question: q, answer: a }, (res) => {
        if (res.error) { showError("err-round", res.error); return; }
        addMsg("system", "System", "Question set ✓");
        document.getElementById("question-input").value = "";
        document.getElementById("answer-input").value   = "";
    });
});

document.getElementById("start-btn").addEventListener("click", () => {
    clearErrors("err-start");
    socket.emit("start-game", (res) => {
        if (res.error) { showError("err-start", res.error); }
    });
});

function sendGuess() {
    const input   = document.getElementById("guess-input");
    const sendBtn = document.getElementById("send-btn");
    const guess   = input.value.trim();

    if (!guess || !isPlaying) return;

    sendBtn.disabled = true;

    socket.emit("submit-guess", guess, (res) => {
        sendBtn.disabled = false;
        input.value      = "";

        if (res.error) {
            addMsg("system", "System", res.error);
            if (res.error === "No attempts left") {
                isPlaying = false;
                setGuessEnabled(false);
                updateAttemptsBadge();
            }
            return;
        }

        if (res.correct) {
            addMsg("win", "You", "Correct! 🎉 You won!");
            isPlaying = false;
            setGuessEnabled(false);
            updateAttemptsBadge();
        } else {
            myAttempts = res.attemptsLeft;
            updateAttemptsBadge();

            if (res.attemptsLeft === 0) {
                addMsg("system", "System", "No attempts left");
                isPlaying = false;
                setGuessEnabled(false);
            } else {
                addMsg("wrong", "You",
                    `Wrong — ${res.attemptsLeft} attempt${res.attemptsLeft !== 1 ? "s" : ""} left`
                );
            }
        }
    });
}

document.getElementById("send-btn").addEventListener("click", sendGuess);
document.getElementById("guess-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendGuess();
});

// SOCKET EVENTS
socket.on("session-update", (session) => {
    document.getElementById("t-session-id").textContent = session.id;

    const stateEl = document.getElementById("t-state");
    stateEl.textContent = session.state;
    stateEl.className   = `state-chip ${session.state.toLowerCase()}`;

    const list = document.getElementById("players-list");
    list.innerHTML = "";

    const newAmIMaster = session.masterSocketId === socket.id;

    session.players.forEach((p) => {
        const isMe     = p.socketId === socket.id;
        const isMaster = p.isMaster;

        const div = document.createElement("div");
        div.className = [
            "player-item",
            isMe     ? "me"     : "",
            isMaster ? "master" : "",
        ].filter(Boolean).join(" ");

        div.innerHTML =
            `<div class="player-avatar">${escHtml(p.name[0].toUpperCase())}</div>`
          + `<span class="player-name">${escHtml(p.name)}`
          + (isMe ? ` <span class="you-tag">(you)</span>` : "")
          + `</span>`
          + `<span class="player-score">${p.score}</span>`;

        list.appendChild(div);
    });

    // Notify if master role just rotated to this client
    const masterJustChanged = newAmIMaster && !amIMaster;
    amIMaster = newAmIMaster;

    document.getElementById("master-panel").style.display  = amIMaster ? "block" : "none";
    document.getElementById("waiting-panel").style.display = amIMaster ? "none"  : "block";

    if (masterJustChanged) {
        addMsg("system", "System", "You are now the Game Master — set a new question!");
    }

    if (amIMaster) {
        const canStart  = session.state === "READY";
        const startBtn  = document.getElementById("start-btn");
        startBtn.disabled = !canStart || session.state === "PLAYING";

        const hints = [];
        if (session.playerCount < 3)  hints.push(`Need ${3 - session.playerCount} more player(s)`);
        if (!session.roundReady)       hints.push("Set a question first");
        if (canStart)                  hints.push("Ready to start!");
        document.getElementById("master-status").textContent = hints.join(" · ");
    }

    if (!amIMaster) {
        const masterPlayer = session.players.find(p => p.isMaster);
        document.getElementById("waiting-text").textContent = masterPlayer
            ? `${masterPlayer.name} is the Game Master`
            : "Waiting for game master...";
    }

    // Disable guessing outside of PLAYING
    if (session.state !== "PLAYING" && isPlaying) {
        isPlaying = false;
        setGuessEnabled(false);
        updateAttemptsBadge();
    }
});

socket.on("game-started", (data) => {
    document.getElementById("feed").innerHTML = "";

    isPlaying  = !amIMaster;
    myAttempts = 3;
    updateAttemptsBadge();

    addMsg("system", "System", "— Game started —");
    addMsg("question", "Question", data.question);

    if (!amIMaster) {
        setGuessEnabled(true);
        startTimer(data.expiresAt);
    } else {
        addMsg("system", "System", "You set this question. You cannot guess!");
    }
});

socket.on("guess-result", (data) => {
    // Errors are shown only to the guesser via the submit-guess callback.
    // Only broadcast correct guesses to the room, wrong guesses stay private
    // to prevent giving others hints.
    if (data.result.error || data.result.correct === false) return;

    // Another player guessed correctly
    if (data.result.correct && socket.id !== data.socketId) {
        addMsg("win", data.player, "Correct answer! 🎉");
    }
});

socket.on("round-ended", (roundResult) => {
    isPlaying = false;
    setGuessEnabled(false);
    stopTimer();
    updateAttemptsBadge();

    if (roundResult.reason === "win") {
        addBanner(
            "win",
            `🏆 ${roundResult.winnerName} wins!`,
            `Answer: <span>${escHtml(roundResult.answer)}</span>`
        );
    } else {
        addBanner(
            "timeout",
            "⏰ Time's up!",
            `The answer was: <span>${escHtml(roundResult.answer)}</span>`
        );
    }
});

socket.on("disconnect", () => {
    addMsg("system", "System", "Disconnected from server.");
    stopTimer();
    isPlaying = false;
    setGuessEnabled(false);
});
