const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');

class Database {
  constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error connecting to SQLite database:', err.message);
      } else {
        console.log('Connected to SQLite database');
      }
    });
  }

  // Generic query methods
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // User methods
  async createUser(username, email, passwordHash) {
    const sql = `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`;
    return this.run(sql, [username, email, passwordHash]);
  }

  async getUserByUsername(username) {
    const sql = `SELECT * FROM users WHERE username = ?`;
    return this.get(sql, [username]);
  }

  async getUserByEmail(email) {
    const sql = `SELECT * FROM users WHERE email = ?`;
    return this.get(sql, [email]);
  }

  async updateUserStats(userId, totalGames, totalScore, bestScore) {
    const sql = `UPDATE users SET total_games = ?, total_score = ?, best_score = ? WHERE id = ?`;
    return this.run(sql, [totalGames, totalScore, bestScore, userId]);
  }

  // Category methods
  async getCategories() {
    const sql = `SELECT * FROM categories ORDER BY name`;
    return this.all(sql);
  }

  async getCategoryById(id) {
    const sql = `SELECT * FROM categories WHERE id = ?`;
    return this.get(sql, [id]);
  }

  // Question methods
  async getQuestionsByCategory(categoryId, difficulty = null, limit = null) {
    let sql = `
      SELECT q.*, c.name as category_name, c.icon as category_icon 
      FROM questions q 
      LEFT JOIN categories c ON q.category_id = c.id 
      WHERE q.category_id = ?
    `;
    const params = [categoryId];

    if (difficulty) {
      sql += ` AND q.difficulty = ?`;
      params.push(difficulty);
    }

    sql += ` ORDER BY RANDOM()`;

    if (limit) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }

    return this.all(sql, params);
  }

  async getRandomQuestions(limit = 5, difficulty = null) {
    let sql = `
      SELECT q.*, c.name as category_name, c.icon as category_icon 
      FROM questions q 
      LEFT JOIN categories c ON q.category_id = c.id
    `;
    const params = [];

    if (difficulty) {
      sql += ` WHERE q.difficulty = ?`;
      params.push(difficulty);
    }

    sql += ` ORDER BY RANDOM() LIMIT ?`;
    params.push(limit);

    return this.all(sql, params);
  }

  async getQuestionById(id) {
    const sql = `
      SELECT q.*, c.name as category_name, c.icon as category_icon 
      FROM questions q 
      LEFT JOIN categories c ON q.category_id = c.id 
      WHERE q.id = ?
    `;
    return this.get(sql, [id]);
  }

  // Game methods
  async createGame(roomId, hostId, settings) {
    const sql = `INSERT INTO games (room_id, host_id, settings) VALUES (?, ?, ?)`;
    return this.run(sql, [roomId, hostId, JSON.stringify(settings)]);
  }

  async getGameByRoomId(roomId) {
    const sql = `SELECT * FROM games WHERE room_id = ?`;
    return this.get(sql, [roomId]);
  }

  async updateGameStatus(gameId, status, startedAt = null, endedAt = null) {
    let sql = `UPDATE games SET status = ?`;
    const params = [status];

    if (startedAt) {
      sql += `, started_at = ?`;
      params.push(startedAt);
    }

    if (endedAt) {
      sql += `, ended_at = ?`;
      params.push(endedAt);
    }

    sql += ` WHERE id = ?`;
    params.push(gameId);

    return this.run(sql, params);
  }

  async addGameParticipant(gameId, userId, username) {
    const sql = `INSERT INTO game_participants (game_id, user_id, username) VALUES (?, ?, ?)`;
    return this.run(sql, [gameId, userId, username]);
  }

  async updateParticipantScore(gameId, userId, score) {
    const sql = `UPDATE game_participants SET score = ? WHERE game_id = ? AND user_id = ?`;
    return this.run(sql, [score, gameId, userId]);
  }

  async getGameParticipants(gameId) {
    const sql = `SELECT * FROM game_participants WHERE game_id = ? ORDER BY score DESC`;
    return this.all(sql, [gameId]);
  }

  async recordAnswer(gameId, userId, questionId, answerIndex, isCorrect, timeTaken) {
    const sql = `
      INSERT INTO game_answers (game_id, user_id, question_id, answer_index, is_correct, time_taken) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    return this.run(sql, [gameId, userId, questionId, answerIndex, isCorrect, timeTaken]);
  }

  async getUserStats(userId) {
    const sql = `
      SELECT 
        u.*,
        COUNT(DISTINCT gp.game_id) as games_played,
        AVG(gp.score) as avg_score,
        MAX(gp.score) as highest_score,
        COUNT(DISTINCT CASE WHEN ga.is_correct = 1 THEN ga.id END) as correct_answers,
        COUNT(DISTINCT ga.id) as total_answers
      FROM users u
      LEFT JOIN game_participants gp ON u.id = gp.user_id
      LEFT JOIN game_answers ga ON u.id = ga.user_id
      WHERE u.id = ?
      GROUP BY u.id
    `;
    return this.get(sql, [userId]);
  }

  close() {
    this.db.close();
  }
}

module.exports = new Database();