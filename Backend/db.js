const mysql = require("mysql2");

// Create a connection pool
const pool = mysql.createPool({
  host: "localhost",      // MySQL host
  user: "root",           // Your MySQL username
  password: "root", // Your MySQL password
  database: "laundry",    // Database name
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Export pool with promise support
module.exports = pool;
