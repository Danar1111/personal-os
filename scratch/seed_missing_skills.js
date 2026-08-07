const mysql = require('mysql2/promise');

async function seedSkills() {
  const conn = await mysql.createConnection('mysql://root:@localhost:3306/personal_os');
  const skills = [
    ['search_assets', 'Asset Vault', 'Searches bookmarks, web links, and resources in Asset Vault by title or keyword.'],
    ['list_assets', 'Asset Vault', 'Lists all saved bookmarks, web links, and media resources in Asset Vault.'],
    ['list_skills', 'Skill Matrix', 'Lists all skills currently tracked or being learned in Skill Matrix.'],
    ['search_skills', 'Skill Matrix', 'Searches skills in Skill Matrix by title, name, or category.'],
    ['list_applications', 'App Launcher', 'Lists all registered web apps and local services in App Launcher.'],
    ['register_application', 'App Launcher', 'Registers a new web app or service shortcut in App Launcher.'],
  ];

  for (const [name, moduleName, desc] of skills) {
    await conn.query(
      `INSERT INTO ai_skills (name, module, description, is_enabled) 
       VALUES (?, ?, ?, 1) 
       ON DUPLICATE KEY UPDATE module = VALUES(module), description = VALUES(description);`,
      [name, moduleName, desc]
    );
  }
  console.log('✓ Seeded search_assets, list_assets, list_skills, search_skills, list_applications into ai_skills DB!');
  await conn.end();
}

seedSkills().catch(console.error);
