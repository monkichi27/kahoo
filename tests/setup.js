// Jest setup file
const path = require('path');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

// Suppress console logs during testing (optional)
// console.log = jest.fn();
// console.error = jest.fn();
// console.warn = jest.fn();

// Global test utilities
global.testUtils = {
  createTestUser: () => ({
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'testpassword123'
  }),
  
  createTestRoom: () => ({
    settings: {
      questionCount: 5,
      timeLimit: 10,
      category: null,
      difficulty: 'medium'
    }
  }),

  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};