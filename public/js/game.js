// Global variables
let socket;
let currentUser = null;
let currentRoom = null;
let gameState = 'auth'; // auth, lobby, playing, summary, finished
let soundEnabled = localStorage.getItem('kahoo-sound') !== 'false';
let categories = [];

// Audio context and sounds
let audioContext;
const sounds = {};

// Initialize app
document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupEventListeners();
  await loadCategories();
  initSounds();
  updateSoundToggle();
  
  // Check URL for room parameter
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room');
  if (roomId) {
    document.getElementById('joinRoomId').value = roomId.toUpperCase();
  }
}

function setupEventListeners() {
  // Auth tabs
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
  });

  // Auth buttons
  document.getElementById('createGuestBtn').addEventListener('click', showSettings);
  document.getElementById('joinGuestBtn').addEventListener('click', joinAsGuest);
  document.getElementById('loginBtn').addEventListener('click', handleLogin);
  document.getElementById('registerBtn').addEventListener('click', handleRegister);

  // Settings
  document.getElementById('saveSettings').addEventListener('click', createRoomWithSettings);
  document.getElementById('cancelSettings').addEventListener('click', () => showScreen('auth'));

  // Lobby
  document.getElementById('startGameBtn').addEventListener('click', startGame);
  document.getElementById('leaveRoomBtn').addEventListener('click', leaveRoom);

  // Sound toggle
  document.getElementById('soundToggle').addEventListener('click', toggleSound);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-content').forEach(c => c.classList.add('hide'));
  
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(`${tab}-tab`).classList.remove('hide');
}

async function loadCategories() {
  try {
    const response = await fetch('/api/categories');
    categories = await response.json();
    
    const categorySelect = document.getElementById('category');
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = `${cat.icon} ${cat.name}`;
      categorySelect.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
}

// Sound system
function initSounds() {
  // Initialize AudioContext on first user interaction
  document.addEventListener('click', initAudioContext, { once: true });
  document.addEventListener('keydown', initAudioContext, { once: true });
}

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create simple beep sounds using Web Audio API
    sounds.correct = createBeep(800, 0.2, 'sine');
    sounds.incorrect = createBeep(300, 0.3, 'sawtooth');
    sounds.tick = createBeep(600, 0.1, 'square');
    sounds.start = createBeep(1000, 0.5, 'triangle');
    sounds.finish = createBeep(500, 1, 'sine');
  }
}

function createBeep(frequency, duration, type = 'sine') {
  return () => {
    if (!soundEnabled || !audioContext) return;
    
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Audio playback failed:', error);
    }
  };
}

function playSound(soundName) {
  if (sounds[soundName]) {
    sounds[soundName]();
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('kahoo-sound', soundEnabled.toString());
  updateSoundToggle();
  
  if (soundEnabled) {
    playSound('tick');
  }
}

function updateSoundToggle() {
  const toggle = document.getElementById('soundToggle');
  toggle.textContent = soundEnabled ? '🔊' : '🔇';
  toggle.classList.toggle('muted', !soundEnabled);
}

// Notification system
function showNotification(message, type = 'info', duration = 3000) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.getElementById('notifications').appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, duration);
}

// Screen management
function showScreen(screen) {
  document.querySelectorAll('.card').forEach(card => card.classList.add('hide'));
  document.getElementById(screen).classList.remove('hide');
  gameState = screen;
}

// Authentication
function showSettings() {
  const guestName = document.getElementById('guestName').value.trim();
  if (!guestName) {
    showNotification('กรุณาใส่ชื่อผู้เล่น', 'error');
    return;
  }
  showScreen('settings');
}

function joinAsGuest() {
  const guestName = document.getElementById('guestName').value.trim();
  const roomId = document.getElementById('joinRoomId').value.trim().toUpperCase();
  
  if (!guestName) {
    showNotification('กรุณาใส่ชื่อผู้เล่น', 'error');
    return;
  }
  
  if (!roomId || roomId.length !== 6) {
    showNotification('รหัสห้องต้องเป็น 6 ตัวอักษร', 'error');
    return;
  }

  currentUser = { username: guestName, isGuest: true };
  connectSocket();
  joinRoom(roomId);
}

