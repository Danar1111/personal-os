const mysql = require('mysql2/promise');

async function removeMindee() {
  const conn = await mysql.createConnection('mysql://root:@localhost:3306/personal_os');
  await conn.query("DELETE FROM system_settings WHERE `key` = 'mindee_api_key'");
  console.log('✓ Mindee API key removed from system_settings DB!');
  await conn.end();
}

removeMindee().catch(console.error);
