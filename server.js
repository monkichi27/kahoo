const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

// Import custom modules
const db = require('./database/db');
const authService = require('./auth/auth');
const { authenticateSocket } = require('./middleware/auth');
const { 
  registerValidation, 
  loginValidation, 
  createRoomValidation, 
  joinRoomValidation,
  handleValidationErrors,
  sanitizePlayerName,
  sanitizeRoomId 
} = require('./middleware/validation');

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "data:", "blob:"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // Replace with your production domain
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // limit each IP to 10 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);

// Serve static files
app.use(express.static('public'));

// Socket.IO setup
const io = socketIo(server, { 
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Authentication middleware for socket connections
io.use(authenticateSocket);

// Game state management
class GameManager {
  constructor() {
    this.rooms = new Map();
    this.playerSockets = new Map(); // socketId -> roomId mapping
  }

  createRoom(hostSocketId, hostUser, settings = {}) {
    const roomId = this.generateRoomId();
    const defaultSettings = {
      timeLimit: 10,
      questionCount: 10,
      category: null,
      difficulty: null,
      showLeaderboardBetween: true
    };

    const room = {
      id: roomId,
      hostSocketId,
      hostUser,
      players: new Map(),
      settings: { ...defaultSettings, ...settings },
      status: 'waiting', // waiting, playing, finished
      currentQuestion: null,
      questionIndex: 0,
      questions: [],
      timer: null,
      answeredPlayers: new Set(),
      gameStartTime: null,
      gameEndTime: null,
      gameId: null // Database game ID
    };

    // Add host as first player
    room.players.set(hostSocketId, {
      socketId: hostSocketId,
      user: hostUser,
      name: hostUser.username,
      score: 0,
      isHost: true,
      answers: []
    });

    this.rooms.set(roomId, room);
    this.playerSockets.set(hostSocketId, roomId);
    
    return room;
  }

  joinRoom(roomId, socketId, user) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status !== 'waiting') return null;

    const player = {
      socketId,
      user,
      name: user.username,
      score: 0,
      isHost: false,
      answers: []
    };

    room.players.set(socketId, player);
    this.playerSockets.set(socketId, roomId);
    
    return room;
  }

  removePlayer(socketId) {
    const roomId = this.playerSockets.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.players.delete(socketId);
    this.playerSockets.delete(socketId);

    // If host left and room is waiting, assign new host
    if (room.hostSocketId === socketId && room.status === 'waiting' && room.players.size > 0) {
      const newHost = Array.from(room.players.values())[0];
      newHost.isHost = true;
      room.hostSocketId = newHost.socketId;
      room.hostUser = newHost.user;
    }

    // Delete room if empty
    if (room.players.size === 0) {
      this.clearTimer(roomId);
      this.rooms.delete(roomId);
      return null;
    }

    return room;
  }

  generateRoomId() {
    let roomId;
    do {
      roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (this.rooms.has(roomId));
    return roomId;
  }

  clearTimer(roomId) {
    const room = this.rooms.get(roomId);
    if (room?.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }
  }

  async loadQuestions(room) {
    try {
      const { category, difficulty, questionCount } = room.settings;
      
      let questions;
      if (category) {
        questions = await db.getQuestionsByCategory(category, difficulty, questionCount);
      } else {
        questions = await db.getRandomQuestions(questionCount, difficulty);
      }

      // Parse options from JSON
      questions = questions.map(q => ({
        ...q,
        options: JSON.parse(q.options)
      }));

      room.questions = questions;
      return questions.length > 0;
    } catch (error) {
      console.error('Error loading questions:', error);
      return false;
    }
  }

  async startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'waiting') return false;

    // Load questions
    const questionsLoaded = await this.loadQuestions(room);
    if (!questionsLoaded) return false;

    // Create game record in database
    try {
      if (room.hostUser && !room.hostUser.isGuest) {
        const gameResult = await db.createGame(roomId, room.hostUser.id, room.settings);
        room.gameId = gameResult.id;

        // Add participants to database
        for (const player of room.players.values()) {
          if (!player.user.isGuest) {
            await db.addGameParticipant(room.gameId, player.user.id, player.name);
          }
        }

        await db.updateGameStatus(room.gameId, 'playing', new Date().toISOString());
      }
    } catch (error) {
      console.error('Error creating game record:', error);
    }

    room.status = 'playing';
    room.questionIndex = 0;
    room.gameStartTime = Date.now();
    
    // Reset player scores
    room.players.forEach(player => {
      player.score = 0;
      player.answers = [];
    });

    this.startQuestion(roomId);
    return true;
  }

  startQuestion(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    if (room.questionIndex >= room.questions.length) {
      this.endGame(roomId);
      return;
    }

    room.answeredPlayers = new Set();
    room.currentQuestion = room.questions[room.questionIndex];
    
    const questionData = {
      index: room.questionIndex + 1,
      total: room.questions.length,
      question: room.currentQuestion.question,
      options: room.currentQuestion.options,
      category: room.currentQuestion.category_name,
      difficulty: room.currentQuestion.difficulty,
      timeLimit: room.settings.timeLimit
    };

    io.to(roomId).emit('question', questionData);

    // Start countdown
    let timeLeft = room.settings.timeLimit;
    io.to(roomId).emit('timer', timeLeft);
    
    this.clearTimer(roomId);
    room.timer = setInterval(() => {
      timeLeft--;
      io.to(roomId).emit('timer', timeLeft);
      
      if (timeLeft <= 0) {
        this.endCurrentQuestion(roomId, false);
      }
    }, 1000);
  }

  async endCurrentQuestion(roomId, endedEarly = false) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.clearTimer(roomId);
    
    const currentQuestion = room.currentQuestion;
    if (!currentQuestion) return;

    // Calculate scores and record answers
    const results = [];
    for (const [socketId, player] of room.players) {
      const answer = player.answers[room.questionIndex];
      if (answer) {
        const isCorrect = answer.answerIndex === currentQuestion.correct_answer;
        if (isCorrect) {
          const timeBonus = Math.max(0, Math.floor((answer.timeLeft / room.settings.timeLimit) * 5));
          const scoreGain = 10 + timeBonus;
          player.score += scoreGain;
          
          results.push({ player: player.name, correct: true, scoreGain });
        } else {
          results.push({ player: player.name, correct: false, scoreGain: 0 });
        }

        // Record in database
        if (room.gameId && !player.user.isGuest) {
          try {
            await db.recordAnswer(
              room.gameId,
              player.user.id,
              currentQuestion.id,
              answer.answerIndex,
              isCorrect,
              answer.timeTaken
            );
          } catch (error) {
            console.error('Error recording answer:', error);
          }
        }
      }
    }

    // Send question summary
    const summary = {
      correctAnswer: currentQuestion.correct_answer,
      explanation: currentQuestion.explanation || null,
      index: room.questionIndex + 1,
      total: room.questions.length,
      endedEarly,
      results
    };

    io.to(roomId).emit('questionSummary', summary);

    // Send updated scoreboard
    if (room.settings.showLeaderboardBetween) {
      this.sendScoreboard(roomId);
    }

    room.questionIndex++;
    
    // Continue to next question after delay
    setTimeout(() => {
      this.startQuestion(roomId);
    }, 3000);
  }

  async endGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.status = 'finished';
    room.gameEndTime = Date.now();
    this.clearTimer(roomId);

    // Update database
    if (room.gameId) {
      try {
        await db.updateGameStatus(room.gameId, 'finished', null, new Date().toISOString());
        
        // Update participant scores
        for (const player of room.players.values()) {
          if (!player.user.isGuest) {
            await db.updateParticipantScore(room.gameId, player.user.id, player.score);
          }
        }
      } catch (error) {
        console.error('Error updating game record:', error);
      }
    }

    this.sendScoreboard(roomId);
    io.to(roomId).emit('gameOver', {
      duration: room.gameEndTime - room.gameStartTime,
      totalQuestions: room.questions.length
    });
  }

  sendScoreboard(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const scoreboard = Array.from(room.players.values())
      .map(p => ({ 
        name: p.name, 
        score: p.score,
        isHost: p.isHost
      }))
      .sort((a, b) => b.score - a.score);

    io.to(roomId).emit('scoreboard', scoreboard);
  }

  sendLobbyPlayers(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const players = Array.from(room.players.values()).map(p => ({
      name: p.name,
      isHost: p.isHost
    }));

    io.to(roomId).emit('lobbyPlayers', players);
  }

  submitAnswer(roomId, socketId, answerIndex) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return false;

    const player = room.players.get(socketId);
    if (!player) return false;

    // Check if already answered
    if (room.answeredPlayers.has(socketId)) return false;

    room.answeredPlayers.add(socketId);
    
    // Record answer
    const timeTaken = (room.settings.timeLimit * 1000) - (Date.now() - room.gameStartTime);
    const timeLeft = Math.max(0, Math.ceil(timeTaken / 1000));
    
    if (!player.answers[room.questionIndex]) {
      player.answers[room.questionIndex] = {
        answerIndex,
        timeTaken: Math.max(0, room.settings.timeLimit - timeLeft),
        timeLeft
      };
    }

    // If all players answered, end question early
    if (room.answeredPlayers.size >= room.players.size) {
      this.endCurrentQuestion(roomId, true);
    }

    return true;
  }
}

