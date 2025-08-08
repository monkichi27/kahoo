const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// สร้าง app และ server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

// คำถามและตัวเลือก
const questions = [
  {
    question: "What is the capital of France?",
    options: ["Paris", "London", "Berlin", "Madrid"],
    correctAnswer: 0 // Paris
  },
  {
    question: "What is 2 + 2?",
    options: ["3", "4", "5", "6"],
    correctAnswer: 1 // 4
  },
  {
    question: "What color is the sky?",
    options: ["Blue", "Green", "Red", "Yellow"],
    correctAnswer: 0 // Blue
  },
  {
    question: "Which is the largest planet?",
    options: ["Earth", "Mars", "Jupiter", "Venus"],
    correctAnswer: 2 // Jupiter
  },
  {
    question: "Who wrote 'Romeo and Juliet'?",
    options: ["Shakespeare", "Dickens", "Hemingway", "Tolkien"],
    correctAnswer: 0 // Shakespeare
  }
];

let rooms = {}; // เก็บข้อมูลห้อง
let currentQuestionIndex = 0;
let timer = null;

app.use(express.static('public')); // ส่งไฟล์ HTML

// ตั้งค่า socket
io.on('connection', (socket) => {
  console.log('A user connected');

  // สร้างห้องหรือเข้าร่วมห้อง
  socket.on('join', (data) => {
    const { roomId, playerName } = data;
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [] };
    }

    rooms[roomId].players.push({ socketId: socket.id, name: playerName, score: 0 });
    socket.join(roomId); // เข้าร่วมห้อง
    io.to(roomId).emit('players', rooms[roomId].players); // ส่งข้อมูลผู้เล่นในห้อง

    console.log(`${playerName} joined room ${roomId}`);
  });

  // ส่งคำถามไปยังห้อง
  socket.on('startGame', (roomId) => {
    if (rooms[roomId] && currentQuestionIndex < questions.length) {
      io.to(roomId).emit('question', questions[currentQuestionIndex]);
      startTimer(roomId);
      currentQuestionIndex++;
    }
  });

  // รับคำตอบจากผู้เล่น
  socket.on('answer', (data) => {
    const { roomId, answerIndex } = data;
    const player = rooms[roomId].players.find(p => p.socketId === socket.id);
    if (questions[currentQuestionIndex - 1].correctAnswer === answerIndex) {
      player.score += 10; // เพิ่มคะแนน
    }
    io.to(roomId).emit('players', rooms[roomId].players);  // ส่งข้อมูลคะแนนใหม่
  });

  // ฟังก์ชั่นนับถอยหลัง
  function startTimer(roomId) {
    let countdown = 10; // ตั้งเวลา 10 วินาที
    io.to(roomId).emit('timer', countdown);

    timer = setInterval(() => {
      countdown--;
      io.to(roomId).emit('timer', countdown);
      if (countdown <= 0) {
        clearInterval(timer);
        io.to(roomId).emit('endQuestion', questions[currentQuestionIndex - 1]);
      }
    }, 1000);
  }

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
