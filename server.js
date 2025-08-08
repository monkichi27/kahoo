const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.static('public')); // เสิร์ฟหน้าเว็บจากโฟลเดอร์ public

// ====== คำถามตัวอย่าง ======
const questions = [
  { question: "What is the capital of France?", options: ["Paris","London","Berlin","Madrid"], correctAnswer: 0 },
  { question: "What is 2 + 2?", options: ["3","4","5","6"], correctAnswer: 1 },
  { question: "What color is the sky?", options: ["Blue","Green","Red","Yellow"], correctAnswer: 0 },
  { question: "Which is the largest planet?", options: ["Earth","Mars","Jupiter","Venus"], correctAnswer: 2 },
  { question: "Who wrote 'Romeo and Juliet'?", options: ["Shakespeare","Dickens","Hemingway","Tolkien"], correctAnswer: 0 }
];

// rooms[roomId] = { hostId, players:[{socketId,name,score}], started, qIndex, timer, answered:Set }
const rooms = Object.create(null);
const makeRoomId = () => Math.random().toString(36).slice(2, 8).toUpperCase();

function clearTimer(roomId){
  const r = rooms[roomId];
  if (r?.timer){ clearInterval(r.timer); r.timer = null; }
}

function sendLobbyPlayers(roomId){
  const r = rooms[roomId];
  if (!r) return;
  // ส่งเฉพาะชื่อสำหรับหน้า Lobby (ไม่มีคะแนน)
  io.to(roomId).emit('lobbyPlayers', r.players.map(p => p.name));
}

function sendScoreboard(roomId){
  const r = rooms[roomId];
  if (!r) return;
  io.to(roomId).emit('scoreboard', r.players.map(p => ({ name: p.name, score: p.score }))
    .sort((a,b)=>b.score-a.score));
}

function startQuestion(roomId){
  const r = rooms[roomId];
  if (!r) return;

  if (r.qIndex >= questions.length){
    // จบเกม
    sendScoreboard(roomId);
    io.to(roomId).emit('gameOver');
    return;
  }

  r.answered = new Set();
  const q = questions[r.qIndex];

  io.to(roomId).emit('question', { index: r.qIndex + 1, total: questions.length, question: q.question, options: q.options });

  // นับถอยหลัง 10 วิ
  let countdown = 10;
  io.to(roomId).emit('timer', countdown);
  clearTimer(roomId);
  r.timer = setInterval(() => {
    countdown--;
    io.to(roomId).emit('timer', countdown);
    if (countdown <= 0){
      endCurrentQuestion(roomId, false);
    }
  }, 1000);
}

function endCurrentQuestion(roomId, early){
  const r = rooms[roomId];
  if (!r) return;
  clearTimer(roomId);
  const q = questions[r.qIndex];

  // ส่งสรุปของข้อ: เฉลย + คะแนนรวม (ไม่โชว์ระหว่างเล่น)
  sendScoreboard(roomId);
  io.to(roomId).emit('questionSummary', {
    correctAnswer: q.correctAnswer,
    index: r.qIndex + 1,
    total: questions.length,
    endedEarly: !!early
  });

  r.qIndex++;
  // ไปข้อถัดไปอัตโนมัติหลัง 3 วินาที
  setTimeout(() => startQuestion(roomId), 3000);
}

// ====== Socket events ======
io.on('connection', (socket) => {
  // สร้างห้อง
  socket.on('createRoom', ({ playerName }) => {
    const roomId = makeRoomId();
    rooms[roomId] = {
      hostId: socket.id,
      players: [{ socketId: socket.id, name: playerName || 'Host', score: 0 }],
      started: false,
      qIndex: 0,
      timer: null,
      answered: new Set()
    };
    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
    sendLobbyPlayers(roomId);
  });

  // เข้าห้อง
  socket.on('join', ({ roomId, playerName }) => {
    const r = rooms[roomId];
    if (!r){ socket.emit('errorMessage', 'Room not found'); return; }
    if (r.started){ socket.emit('errorMessage', 'Game already started'); return; }
    r.players.push({ socketId: socket.id, name: playerName || 'Player', score: 0 });
    socket.join(roomId);
    sendLobbyPlayers(roomId);
  });

  // เริ่มเกม (เฉพาะ Host)
  socket.on('startGame', (roomId) => {
    const r = rooms[roomId];
    if (!r || socket.id !== r.hostId || r.started) return;
    r.started = true;
    r.qIndex = 0;
    r.players.forEach(p => p.score = 0);
    io.to(roomId).emit('gameStarted');
    startQuestion(roomId);
  });

  // รับคำตอบจากผู้เล่น
  socket.on('answer', ({ roomId, answerIndex }) => {
    const r = rooms[roomId];
    if (!r || !r.started) return;
    const q = questions[r.qIndex];              // ยังไม่เพิ่ม index ที่นี่
    const player = r.players.find(p => p.socketId === socket.id);
    if (!player) return;

    // ตอบได้ครั้งเดียวต่อข้อ
    if (r.answered.has(socket.id)) return;
    r.answered.add(socket.id);

    if (q && q.correctAnswer === answerIndex){
      player.score += 10;
    }

    // ถ้าตอบครบทุกคน → ปิดข้อนี้ทันที
    if (r.answered.size >= r.players.length){
      endCurrentQuestion(roomId, true);
    }
  });

  // ออกจากห้อง
  socket.on('disconnect', () => {
    for (const [roomId, r] of Object.entries(rooms)){
      const before = r.players.length;
      r.players = r.players.filter(p => p.socketId !== socket.id);
      if (r.players.length === 0){
        clearTimer(roomId);
        delete rooms[roomId];
        continue;
      }
      // ถ้า host หลุดก่อนเริ่มเกม → โยก host ให้คนแรก
      if (!r.started && r.hostId === socket.id){
        r.hostId = r.players[0].socketId;
      }
      if (!r.started && before !== r.players.length){
        sendLobbyPlayers(roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