const gameManager = new GameManager();

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.post('/api/auth/register', registerValidation, handleValidationErrors, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = await authService.registerUser(username, email, password);
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', loginValidation, handleValidationErrors, async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    const user = await authService.loginUser(usernameOrEmail, password);
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.getCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/api/user/stats/:userId', async (req, res) => {
  try {
    const stats = await db.getUserStats(req.params.userId);
    res.json(stats || {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.username} (${socket.user.isGuest ? 'Guest' : 'Registered'})`);

  // Create room
  socket.on('createRoom', ({ settings }) => {
    try {
      const room = gameManager.createRoom(socket.id, socket.user, settings);
      socket.join(room.id);
      socket.emit('roomCreated', { roomId: room.id, settings: room.settings });
      gameManager.sendLobbyPlayers(room.id);
    } catch (error) {
      socket.emit('errorMessage', 'Failed to create room');
    }
  });

  // Join room
  socket.on('join', ({ roomId, playerName }) => {
    try {
      roomId = sanitizeRoomId(roomId);
      if (playerName) {
        socket.user.username = sanitizePlayerName(playerName);
      }
      
      const room = gameManager.joinRoom(roomId, socket.id, socket.user);
      if (!room) {
        socket.emit('errorMessage', 'Room not found or game already started');
        return;
      }

      socket.join(roomId);
      socket.emit('joinedRoom', { roomId, settings: room.settings });
      gameManager.sendLobbyPlayers(roomId);
    } catch (error) {
      socket.emit('errorMessage', 'Failed to join room');
    }
  });

  // Start game (host only)
  socket.on('startGame', async ({ roomId }) => {
    try {
      const room = gameManager.rooms.get(roomId);
      if (!room || room.hostSocketId !== socket.id) {
        socket.emit('errorMessage', 'Only the host can start the game');
        return;
      }

      if (room.players.size < 1) {
        socket.emit('errorMessage', 'Need at least 1 player to start');
        return;
      }

      const started = await gameManager.startGame(roomId);
      if (started) {
        io.to(roomId).emit('gameStarted');
      } else {
        socket.emit('errorMessage', 'Failed to start game - no questions available');
      }
    } catch (error) {
      socket.emit('errorMessage', 'Failed to start game');
    }
  });

  // Submit answer
  socket.on('answer', ({ roomId, answerIndex }) => {
    try {
      const success = gameManager.submitAnswer(roomId, socket.id, answerIndex);
      if (success) {
        socket.emit('answerSubmitted', { answerIndex });
      }
    } catch (error) {
      socket.emit('errorMessage', 'Failed to submit answer');
    }
  });

  // Get room info
  socket.on('getRoomInfo', ({ roomId }) => {
    const room = gameManager.rooms.get(roomId);
    if (room) {
      socket.emit('roomInfo', {
        id: room.id,
        status: room.status,
        settings: room.settings,
        playerCount: room.players.size
      });
    } else {
      socket.emit('errorMessage', 'Room not found');
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.username}`);
    const room = gameManager.removePlayer(socket.id);
    if (room) {
      gameManager.sendLobbyPlayers(room.id);
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Kahoo server running on http://localhost:${PORT}`);
  console.log('📊 Database initialized and ready');
});