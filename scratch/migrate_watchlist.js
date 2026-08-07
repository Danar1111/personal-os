const mysql = require('mysql2/promise');

async function migrateWatchlist() {
  const conn = await mysql.createConnection('mysql://root:@localhost:3306/personal_os');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`watchlist\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`title\` VARCHAR(255) NOT NULL,
      \`overview\` TEXT,
      \`poster_path\` VARCHAR(500),
      \`tmdb_id\` INT NOT NULL,
      \`rating\` VARCHAR(50),
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✓ watchlist table created or verified in Laragon MySQL!');
  await conn.end();
}

migrateWatchlist().catch(console.error);
