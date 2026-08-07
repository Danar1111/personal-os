const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection('mysql://root:@localhost:3306/personal_os');
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`applications\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(255) NOT NULL,
      \`url\` VARCHAR(500) NOT NULL,
      \`icon_name\` VARCHAR(100) NOT NULL DEFAULT 'Globe',
      \`category\` VARCHAR(100) NOT NULL DEFAULT 'General',
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('✓ applications table created or verified in Laragon MySQL!');

  // Seed default apps if empty
  const [rows] = await conn.query('SELECT COUNT(*) as count FROM applications');
  if (rows[0].count === 0) {
    console.log('Seeding default application shortcuts...');
    const defaultApps = [
      ['n8n Workflow Automation', 'http://localhost:5678', 'Zap', 'Local Services'],
      ['Laragon Control Hub', 'http://localhost', 'Server', 'Local Services'],
      ['GitHub Repositories', 'https://github.com', 'Code', 'Development'],
      ['Vercel Dashboard', 'https://vercel.com', 'Cloud', 'Development'],
      ['Supabase Console', 'https://supabase.com', 'Database', 'Development'],
      ['ChatGPT Executive', 'https://chatgpt.com', 'Bot', 'Productivity'],
      ['Canva Design Studio', 'https://canva.com', 'Layers', 'Productivity'],
      ['Stripe Dashboard', 'https://dashboard.stripe.com', 'CreditCard', 'Finance'],
    ];

    for (const app of defaultApps) {
      await conn.query('INSERT INTO applications (name, url, icon_name, category) VALUES (?, ?, ?, ?)', app);
    }
    console.log('✓ Default applications seeded successfully!');
  }

  await conn.end();
}

migrate().catch(console.error);
