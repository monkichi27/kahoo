const request = require('supertest');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

describe('Kahoo API Tests', () => {
  let server;
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = require('../server');
    server = createServer(app);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/auth/register - should register a new user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user.token).toBeDefined();
    });

    test('POST /api/auth/login - should login existing user', async () => {
      const loginData = {
        usernameOrEmail: 'testuser',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.username).toBe('testuser');
      expect(response.body.user.token).toBeDefined();
    });

    test('POST /api/auth/login - should fail with invalid credentials', async () => {
      const loginData = {
        usernameOrEmail: 'testuser',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body.success).toBeUndefined();
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Categories Endpoint', () => {
    test('GET /api/categories - should return categories', async () => {
      const response = await request(app)
        .get('/api/categories')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('icon');
    });
  });

  describe('Validation Tests', () => {
    test('POST /api/auth/register - should validate required fields', async () => {
      const invalidData = {
        username: 'te', // Too short
        email: 'invalid-email',
        password: '12345' // Too short
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
      expect(Array.isArray(response.body.details)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    test('Should enforce rate limiting on auth endpoints', async () => {
      const userData = {
        username: 'spammer',
        email: 'spam@example.com',
        password: 'password123'
      };

      // Make multiple rapid requests
      const promises = Array(15).fill().map(() => 
        request(app)
          .post('/api/auth/register')
          .send({ ...userData, username: `spammer${Math.random()}` })
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);
  });
});

describe('Socket.IO Game Tests', () => {
  let io, serverSocket, clientSocket;

  beforeAll((done) => {
    const httpServer = createServer();
    io = new Server(httpServer);
    
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: { username: 'testplayer' }
      });
      
      io.on('connection', (socket) => {
        serverSocket = socket;
      });
      
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
  });

  test('should create room', (done) => {
    clientSocket.emit('createRoom', { 
      settings: { 
        questionCount: 5, 
        timeLimit: 10 
      } 
    });
    
    clientSocket.on('roomCreated', (data) => {
      expect(data.roomId).toBeDefined();
      expect(data.roomId.length).toBe(6);
      expect(data.settings).toBeDefined();
      done();
    });
  });

  test('should handle player join', (done) => {
    const roomId = 'TEST01';
    
    // Mock room creation first
    serverSocket.emit('roomCreated', { roomId });
    
    clientSocket.emit('join', { 
      roomId: roomId,
      playerName: 'Player2' 
    });
    
    clientSocket.on('joinedRoom', (data) => {
      expect(data.roomId).toBe(roomId);
      done();
    });
  });

  test('should handle error for invalid room', (done) => {
    clientSocket.emit('join', { 
      roomId: 'INVALID',
      playerName: 'Player2' 
    });
    
    clientSocket.on('errorMessage', (message) => {
      expect(message).toContain('Room not found');
      done();
    });
  });
});