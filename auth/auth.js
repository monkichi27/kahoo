const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = '7d';

class AuthService {
  async registerUser(username, email, password) {
    // Check if user already exists
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    const existingEmail = await db.getUserByEmail(email);
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await db.createUser(username, email, passwordHash);
    
    // Generate JWT
    const token = this.generateToken(result.id, username);

    return {
      id: result.id,
      username,
      email,
      token
    };
  }

  async loginUser(usernameOrEmail, password) {
    // Try to find user by username or email
    let user = await db.getUserByUsername(usernameOrEmail);
    if (!user) {
      user = await db.getUserByEmail(usernameOrEmail);
    }

    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Generate JWT
    const token = this.generateToken(user.id, user.username);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      token,
      stats: {
        totalGames: user.total_games,
        totalScore: user.total_score,
        bestScore: user.best_score
      }
    };
  }

  generateToken(userId, username) {
    return jwt.sign(
      { userId, username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  async getUserFromToken(token) {
    const decoded = this.verifyToken(token);
    const user = await db.getUserByUsername(decoded.username);
    
    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email
    };
  }

  // Guest login (no account required)
  generateGuestToken(username, sessionId) {
    return jwt.sign(
      { username, sessionId, isGuest: true },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }
}

module.exports = new AuthService();