const authService = require('../auth/auth');

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const user = await authService.getUserFromToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: error.message });
  }
};

// Middleware to authenticate socket connections
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      // Allow guest connections with username
      const username = socket.handshake.auth.username;
      if (username && username.trim()) {
        const sessionId = socket.id;
        const guestToken = authService.generateGuestToken(username.trim(), sessionId);
        
        socket.user = {
          username: username.trim(),
          sessionId,
          isGuest: true,
          token: guestToken
        };
        return next();
      }
      return next(new Error('Authentication required'));
    }

    // Verify token
    const decoded = authService.verifyToken(token);
    
    if (decoded.isGuest) {
      socket.user = {
        username: decoded.username,
        sessionId: decoded.sessionId,
        isGuest: true,
        token
      };
    } else {
      const user = await authService.getUserFromToken(token);
      socket.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        isGuest: false,
        token
      };
    }
    
    next();
  } catch (error) {
    next(new Error('Invalid authentication'));
  }
};

// Optional authentication (allows both authenticated and guest users)
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const user = await authService.getUserFromToken(token);
      req.user = user;
    } catch (error) {
      // Invalid token, but continue as guest
      req.user = null;
    }
  }
  
  next();
};

module.exports = {
  authenticateToken,
  authenticateSocket,
  optionalAuth
};