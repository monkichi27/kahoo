const db = require('../database/db');

describe('Database Tests', () => {
  beforeAll(async () => {
    // Ensure database is initialized
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(() => {
    db.close();
  });

  describe('Categories', () => {
    test('should fetch all categories', async () => {
      const categories = await db.getCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]).toHaveProperty('name');
      expect(categories[0]).toHaveProperty('icon');
    });

    test('should fetch category by ID', async () => {
      const categories = await db.getCategories();
      const firstCategory = categories[0];
      
      const category = await db.getCategoryById(firstCategory.id);
      expect(category).toBeDefined();
      expect(category.name).toBe(firstCategory.name);
    });
  });

  describe('Questions', () => {
    test('should fetch random questions', async () => {
      const questions = await db.getRandomQuestions(5);
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeLessThanOrEqual(5);
      
      if (questions.length > 0) {
        const question = questions[0];
        expect(question).toHaveProperty('question');
        expect(question).toHaveProperty('options');
        expect(question).toHaveProperty('correct_answer');
        expect(question).toHaveProperty('difficulty');
      }
    });

    test('should fetch questions by category', async () => {
      const categories = await db.getCategories();
      if (categories.length > 0) {
        const categoryId = categories[0].id;
        const questions = await db.getQuestionsByCategory(categoryId, null, 3);
        
        expect(Array.isArray(questions)).toBe(true);
        questions.forEach(question => {
          expect(question.category_id).toBe(categoryId);
        });
      }
    });

    test('should filter questions by difficulty', async () => {
      const easyQuestions = await db.getRandomQuestions(5, 'easy');
      expect(Array.isArray(easyQuestions)).toBe(true);
      
      easyQuestions.forEach(question => {
        expect(question.difficulty).toBe('easy');
      });
    });

    test('should fetch question by ID', async () => {
      const questions = await db.getRandomQuestions(1);
      if (questions.length > 0) {
        const questionId = questions[0].id;
        const question = await db.getQuestionById(questionId);
        
        expect(question).toBeDefined();
        expect(question.id).toBe(questionId);
      }
    });
  });

  describe('Users', () => {
    const testUser = {
      username: 'testuser_db',
      email: 'testdb@example.com',
      password: 'hashedpassword123'
    };

    test('should create a user', async () => {
      const result = await db.createUser(testUser.username, testUser.email, testUser.password);
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('number');
    });

    test('should fetch user by username', async () => {
      const user = await db.getUserByUsername(testUser.username);
      expect(user).toBeDefined();
      expect(user.username).toBe(testUser.username);
      expect(user.email).toBe(testUser.email);
    });

    test('should fetch user by email', async () => {
      const user = await db.getUserByEmail(testUser.email);
      expect(user).toBeDefined();
      expect(user.username).toBe(testUser.username);
      expect(user.email).toBe(testUser.email);
    });

    test('should return null for non-existent user', async () => {
      const user = await db.getUserByUsername('nonexistentuser');
      expect(user).toBeUndefined();
    });
  });

  describe('Games', () => {
    let testUserId;
    let testGameId;

    beforeAll(async () => {
      // Create a test user for game tests
      const result = await db.createUser('gametest', 'gametest@example.com', 'password');
      testUserId = result.id;
    });

    test('should create a game', async () => {
      const roomId = 'TEST01';
      const settings = {
        questionCount: 5,
        timeLimit: 10,
        category: null,
        difficulty: 'medium'
      };

      const result = await db.createGame(roomId, testUserId, settings);
      testGameId = result.id;
      
      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('number');
    });

    test('should fetch game by room ID', async () => {
      const game = await db.getGameByRoomId('TEST01');
      expect(game).toBeDefined();
      expect(game.room_id).toBe('TEST01');
      expect(game.host_id).toBe(testUserId);
    });

    test('should add game participant', async () => {
      const result = await db.addGameParticipant(testGameId, testUserId, 'gametest');
      expect(result.id).toBeDefined();
    });

    test('should update game status', async () => {
      const result = await db.updateGameStatus(testGameId, 'playing', new Date().toISOString());
      expect(result.changes).toBe(1);
    });

    test('should record answer', async () => {
      const questions = await db.getRandomQuestions(1);
      if (questions.length > 0) {
        const questionId = questions[0].id;
        const result = await db.recordAnswer(testGameId, testUserId, questionId, 0, true, 5000);
        expect(result.id).toBeDefined();
      }
    });

    test('should get user stats', async () => {
      const stats = await db.getUserStats(testUserId);
      expect(stats).toBeDefined();
      expect(stats.id).toBe(testUserId);
      expect(typeof stats.games_played).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('should handle duplicate username creation', async () => {
      const username = 'duplicatetest';
      const email1 = 'dup1@example.com';
      const email2 = 'dup2@example.com';
      
      // First user should succeed
      await db.createUser(username, email1, 'password');
      
      // Second user with same username should fail
      await expect(db.createUser(username, email2, 'password')).rejects.toThrow();
    });

    test('should handle invalid database queries', async () => {
      await expect(db.get('SELECT * FROM nonexistent_table')).rejects.toThrow();
    });
  });
});