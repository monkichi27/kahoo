# 🎮 Kahoo - Advanced Quiz Game

A modern, real-time multiplayer quiz game built with Node.js, Socket.IO, and SQLite. Features authentication, customizable game settings, multiple question categories, and comprehensive statistics tracking.

## ✨ Features

### 🔐 Authentication System
- **Guest Mode**: Play without registration
- **User Registration**: Create account with email and password
- **Secure Login**: JWT-based authentication
- **Password Security**: bcrypt hashing

### 🎯 Game Features
- **Real-time Multiplayer**: Up to multiple players per room
- **Custom Game Settings**: 
  - Question count (5-20)
  - Time limits (5-30 seconds)
  - Category selection
  - Difficulty levels (easy, medium, hard)
- **Question Categories**:
  - 🧠 General Knowledge
  - 🔬 Science
  - 📜 History
  - 🌍 Geography
  - ⚽ Sports
  - 🎬 Entertainment
  - 💻 Technology

### 📊 Advanced Features
- **Live Scoreboard**: Real-time score updates
- **Time-based Scoring**: Bonus points for quick answers
- **Game Statistics**: Track performance over time
- **Question Progress**: Visual progress indicators
- **Sound Effects**: Audio feedback (toggleable)
- **Responsive Design**: Works on all devices

### 🛡️ Security & Performance
- **Rate Limiting**: Prevent spam and abuse
- **Input Validation**: Sanitize all user inputs
- **CORS Protection**: Secure cross-origin requests
- **Helmet Security**: HTTP security headers
- **Database Persistence**: SQLite for reliable data storage

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd kahoo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Initialize the database**
   ```bash
   npm run init-db
   ```

4. **Start the server**
   ```bash
   # Development mode (with auto-restart)
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Access the game**
   - Open your browser to `http://localhost:3000`
   - Share the URL with friends to play together!

## 🎮 How to Play

### Creating a Game
1. **Choose your mode**: Guest, Login, or Register
2. **Set game options**: 
   - Number of questions
   - Time per question  
   - Category (optional)
   - Difficulty level
3. **Share room code**: Invite friends with the 6-character room code
4. **Start the game**: Host clicks "Start Game" when ready

### During the Game
- **Answer questions**: Click your choice or use keyboard (1, 2, 3, 4)
- **Time pressure**: Answer quickly for bonus points
- **Live updates**: See other players' progress in real-time
- **Question variety**: Multiple categories and difficulties

### Scoring System
- **Base points**: 10 points for correct answers
- **Time bonus**: Up to 5 extra points for quick answers
- **Final ranking**: Compete for the top spot!

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Security
JWT_SECRET=your-super-secure-secret-key-here

# Database (optional - defaults to local SQLite)
DB_PATH=./database.sqlite

# CORS (for production)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Database Setup
The database is automatically created when you run:
```bash
npm run init-db
```

This creates:
- 7 question categories with 60+ sample questions
- Database schema for users, games, and statistics
- Indexes for optimal performance

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run with coverage report
npm test -- --coverage

# Run specific test file
npm test server.test.js

# Run tests in watch mode
npm test -- --watch
```

### Test Coverage
- **API Endpoints**: Authentication, validation, rate limiting
- **Database Operations**: CRUD operations, error handling
- **Socket.IO Events**: Real-time game functionality
- **Security**: Input validation, authentication flows

## 📁 Project Structure

```
kahoo/
├── 📂 auth/                 # Authentication system
│   └── auth.js             # JWT, bcrypt, user management
├── 📂 database/            # Database layer
│   └── db.js              # SQLite queries and models
├── 📂 middleware/          # Express middleware
│   ├── auth.js            # Authentication middleware
│   └── validation.js      # Input validation & sanitization
├── 📂 public/              # Frontend assets
│   └── index.html         # Single-page application
├── 📂 scripts/             # Utility scripts
│   └── initDatabase.js    # Database initialization
├── 📂 tests/               # Test suites
│   ├── server.test.js     # API and Socket.IO tests
│   ├── database.test.js   # Database operation tests
│   └── setup.js           # Test configuration
├── server.js               # Main application server
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## 🔒 Security Features

