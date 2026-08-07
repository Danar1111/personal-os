const { streamText, jsonSchema } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const mysql = require('mysql2/promise');

async function testStopWhen() {
  const conn = await mysql.createConnection('mysql://root:@localhost:3306/personal_os');
  const [rows] = await conn.query("SELECT value FROM system_settings WHERE `key` = 'openai_key'");
  await conn.end();
  
  const apiKey = rows[0]?.value;
  const customOpenAI = createOpenAI({ apiKey });

  const result = streamText({
    model: customOpenAI('gpt-4o-mini'),
    system: 'You are Personal OS AI Core. When list_tasks runs, summarize the task list with markdown link [View Tasks](/tasks).',
    messages: [{ role: 'user', content: 'show todo list' }],
    stopWhen: ({ steps }) => steps.length >= 5,
    tools: {
      list_tasks: {
        type: 'function',
        description: 'Lists tasks',
        inputSchema: jsonSchema({ type: 'object', properties: {} }),
        execute: async () => {
          console.log('[EXECUTED list_tasks]');
          return { success: true, message: 'Found 2 tasks:\n• [HIGH] Refactor Queries\n• [MEDIUM] Bento Box', pageUrl: '/tasks' };
        }
      }
    }
  });

  for await (const chunk of result.fullStream) {
    if (chunk.type === 'text-delta') {
      process.stdout.write(chunk.text || chunk.textDelta || '');
    }
  }
  console.log('\n--- FINISHED STREAM ---');
}

testStopWhen();
