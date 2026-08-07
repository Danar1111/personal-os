const mysql = require('mysql2/promise');

async function updateDb() {
  const conn = await mysql.createConnection('mysql://root:@localhost:3306/personal_os');
  try {
    await conn.query(`
      ALTER TABLE \`applications\` 
      ADD COLUMN \`use_favicon\` TINYINT(1) NOT NULL DEFAULT 1;
    `);
    console.log('✓ Added use_favicon column to applications table!');
  } catch (e) {
    if (e.message.includes('Duplicate column')) {
      console.log('✓ use_favicon column already exists.');
    } else {
      console.error('Error adding column:', e.message);
    }
  }
  await conn.end();
}

updateDb();
