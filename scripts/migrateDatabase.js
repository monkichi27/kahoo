const dbFactory = require('../database/dbFactory');
const bcrypt = require('bcryptjs');

async function runMigrations() {
  console.log('🚀 Starting database migrations...');
  
  // Check if DATABASE_URL is set and valid
  if (!process.env.DATABASE_URL || 
      process.env.DATABASE_URL === 'base' || 
      !process.env.DATABASE_URL.startsWith('postgresql://')) {
    
    console.log('⚠️  DATABASE_URL not found or invalid, falling back to SQLite');
    console.log('💡 Set proper PostgreSQL DATABASE_URL in environment variables for production');
    const { initDatabase } = require('./initDatabase');
    return await initDatabase();
  }

  console.log('📦 Using PostgreSQL from DATABASE_URL');
  console.log(`🔗 Host: ${new URL(process.env.DATABASE_URL).hostname}`);
  
  try {
    // Test PostgreSQL connection first
    console.log('🔍 Testing PostgreSQL connection...');
    await dbFactory.query('SELECT 1');
    console.log('✅ PostgreSQL connection successful');
    
    // Create tables with PostgreSQL-compatible syntax
    const tables = [
      {
        name: 'users',
        sql: `CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          total_games INTEGER DEFAULT 0,
          total_score INTEGER DEFAULT 0,
          best_score INTEGER DEFAULT 0
        )`
      },
      {
        name: 'categories',
        sql: `CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT,
          icon VARCHAR(50) DEFAULT '📚'
        )`
      },
      {
        name: 'questions',
        sql: `CREATE TABLE IF NOT EXISTS questions (
          id SERIAL PRIMARY KEY,
          question TEXT NOT NULL,
          options TEXT NOT NULL,
          correct_answer INTEGER NOT NULL,
          category_id INTEGER,
          difficulty VARCHAR(50) CHECK(difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories (id)
        )`
      },
      {
        name: 'games',
        sql: `CREATE TABLE IF NOT EXISTS games (
          id SERIAL PRIMARY KEY,
          room_id VARCHAR(255) UNIQUE NOT NULL,
          host_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          started_at TIMESTAMP,
          ended_at TIMESTAMP,
          status VARCHAR(50) CHECK(status IN ('waiting', 'playing', 'finished')) DEFAULT 'waiting',
          settings TEXT,
          FOREIGN KEY (host_id) REFERENCES users (id)
        )`
      },
      {
        name: 'game_participants',
        sql: `CREATE TABLE IF NOT EXISTS game_participants (
          id SERIAL PRIMARY KEY,
          game_id INTEGER,
          user_id INTEGER,
          username VARCHAR(255) NOT NULL,
          score INTEGER DEFAULT 0,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (game_id) REFERENCES games (id),
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`
      },
      {
        name: 'game_answers',
        sql: `CREATE TABLE IF NOT EXISTS game_answers (
          id SERIAL PRIMARY KEY,
          game_id INTEGER,
          user_id INTEGER,
          question_id INTEGER,
          answer_index INTEGER,
          is_correct BOOLEAN,
          answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          time_taken INTEGER,
          FOREIGN KEY (game_id) REFERENCES games (id),
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (question_id) REFERENCES questions (id)
        )`
      }
    ];

    // Create tables
    for (const table of tables) {
      console.log(`📋 Creating table: ${table.name}`);
      await dbFactory.query(table.sql);
    }

    // Insert default categories
    console.log('📚 Inserting default categories...');
    const categories = [
      { name: 'General Knowledge', description: 'Mixed topics and general questions', icon: '🧠' },
      { name: 'Science', description: 'Physics, Chemistry, Biology', icon: '🔬' },
      { name: 'History', description: 'World history and events', icon: '📜' },
      { name: 'Geography', description: 'Countries, capitals, landmarks', icon: '🌍' },
      { name: 'Sports', description: 'Sports and athletics', icon: '⚽' },
      { name: 'Entertainment', description: 'Movies, music, celebrities', icon: '🎬' },
      { name: 'Technology', description: 'Computers and technology', icon: '💻' }
    ];

    for (const category of categories) {
      const sql = `INSERT INTO categories (name, description, icon) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`;
      await dbFactory.query(sql, [category.name, category.description, category.icon]);
    }

    // Get category IDs for questions
    const categoriesResult = await dbFactory.query('SELECT id, name FROM categories');
    const categoryMap = {};
    categoriesResult.forEach(cat => {
      categoryMap[cat.name] = cat.id;
    });

    // Insert sample questions
    console.log('❓ Inserting sample questions...');
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

    for (const question of questions) {
      const categoryId = categoryMap[question.category];
      if (categoryId) {
        const sql = `
          INSERT INTO questions (question, options, correct_answer, category_id, difficulty) 
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `;
        await dbFactory.query(sql, [
          question.question,
          JSON.stringify(question.options),
          question.correct,
          categoryId,
          question.difficulty
        ]);
      }
    }

    console.log('✅ Database migrations completed successfully!');
    console.log(`📊 Categories: ${categories.length}`);
    console.log(`❓ Questions: ${questions.length}`);

  } catch (error) {
    console.error('❌ PostgreSQL migration failed:', error.message);
    console.log('🔄 Falling back to SQLite...');
    
    try {
      const { initDatabase } = require('./initDatabase');
      await initDatabase();
      console.log('✅ Fallback to SQLite successful');
    } catch (fallbackError) {
      console.error('💥 SQLite fallback also failed:', fallbackError);
      throw fallbackError;
    }
  }
}

// Run migrations if this script is called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('🎉 Migration process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigrations };