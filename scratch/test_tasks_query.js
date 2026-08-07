const { db } = require('../src/db');
const { tasks } = require('../src/db/schema');

async function testTasks() {
  try {
    const res = await db.select().from(tasks);
    console.log('Tasks query success! Total tasks:', res.length);
  } catch (err) {
    console.error('EXACT TASKS QUERY ERROR:', err);
  }
}

testTasks();