async function handleLogin() {
  const usernameOrEmail = document.getElementById('loginInput').value.trim();
  const password = document.getElementById('loginPassword').value;
  
  if (!usernameOrEmail || !password) {
    showNotification('กรุณากรอกข้อมูลให้ครบ', 'error');
    return;
  }

  const btn = document.getElementById('loginBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail, password })
    });

    const data = await response.json();
    
    if (data.success) {
      currentUser = data.user;
      currentUser.isGuest = false;
      showNotification(`ยินดีต้อนรับ ${data.user.username}!`, 'success');
      showScreen('settings');
      connectSocket();
    } else {
      showNotification(data.error || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
    }
  } catch (error) {
    showNotification('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

async function handleRegister() {
  const username = document.getElementById('registerUsername').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  
  if (!username || !email || !password) {
    showNotification('กรุณากรอกข้อมูลให้ครบ', 'error');
    return;
  }

  if (password.length < 6) {
    showNotification('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'error');
    return;
  }

  const btn = document.getElementById('registerBtn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();
    
    if (data.success) {
      currentUser = data.user;
      currentUser.isGuest = false;
      showNotification(`สมัครสมาชิกสำเร็จ! ยินดีต้อนรับ ${data.user.username}`, 'success');
      showScreen('settings');
      connectSocket();
    } else {
      showNotification(data.error || 'สมัครสมาชิกไม่สำเร็จ', 'error');
    }
  } catch (error) {
    showNotification('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// Socket connection
function connectSocket() {
  const auth = currentUser.isGuest 
    ? { username: currentUser.username }
    : { token: currentUser.token };

  socket = io({
    auth: auth,
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('Connected to server');
    showNotification('เชื่อมต่อสำเร็จ!', 'success', 2000);
  });

  socket.on('disconnect', () => {
    showNotification('การเชื่อมต่อขาดหายไป', 'error');
  });

  socket.on('roomCreated', handleRoomCreated);
  socket.on('joinedRoom', handleJoinedRoom);
  socket.on('lobbyPlayers', updateLobbyPlayers);
  socket.on('gameStarted', handleGameStarted);
  socket.on('question', handleQuestion);
  socket.on('timer', updateTimer);
  socket.on('questionSummary', handleQuestionSummary);
  socket.on('scoreboard', updateScoreboard);
  socket.on('gameOver', handleGameOver);
  socket.on('answerSubmitted', handleAnswerSubmitted);
  socket.on('errorMessage', (msg) => showNotification(msg, 'error'));

  socket.on('connect_error', (error) => {
    showNotification('ไม่สามารถเชื่อมต่อได้: ' + error.message, 'error');
  });
}

// Game functions
function createRoomWithSettings() {
  const settings = {
    questionCount: parseInt(document.getElementById('questionCount').value),
    timeLimit: parseInt(document.getElementById('timeLimit').value),
    category: parseInt(document.getElementById('category').value) || null,
    difficulty: document.getElementById('difficulty').value || null
  };

  socket.emit('createRoom', { settings });
}

function joinRoom(roomId) {
  socket.emit('join', { 
    roomId: roomId,
    playerName: currentUser.username 
  });
}

function startGame() {
  if (currentRoom) {
    socket.emit('startGame', { roomId: currentRoom.id });
    playSound('start');
  }
}

function leaveRoom() {
  if (socket) {
    socket.disconnect();
  }
  showScreen('auth');
  currentRoom = null;
  showNotification('ออกจากห้องแล้ว', 'info');
}

function submitAnswer(answerIndex) {
  if (currentRoom && gameState === 'playing') {
    socket.emit('answer', { 
      roomId: currentRoom.id, 
      answerIndex: answerIndex 
    });
  }
}

// Socket event handlers
function handleRoomCreated(data) {
  currentRoom = { id: data.roomId, settings: data.settings, isHost: true };
  showLobby();
}

function handleJoinedRoom(data) {
  currentRoom = { id: data.roomId, settings: data.settings, isHost: false };
  showLobby();
}

function showLobby() {
  document.getElementById('roomIdDisplay').textContent = currentRoom.id;
  const shareUrl = `${window.location.origin}?room=${currentRoom.id}`;
  document.getElementById('shareLink').dataset.url = shareUrl;
  
  document.getElementById('startGameBtn').style.display = currentRoom.isHost ? 'inline-block' : 'none';
  
  showScreen('lobby');
  showNotification(`เข้าห้อง ${currentRoom.id} แล้ว`, 'success');
}

function updateLobbyPlayers(players) {
  const grid = document.getElementById('playersGrid');
  grid.innerHTML = '';
  
  players.forEach(player => {
    const playerCard = document.createElement('div');
    playerCard.className = `player-card ${player.isHost ? 'host' : ''}`;
    playerCard.innerHTML = `
      <div>👤 ${player.name}</div>
      ${player.isHost ? '<div style="font-size: 12px; color: gold;">Host</div>' : ''}
    `;
    grid.appendChild(playerCard);
  });

  // Enable start button if host and has players
  if (currentRoom && currentRoom.isHost) {
    document.getElementById('startGameBtn').disabled = players.length === 0;
  }
}

function handleGameStarted() {
  showScreen('game');
  showNotification('เกมเริ่มแล้ว!', 'success');
  playSound('start');
}

function handleQuestion(questionData) {
  gameState = 'playing';
  
  // Update question info
  document.getElementById('questionNumber').textContent = questionData.index;
  document.getElementById('totalQuestions').textContent = questionData.total;
  document.getElementById('questionText').textContent = questionData.question;
  
  // Update progress bar
  const progress = (questionData.index - 1) / questionData.total * 100;
  document.getElementById('progressFill').style.width = progress + '%';
  
  // Update category and difficulty
  document.getElementById('questionCategory').textContent = questionData.category || 'General';
  const difficultyBadge = document.getElementById('questionDifficulty');
  difficultyBadge.textContent = questionData.difficulty || 'Medium';
  difficultyBadge.className = `difficulty-badge difficulty-${questionData.difficulty || 'medium'}`;

  // Create options
  const optionsGrid = document.getElementById('optionsGrid');
  optionsGrid.innerHTML = '';
  
  const colors = ['opt1', 'opt2', 'opt3', 'opt4'];
  
  questionData.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.className = `option ${colors[index]}`;
    button.innerHTML = `<span>${option}</span>`;
    button.onclick = () => selectAnswer(button, index);
    optionsGrid.appendChild(button);
  });
}

function selectAnswer(button, answerIndex) {
  if (gameState !== 'playing') return;
  
  // Disable all options
  document.querySelectorAll('.option').forEach(opt => {
    opt.disabled = true;
    opt.style.cursor = 'not-allowed';
  });
  
  // Mark selected
  button.classList.add('selected');
  
  // Submit answer
  submitAnswer(answerIndex);
  playSound('tick');
}

function updateTimer(timeLeft) {
  const timerDisplay = document.getElementById('timerDisplay');
  const timerCircle = document.getElementById('timerCircle');
  
  timerDisplay.textContent = timeLeft;
  
  // Update circular progress
  const maxTime = currentRoom ? currentRoom.settings.timeLimit : 10;
  const percentage = (timeLeft / maxTime) * 100;
  timerCircle.style.setProperty('--pct', percentage);
  
  // Add warning animation when time is low
  if (timeLeft <= 3 && timeLeft > 0) {
    timerCircle.classList.add('warning');
    playSound('tick');
  } else {
    timerCircle.classList.remove('warning');
  }
}

function handleQuestionSummary(data) {
  gameState = 'summary';
  showScreen('summary');
  
  document.getElementById('summaryNumber').textContent = data.index;
  document.getElementById('summaryTotal').textContent = data.total;
  
  // Show correct answer
  const answerReveal = document.getElementById('answerReveal');
  answerReveal.innerHTML = `
    <div style="font-size: 18px; font-weight: 600; color: var(--success);">
      ✅ เฉลย: ตัวเลือกที่ ${data.correctAnswer + 1}
    </div>
    ${data.explanation ? `<div style="margin-top: 10px; opacity: 0.8;">${data.explanation}</div>` : ''}
    ${data.endedEarly ? '<div style="color: var(--warning); margin-top: 5px;">⚡ ผู้เล่นทุกคนตอบครบแล้ว</div>' : ''}
  `;
}

function updateScoreboard(scoreboard) {
  const containers = ['currentScoreboard', 'finalScoreboard'];
  
  containers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    scoreboard.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'score-row';
      
      const position = index + 1;
      let positionIcon = '';
      if (position === 1) positionIcon = '👑';
      else if (position === 2) positionIcon = '🥈';
      else if (position === 3) positionIcon = '🥉';
      
      row.innerHTML = `
        <div class="score-position">${positionIcon} ${position}.</div>
        <div class="score-name">
          ${player.name} ${player.isHost ? '👑' : ''}
        </div>
        <div class="score-points">${player.score} คะแนน</div>
      `;
      
      container.appendChild(row);
    });
  });
}

