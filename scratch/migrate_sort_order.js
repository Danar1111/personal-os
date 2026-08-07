const mysql = require('mysql2/promise');

async function migrateSortOrder() {
  const conn = await mysql.createConnection('mysql://root:@localhost:3306/personal_os');

  try {
    const [cols] = await conn.query(`SHOW COLUMNS FROM \`pinned_tickers\` LIKE 'sort_order'`);
    if (cols.length === 0) {
      await conn.query(`ALTER TABLE \`pinned_tickers\` ADD COLUMN \`sort_order\` INT DEFAULT 0`);
      console.log('✓ Added sort_order column to pinned_tickers!');
    } else {
      console.log('✓ sort_order column already exists in pinned_tickers!');
    }
  } catch (e) {
    console.error('Migration error:', e);
  } finally {
    await conn.end();
  }
}

migrateSortOrder();
