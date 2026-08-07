const mysql = require('mysql2/promise');

async function migratePinnedTickers() {
  const conn = await mysql.createConnection('mysql://root:@localhost:3306/personal_os');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`pinned_tickers\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`symbol\` VARCHAR(50) NOT NULL UNIQUE,
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const defaults = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'GOOGL'];
  for (const sym of defaults) {
    await conn.query(
      `INSERT IGNORE INTO \`pinned_tickers\` (\`symbol\`) VALUES (?);`,
      [sym]
    );
  }

  console.log('✓ pinned_tickers table created and seeded in Laragon MySQL!');
  await conn.end();
}

migratePinnedTickers().catch(console.error);
