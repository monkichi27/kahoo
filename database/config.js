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
    type: (process.env.DATABASE_URL && 
           process.env.DATABASE_URL !== 'base' && 
           process.env.DATABASE_URL.startsWith('postgresql://')) ? 'postgresql' : 'sqlite',
    url: (process.env.DATABASE_URL && 
          process.env.DATABASE_URL !== 'base' && 
          process.env.DATABASE_URL.startsWith('postgresql://')) ? process.env.DATABASE_URL : undefined,
    database: (process.env.DATABASE_URL && 
               process.env.DATABASE_URL !== 'base' && 
               process.env.DATABASE_URL.startsWith('postgresql://')) ? undefined : path.join(__dirname, '..', 'database.sqlite'),
    ssl: (process.env.DATABASE_URL && 
          process.env.DATABASE_URL !== 'base' && 
          process.env.DATABASE_URL.startsWith('postgresql://')) ? {
      rejectUnauthorized: false
    } : undefined,
    logging: false
  }
};

const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment];

module.exports = dbConfig;