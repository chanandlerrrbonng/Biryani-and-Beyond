// Interactive CLI to test the agent locally, bypassing WhatsApp entirely.
// Usage:  node scripts/chatCli.js
require('dotenv').config();
const readline = require('readline');
const { handleMessage } = require('../agent/agentService');

const sessionKey = process.env.CLI_SESSION || `cli:${Date.now()}`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

console.log('🍛 The Spice Garden — NoQs Agent CLI');
console.log('   Type your message below. Ctrl+C to quit.');
console.log(`   Session: ${sessionKey}\n`);

function ask() {
  rl.question('you › ', async (text) => {
    if (!text.trim()) return ask();
    try {
      const t0 = Date.now();
      const { reply, humanMode } = await handleMessage({
        sessionKey,
        text,
        customerPhone: '9876543210'
      });
      const ms = Date.now() - t0;
      if (humanMode) {
        console.log(`bot › [human mode — message forwarded to merchant]\n`);
      } else {
        console.log(`bot › ${reply}  (${ms}ms)\n`);
      }
    } catch (e) {
      console.error(`err › ${e.message}\n`);
    }
    ask();
  });
}

ask();
