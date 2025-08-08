const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// ===== Server setup =====
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" }
});

// serve static
app.use(express.static('public')); // ตามที่คุณชอบไว้เลย 👍

// ===== Game data =====
const questions = [
  { question: "What is the capital of France?", options: ["Paris","London","Berlin","Madrid"], correctAnswer: 0 },
  { question: "What is 2 + 2?", options: ["3","4","5","6"], correctAnswer: 1 },
  { question: "What color is the sky?", options: ["Blue","Green","Red","Yellow"], correctAnswer: 0 },
  { question: "Which is the largest planet?", options: ["Earth","Mars","Jupiter","Venus"], correctAnswer: 2 },
  { question: "Who wrote 'Romeo and Juliet'?", options: ["Shakespeare","Dickens","Hemingway","Tolkien"], correctAnswer: 0 }
];

// rooms[roomId] = { hostId, players:[{socketId,name,score}], qIndex, timer, started }
const rooms = Object.create(null);

// ===== Helpers =====
const makeRoomId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function clearRoomTimer(roomId){
  const r = rooms[roomId];
  if (r && r.timer){
    clearInterval(r.timer);
    r.timer = null;
  }
}

function sendPlayers(roomId){
  const r = rooms[roomId];
  if (!r) return;
  io.to(roomId).emit('players', r.players.map(p => ({ name: p.name, score: p.score })));
}

function startQuestion(roomId){
  const r = rooms[roomId];
  if (!r) return;

  // all questions done
  if (r.qIndex >= questions.length){
    clearRoomTimer(roomId);
    io.to(roomId).emit('result', r.players.sort((a,b)=>b.score-a.score));
    return;
  }

  const q = questions[r.qIndex];
  io.to(roomId).emit('question', { index: r.qIndex + 1, total: questions.length, ...q });

  // 10s countdown
  let countdown = 10;
  io.to(roomId).emit('timer', countdown);
  clearRoomTimer(roomId);
  r.timer = setInterval(() => {
    countdown--;
    io.to(roomId).emit('timer', countdown);
    if (countdown <= 0){
      clearRoomTimer(roomId);
      io.to(roomId).emit('endQuestion', { correctAnswer: q.correctAnswer });
      r.qIndex++;
      // ไปข้อถัดไปหลังหน่วง 2 วิ
      setTimeout(() => startQuestion(roomId), 2000);
    }
  }, 1000);
}

// ===== Socket events =====
io.on('connection', (socket) => {
  // Create room
  socket.on('createRoom', ({ playerName }) => {
    const roomId = makeRoomId();
    rooms[roomId] = {
      hostId: socket.id,
      players: [{ socketId: socket.id, name: playerName || 'Host', score: 0 }],
      qIndex: 0,
      timer: null,
      started: false
    };
    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
    sendPlayers(roomId);
  });

  // Join room
  socket.on('join', ({ roomId, playerName }) => {
    const r = rooms[roomId];
    if (!r) {
      socket.emit('errorMessage', 'Room not found.');
      return;
    }
    if (r.started){
      socket.emit('errorMessage', 'Game already started.');
      return;
    }
    r.players.push({ socketId: socket.id, name: playerName || 'Player', score: 0 });
    socket.join(roomId);
    io.to(roomId).emit('system', `${playerName} joined room ${roomId}`);
    sendPlayers(roomId);
  });

  // Host starts the game
  socket.on('startGame', (roomId) => {
    const r = rooms[roomId];
    if (!r) return;
    if (socket.id !== r.hostId) return; // only host
    if (r.started) return;
    r.started = true;
    r.qIndex = 0;
    r.players.forEach(p => p.score = 0);
    io.to(roomId).emit('gameStarted');
    startQuestion(roomId);
  });

  // Player answers
  socket.on('answer', ({ roomId, answerIndex }) => {
    const r = rooms[roomId];
    if (!r || !r.started) return;
    const currentIdx = r.qIndex;               // next to ask
    const checkIdx = Math.max(0, currentIdx - 1); // currently shown
    const player = r.players.find(p => p.socketId === socket.id);
    if (!player) return;
    if (questions[checkIdx] && questions[checkIdx].correctAnswer === answerIndex){
      player.score += 10;
      sendPlayers(roomId);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    // remove from room(s)
    for (const [roomId, r] of Object.entries(rooms)){
      const wasHost = r.hostId === socket.id;
      r.players = r.players.filter(p => p.socketId !== socket.id);
      sendPlayers(roomId);
      if (r.players.length === 0){
        clearRoomTimer(roomId);
        delete rooms[roomId];
        continue;
      }
      if (wasHost){
        // promote first player as new host if game not started
        r.hostId = r.players[0].socketId;
        io.to(roomId).emit('system', 'Host left. A new host has been assigned.');
      }
    }
  });
});

// ===== Start server =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
