const config = require('../database/config');

async function initDatabase() {
  console.log(`🚀 Initializing database for ${config.type} environment...`);
  
  if (config.type === 'postgresql') {
    // Use PostgreSQL migration for production
    const { runMigrations } = require('./migrateDatabase');
    await runMigrations();
    return;
  }
  
  // SQLite initialization for development
  const sqlite3 = require('sqlite3').verbose();
  const bcrypt = require('bcryptjs');
  const path = require('path');

  const dbPath = path.join(__dirname, '..', 'database.sqlite');
  const db = new sqlite3.Database(dbPath);

  return new Promise((resolve, reject) => {
    // Create tables
    db.serialize(() => {
      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_games INTEGER DEFAULT 0,
        total_score INTEGER DEFAULT 0,
        best_score INTEGER DEFAULT 0
      )`);

      // Categories table
      db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        icon TEXT DEFAULT '📚'
      )`);

      // Questions table
      db.run(`CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        options TEXT NOT NULL, -- JSON array
        correct_answer INTEGER NOT NULL,
        category_id INTEGER,
        difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id)
      )`);

      // Games table
      db.run(`CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT UNIQUE NOT NULL,
        host_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        ended_at DATETIME,
        status TEXT CHECK(status IN ('waiting', 'playing', 'finished')) DEFAULT 'waiting',
        settings TEXT, -- JSON object
        FOREIGN KEY (host_id) REFERENCES users (id)
      )`);

      // Game participants table
      db.run(`CREATE TABLE IF NOT EXISTS game_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER,
        user_id INTEGER,
        username TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);

      // Game answers table
      db.run(`CREATE TABLE IF NOT EXISTS game_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER,
        user_id INTEGER,
        question_id INTEGER,
        answer_index INTEGER,
        is_correct BOOLEAN,
        answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        time_taken INTEGER, -- milliseconds
        FOREIGN KEY (game_id) REFERENCES games (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (question_id) REFERENCES questions (id)
      )`);

      // Insert default categories
      const categories = [
        { name: 'General Knowledge', description: 'Mixed topics and general questions', icon: '🧠' },
        { name: 'Science', description: 'Physics, Chemistry, Biology', icon: '🔬' },
        { name: 'History', description: 'World history and events', icon: '📜' },
        { name: 'Geography', description: 'Countries, capitals, landmarks', icon: '🌍' },
        { name: 'Sports', description: 'Sports and athletics', icon: '⚽' },
        { name: 'Entertainment', description: 'Movies, music, celebrities', icon: '🎬' },
        { name: 'Technology', description: 'Computers and technology', icon: '💻' }
      ];

      const stmt = db.prepare("INSERT OR IGNORE INTO categories (name, description, icon) VALUES (?, ?, ?)");
      categories.forEach(cat => {
        stmt.run(cat.name, cat.description, cat.icon);
      });
      stmt.finalize();

      // Insert sample questions
      const questions = [
        // General Knowledge
        { question: "What is the capital of France?", options: ["Paris","London","Berlin","Madrid"], correct: 0, category: "General Knowledge", difficulty: "easy" },
        { question: "What is 2 + 2?", options: ["3","4","5","6"], correct: 1, category: "General Knowledge", difficulty: "easy" },
        { question: "Which planet is known as the Red Planet?", options: ["Venus","Mars","Jupiter","Saturn"], correct: 1, category: "General Knowledge", difficulty: "medium" },
        
        // Science
        { question: "What is the chemical symbol for gold?", options: ["Go","Gd","Au","Ag"], correct: 2, category: "Science", difficulty: "medium" },
        { question: "How many bones are in an adult human body?", options: ["206","208","204","210"], correct: 0, category: "Science", difficulty: "hard" },
        { question: "What gas do plants absorb from the atmosphere?", options: ["Oxygen","Nitrogen","Carbon Dioxide","Helium"], correct: 2, category: "Science", difficulty: "easy" },
        
        // History
        { question: "In which year did World War II end?", options: ["1944","1945","1946","1947"], correct: 1, category: "History", difficulty: "medium" },
        { question: "Who was the first person to walk on the moon?", options: ["Buzz Aldrin","Neil Armstrong","John Glenn","Alan Shepard"], correct: 1, category: "History", difficulty: "easy" },
        
        // Geography
        { question: "What is the largest country by land area?", options: ["Canada","China","USA","Russia"], correct: 3, category: "Geography", difficulty: "easy" },
        { question: "Which river is the longest in the world?", options: ["Amazon","Nile","Mississippi","Yangtze"], correct: 1, category: "Geography", difficulty: "medium" },
        
        // Sports
        { question: "How many players are on a basketball team on the court?", options: ["4","5","6","7"], correct: 1, category: "Sports", difficulty: "easy" },
        { question: "In which sport would you perform a slam dunk?", options: ["Football","Tennis","Basketball","Baseball"], correct: 2, category: "Sports", difficulty: "easy" },
        
        // Entertainment
        { question: "Which movie won the Academy Award for Best Picture in 2020?", options: ["1917","Joker","Parasite","Once Upon a Time in Hollywood"], correct: 2, category: "Entertainment", difficulty: "hard" },
        { question: "Who composed 'The Four Seasons'?", options: ["Mozart","Bach","Vivaldi","Beethoven"], correct: 2, category: "Entertainment", difficulty: "medium" },
        
        // Technology
        { question: "What does 'HTTP' stand for?", options: ["HyperText Transfer Protocol","High Tech Transfer Protocol","Home Tool Transfer Protocol","HyperText Translation Protocol"], correct: 0, category: "Technology", difficulty: "medium" },
        { question: "Who founded Microsoft?", options: ["Steve Jobs","Bill Gates","Mark Zuckerberg","Larry Page"], correct: 1, category: "Technology", difficulty: "easy" }
      ];

      // Get category IDs first
      db.all("SELECT id, name FROM categories", (err, categoriesResult) => {
        if (err) {
          console.error('Error fetching categories:', err);
          reject(err);
          return;
        }

        const categoryMap = {};
        categoriesResult.forEach(cat => {
          categoryMap[cat.name] = cat.id;
        });

        const questionStmt = db.prepare(`
          INSERT OR IGNORE INTO questions (question, options, correct_answer, category_id, difficulty) 
          VALUES (?, ?, ?, ?, ?)
        `);
        
        questions.forEach(q => {
          const categoryId = categoryMap[q.category] || 1;
          questionStmt.run(
            q.question, 
            JSON.stringify(q.options), 
            q.correct, 
            categoryId, 
            q.difficulty
          );
        });
        questionStmt.finalize();

        console.log('Database initialized successfully!');
        console.log(`Categories created: ${categories.length}`);
        console.log(`Sample questions added: ${questions.length}`);
        
        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
            reject(err);
          } else {
            console.log('Database connection closed.');
            resolve();
          }
        });
      });
    });
  });
}

// Run if called directly
if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('🎉 Database initialization completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initDatabase };