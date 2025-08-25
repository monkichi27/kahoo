const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const config = require('./config');

class DatabaseFactory {
  constructor() {
    this.config = config;
    this.db = null;
    this.isPostgreSQL = config.type === 'postgresql';
    this.init();
  }

  init() {
    if (this.isPostgreSQL) {
      // PostgreSQL connection
      this.db = new Pool({
        connectionString: this.config.url,
        ssl: this.config.ssl
      });
      
      this.db.on('connect', () => {
        if (this.config.logging) console.log('Connected to PostgreSQL database');
      });
      
      this.db.on('error', (err) => {
        console.error('PostgreSQL connection error:', err);
      });
    } else {
      // SQLite connection
      this.db = new sqlite3.Database(this.config.database, (err) => {
        if (err) {
          console.error('Error connecting to SQLite database:', err.message);
        } else if (this.config.logging) {
          console.log('Connected to SQLite database');
        }
      });
    }
  }

  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (this.isPostgreSQL) {
        // PostgreSQL query with numbered parameters ($1, $2, etc.)
        this.db.query(sql, params, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result.rows);
          }
        });
      } else {
        // SQLite query
        this.db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      }
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (this.isPostgreSQL) {
        this.db.query(sql, params, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve({ 
              id: result.rows[0]?.id || null, 
              changes: result.rowCount 
            });
          }
        });
      } else {
        this.db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, changes: this.changes });
          }
        });
      }
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (this.isPostgreSQL) {
        this.db.query(sql, params, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result.rows[0] || null);
          }
        });
      } else {
        this.db.get(sql, params, (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row || null);
          }
        });
      }
    });
  }

  // Convert SQLite queries to PostgreSQL format
  convertQuery(sql, isInsert = false) {
    if (!this.isPostgreSQL) return sql;

    // Convert ? placeholders to $1, $2, etc.
    let paramIndex = 1;
    const convertedSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

    // Add RETURNING id for INSERT statements
    if (isInsert && !convertedSql.toLowerCase().includes('returning')) {
      return convertedSql + ' RETURNING id';
    }

    // Convert SQLite specific syntax to PostgreSQL
    return convertedSql
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
      .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
      .replace(/TEXT/g, 'VARCHAR(255)')
      .replace(/BOOLEAN/g, 'BOOLEAN');
  }

  async close() {
    if (this.isPostgreSQL) {
      await this.db.end();
    } else {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) console.error('Error closing SQLite database:', err);
          resolve();
        });
      });
    }
  }
}

module.exports = new DatabaseFactory();