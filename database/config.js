// Database configuration for both SQLite (development) and PostgreSQL (production)
const path = require('path');

const config = {
  development: {
    type: 'sqlite',
    database: path.join(__dirname, '..', 'database.sqlite'),
    logging: true
  },
  
  test: {
    type: 'sqlite',
    database: ':memory:',
    logging: false
  },
  
  production: {
    type: process.env.DATABASE_URL ? 'postgresql' : 'sqlite',
    url: process.env.DATABASE_URL,
    database: process.env.DATABASE_URL ? undefined : path.join(__dirname, '..', 'database.sqlite'),
    ssl: process.env.DATABASE_URL ? {
      rejectUnauthorized: false
    } : undefined,
    logging: false
  }
};

const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

module.exports = dbConfig;