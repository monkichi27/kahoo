const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// สร้าง app และ server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// กำหนดคำถามและคำตอบ
const questions = [
  {
    question: "What is the capital of France?",
    options: ["Paris", "London", "Berlin", "Madrid"],
    correctAnswer: 0 // เลือกข้อที่ถูกต้อง (Index)
  },
  {
    question: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    correctAnswer: 1
  },
];

let rooms = {}; // เก็บข้อมูลห้อง
let currentQuestion = 0;

// หน้าแรกให้ผู้เล่นกรอกชื่อ
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// ตั้งค่า socket
io.on('connection', (socket) => {
  console.log('A user connected');

  // ให้ผู้เล่นกรอกชื่อ
  socket.on('join', (data) => {
    const { roomId, playerName } = data;
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [] };
    }

    rooms[roomId].players.push({ socketId: socket.id, name: playerName, score: 0 });

    socket.join(roomId);  // ผู้เล่นเข้าร่วมห้อง

    console.log(`User ${playerName} joined room ${roomId}`);

    io.to(roomId).emit('players', rooms[roomId].players); // ส่งข้อมูลผู้เล่นในห้อง
  });

  // ส่งคำถามไปยังห้อง
  socket.on('startGame', (roomId) => {
    if (rooms[roomId] && currentQuestion < questions.length) {
      io.to(roomId).emit('question', questions[currentQuestion]);
      currentQuestion++;
    }
  });

  // รับคำตอบจากผู้เล่น
  socket.on('answer', (data) => {
    const { roomId, answerIndex } = data;
    const player = rooms[roomId].players.find(p => p.socketId === socket.id);
    if (questions[currentQuestion - 1].correctAnswer === answerIndex) {
      player.score += 10; // เพิ่มคะแนน
    }
    io.to(roomId).emit('players', rooms[roomId].players);  // ส่งข้อมูลคะแนนใหม่
  });

  // เมื่อผู้เล่นออกจากเกม
  socket.on('disconnect', () => {
    console.log('A user disconnected');
    for (let roomId in rooms) {
      rooms[roomId].players = rooms[roomId].players.filter(p => p.socketId !== socket.id);
      io.to(roomId).emit('players', rooms[roomId].players);
    }
  });
});

// เปิด server ที่ port 3000
server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
