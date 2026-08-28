const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.get("/", (req, res) => {
  res.send("Signaling server is running. Online users: " + io.engine.clientsCount);
});

// Users waiting to be matched
let waitingQueue = [];
// Map of socket.id -> partner socket.id
let activePairs = new Map();

function removeFromQueue(socketId) {
  waitingQueue = waitingQueue.filter((id) => id !== socketId);
}

function tryMatch(socket) {
  // Remove self from queue if already there (safety)
  removeFromQueue(socket.id);

  if (waitingQueue.length > 0) {
    // Pop the first waiting user (random enough since queue order is arrival-based;
    // for true randomness you can shuffle waitingQueue before picking)
    const partnerId = waitingQueue.shift();
    const partnerSocket = io.sockets.sockets.get(partnerId);

    if (!partnerSocket) {
      // Partner disconnected already, try again
      tryMatch(socket);
      return;
    }

    activePairs.set(socket.id, partnerId);
    activePairs.set(partnerId, socket.id);

    // Tell one side to create the WebRTC offer (initiator), other side waits
    socket.emit("matched", { partnerId, initiator: true });
    partnerSocket.emit("matched", { partnerId: socket.id, initiator: false });
  } else {
    waitingQueue.push(socket.id);
    socket.emit("waiting");
  }
}

function endPair(socketId, notifyPartner = true) {
  const partnerId = activePairs.get(socketId);
  if (partnerId) {
    activePairs.delete(socketId);
    activePairs.delete(partnerId);
    if (notifyPartner) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) partnerSocket.emit("partner-left");
    }
  }
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("find-match", () => {
    endPair(socket.id); // leave any existing pair first
    tryMatch(socket);
  });

  // Relay WebRTC signaling data (offer, answer, ICE candidates) to the matched partner
  socket.on("signal", ({ to, data }) => {
    io.to(to).emit("signal", { from: socket.id, data });
  });

  // User pressed "Next" / "Skip"
  socket.on("skip", () => {
    endPair(socket.id);
    tryMatch(socket);
  });

  // User pressed "Stop"
  socket.on("stop", () => {
    endPair(socket.id);
    removeFromQueue(socket.id);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    removeFromQueue(socket.id);
    endPair(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Signaling server listening on port " + PORT);
});
