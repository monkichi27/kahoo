const { body, param, query, validationResult } = require('express-validator');

// Common validation rules
const usernameValidation = body('username')
  .isLength({ min: 3, max: 20 })
  .matches(/^[a-zA-Z0-9_-]+$/)
  .withMessage('Username must be 3-20 characters and contain only letters, numbers, underscore, or dash');

const emailValidation = body('email')
  .isEmail()
  .normalizeEmail()
  .withMessage('Please provide a valid email address');

const passwordValidation = body('password')
  .isLength({ min: 6 })
  .withMessage('Password must be at least 6 characters long');

const playerNameValidation = body('playerName')
  .isLength({ min: 1, max: 30 })
  .trim()
  .escape()
  .withMessage('Player name must be 1-30 characters');

const roomIdValidation = body('roomId')
  .isLength({ min: 6, max: 6 })
  .matches(/^[A-Z0-9]+$/)
  .withMessage('Room ID must be exactly 6 uppercase alphanumeric characters');

// Validation rule sets
const registerValidation = [
  usernameValidation,
  emailValidation,
  passwordValidation
];

const loginValidation = [
  body('usernameOrEmail')
    .notEmpty()
    .withMessage('Username or email is required'),
  passwordValidation
];

const createRoomValidation = [
  playerNameValidation,
  body('settings.timeLimit')
    .optional()
    .isInt({ min: 5, max: 60 })
    .withMessage('Time limit must be between 5 and 60 seconds'),
  body('settings.questionCount')
    .optional()
    .isInt({ min: 5, max: 50 })
    .withMessage('Question count must be between 5 and 50'),
  body('settings.category')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category must be a valid category ID'),
  body('settings.difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard')
];

const joinRoomValidation = [
  roomIdValidation,
  playerNameValidation
];

const answerValidation = [
  body('roomId').notEmpty(),
  body('answerIndex')
    .isInt({ min: 0, max: 3 })
    .withMessage('Answer index must be between 0 and 3')
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Sanitization functions
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

const sanitizePlayerName = (name) => {
  return sanitizeInput(name).substring(0, 30) || 'Anonymous';
};

const sanitizeRoomId = (roomId) => {
  return sanitizeInput(roomId).toUpperCase().replace(/[^A-Z0-9]/g, '');
};

module.exports = {
  registerValidation,
  loginValidation,
  createRoomValidation,
  joinRoomValidation,
  answerValidation,
  handleValidationErrors,
  sanitizeInput,
  sanitizePlayerName,
  sanitizeRoomId
};