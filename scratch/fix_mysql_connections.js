const mysql = require('mysql2/promise');

async function cleanupConnections() {
  // Connect with single connection
  const conn = await mysql.createConnection('mysql://root:@localhost:3306/personal_os');
  const [processList] = await conn.query('SHOW PROCESSLIST');
  console.log(`Current open MySQL processes: ${processList.length}`);

  let killed = 0;
  for (const proc of processList) {
    // Kill sleeping connections that are not our current process
    if (proc.Command === 'Sleep' && proc.Id !== conn.threadId) {
      try {
        await conn.query(`KILL ${proc.Id}`);
        killed++;
      } catch (e) {}
    }
  }
  console.log(`✓ Killed ${killed} sleeping MySQL connections!`);

  const [settings] = await conn.query('SELECT * FROM system_settings');
  console.log('--- SYSTEM SETTINGS IN DB ---');
  for (const s of settings) {
    if (s.key.includes('key')) {
      console.log(`${s.key}: [${s.value ? s.value.substring(0, 10) + '...' : 'EMPTY'}]`);
    } else {
      console.log(`${s.key}: ${s.value}`);
    }
  }

  await conn.end();
}

cleanupConnections().catch(console.error);
