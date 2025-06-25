const pool = require('./db/db');

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Connection failed:', err);
  } else {
    console.log('✅ Connected to DB! Time is:', res.rows[0].now);
  }
  pool.end();
});