- **Authentication**: JWT tokens with expiration
- **Rate Limiting**: 100 requests/15min, 10 auth attempts/15min
- **Input Validation**: All inputs sanitized and validated
- **CORS Protection**: Configurable allowed origins
- **Security Headers**: Helmet.js for HTTP security
- **Password Security**: bcrypt with salt rounds
- **XSS Protection**: Content Security Policy headers

## 📊 Database Schema

### Users
- Profile information and authentication
- Game statistics and performance tracking

### Questions  
- Categorized by subject and difficulty
- Support for multiple choice (4 options)
- Expandable for different question types

### Games
- Room management and settings
- Player participation tracking
- Game state and progression

### Statistics
- Individual player performance
- Game history and analytics
- Leaderboards and achievements

## 🌟 Advanced Usage

### Adding Questions
Questions are stored in the database. You can add more through:
1. **Database interface**: Direct SQL INSERT statements
2. **Admin panel**: (Future feature)
3. **API endpoints**: (Future feature)

### Custom Categories
Add new categories in the database:
```sql
INSERT INTO categories (name, description, icon) 
VALUES ('Music', 'Songs, artists, and music theory', '🎵');
```

### Game Modes
Current support for:
- **Classic Mode**: Traditional quiz format
- **Speed Round**: Shorter time limits
- **Category Focus**: Single category games

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Write tests for new features
- Follow existing code style
- Update documentation
- Ensure security best practices

## 📝 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate existing user

### Game Endpoints  
- `GET /api/categories` - Fetch question categories
- `GET /api/user/stats/:userId` - Get user statistics

### Socket.IO Events
- `createRoom` - Host creates a new game room
- `join` - Player joins existing room
- `startGame` - Host begins the quiz
- `answer` - Player submits answer
- `disconnect` - Player leaves game

## 🐛 Troubleshooting

### Common Issues

**Database connection errors**
```bash
npm run init-db
```

**Port already in use**
```bash
# Change port in .env file or:
PORT=3001 npm start
```

**Socket connection issues**
- Check firewall settings
- Verify CORS configuration
- Ensure WebSocket support

### Debug Mode
Enable verbose logging:
```bash
DEBUG=kahoo:* npm start
```

## 📈 Performance Optimization

- **Database Indexing**: Optimized queries for questions and users
- **Connection Pooling**: Efficient Socket.IO connection management  
- **Rate Limiting**: Prevent server overload
- **Asset Compression**: Minified CSS and optimized images
- **Memory Management**: Automatic cleanup of finished games

## 🔮 Future Enhancements

### Planned Features
- 📱 **Mobile App**: Native iOS/Android versions
- 🏆 **Tournaments**: Multi-round competitions
- 👥 **Teams**: Collaborative gameplay mode
- 📊 **Analytics Dashboard**: Detailed statistics
- 🎨 **Themes**: Customizable visual themes
- 🌐 **Internationalization**: Multiple language support
- 🎵 **Custom Audio**: Upload custom sound effects
- 📷 **Image Questions**: Support for visual questions

### Community Features
- **Question Contributions**: User-submitted questions
- **Leaderboards**: Global and category-specific rankings  
- **Achievements**: Unlock badges and rewards
- **Social Sharing**: Share results on social media

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Socket.IO** - Real-time communication
- **Express.js** - Web framework
- **SQLite** - Database engine  
- **bcryptjs** - Password hashing
- **Jest** - Testing framework
- **Poppins Font** - Typography

---

**Made with ❤️ for quiz enthusiasts everywhere!**

For support, feature requests, or contributions, please open an issue or contact the development team.