function handleAnswerSubmitted(data) {
  showNotification('ส่งคำตอบแล้ว!', 'success', 1500);
}

function handleGameOver(data) {
  gameState = 'finished';
  showScreen('gameOver');
  
  const gameStats = document.getElementById('gameStats');
  const duration = Math.round(data.duration / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  
  gameStats.innerHTML = `
    <div style="font-size: 16px; margin-bottom: 10px;">
      🕒 เวลาที่ใช้: ${minutes}:${seconds.toString().padStart(2, '0')}
    </div>
    <div style="font-size: 16px;">
      📝 จำนวนคำถาม: ${data.totalQuestions} ข้อ
    </div>
  `;
  
  playSound('finish');
  showNotification('เกมจบแล้ว! 🎉', 'success', 4000);
  
  // Show stats button for registered users
  if (!currentUser.isGuest) {
    document.getElementById('viewStatsBtn').classList.remove('hide');
  }
}

// Utility functions
function copyShareLink() {
  const url = document.getElementById('shareLink').dataset.url;
  if (url) {
    navigator.clipboard.writeText(url).then(() => {
      showNotification('คัดลอกลิงก์แล้ว!', 'success', 2000);
    }).catch(() => {
      showNotification('ไม่สามารถคัดลอกได้', 'error');
    });
  }
}

function handleKeyboard(event) {
  if (gameState === 'playing') {
    const key = event.key;
    if (['1', '2', '3', '4'].includes(key)) {
      const index = parseInt(key) - 1;
      const option = document.querySelectorAll('.option')[index];
      if (option && !option.disabled) {
        selectAnswer(option, index);
      }
    }
  }
}

// Expose functions to global scope for inline event handlers
window.copyShareLink = copyShareLink;