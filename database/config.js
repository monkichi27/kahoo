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
    type: 'postgresql',
    url: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    logging: false
  }
};

const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

module.exports = dbConfig;