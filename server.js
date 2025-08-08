const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// สร้าง app และ server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// สั่งให้ Express ส่งไฟล์ index.html จาก public
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
  // สามารถเพิ่มคำถามเพิ่มเติมได้
];

let players = [];
let currentQuestion = 0;

// หน้าแรกให้ผู้เล่นกรอกชื่อ
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// ตั้งค่า socket
io.on('connection', (socket) => {
  console.log('A user connected');

  // ให้ผู้เล่นกรอกชื่อ
  socket.on('join', (name) => {
    players.push({ socketId: socket.id, name: name, score: 0 });
    io.emit('players', players);  // ส่งข้อมูลผู้เล่นทั้งหมด
  });

  // ส่งคำถามไปยังผู้เล่น
  socket.on('startGame', () => {
    if (currentQuestion < questions.length) {
      io.emit('question', questions[currentQuestion]);
      currentQuestion++;
    }
  });

  // รับคำตอบจากผู้เล่น
  socket.on('answer', (data) => {
    const player = players.find(p => p.socketId === socket.id);
    if (questions[currentQuestion - 1].correctAnswer === data.answerIndex) {
      player.score += 10; // เพิ่มคะแนน
    }
    io.emit('players', players);  // ส่งข้อมูลคะแนนใหม่
  });

  // เมื่อผู้เล่นออกจากเกม
  socket.on('disconnect', () => {
    console.log('A user disconnected');
    players = players.filter(p => p.socketId !== socket.id);
    io.emit('players', players);
  });
});

// เปิด server ที่ port 3000
server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
