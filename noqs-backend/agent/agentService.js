// noqs-backend/agent/agentService.js
const OpenAI = require('openai');
const sessionStore = require('./sessionStore');
const { toolSchemas, toolMap } = require('./tools');

// gpt-oss-120b is the recommended replacement for the now-retired
// meta-llama/llama-4-scout model. It has strong NATIVE tool-calling,
// so the text-embedded-tool-call fallbacks below rarely fire now.
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const HISTORY_TURNS = Number(process.env.AGENT_HISTORY_TURNS || 10);
const MAX_TOOL_ROUNDS = 8;
// gpt-oss models expose a reasoning_effort knob. 'low' keeps the
// ordering assistant fast; bump to 'medium' if you want richer replies.
const REASONING_EFFORT = process.env.GROQ_REASONING_EFFORT || 'low';

let _client = null;
function getClient() {
  if (_client) return _client;
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set. Add it to your .env file.');
  }
  _client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'
  });
  return _client;
}

const SYSTEM_PROMPT = `You are the friendly ordering assistant for "The Spice Garden", a North-Indian & Hyderabadi restaurant on the NoQs platform.

CRITICAL RULES — FOLLOW THESE EXACTLY:
1. You MUST use the provided tools (search_menu, add_to_cart, remove_from_cart, view_cart, place_order, check_order_status) by calling them through the function-calling mechanism. NEVER type out tool calls as text. NEVER output JSON tool schemas in your replies.
2. ALWAYS call search_menu FIRST before recommending, listing, or adding any item. Never guess or make up item names, IDs, or prices.
3. When the customer asks to see items, search for them and then present the results in a friendly, readable format with emoji, name, short description, and price.
4. Use add_to_cart with the EXACT item ID from search_menu results.
5. When the customer wants to see their cart or bill, call view_cart.
6. Only call place_order AFTER the customer explicitly says "yes" / "confirm" / "place it" AND you have their name. Ask for their name if you don't have it.
7. For order status queries, use check_order_status with the order ID.
8. If a tool returns an error or empty results, tell the customer honestly and suggest alternatives.
9. Keep replies SHORT — 2-4 lines max. Customers read on phones.
10. Be warm and helpful. Use food emoji occasionally. Prices are in ₹ (Indian Rupees).
11. If the customer asks for "best", "top rated", "popular", or "highest rated" items — use search_menu with an empty query to get all items, then pick the highest-rated ones from the results.
12. If the customer asks for "chef's special" or "chef's pick" — search for items and filter for ones with chef badges.
13. Respond ONLY in natural language. Your replies must be conversational text that a customer would enjoy reading. Never include raw JSON, code, or technical output.
14. LANGUAGE: Reply in the SAME language the customer used. If they wrote in Hindi (or Hinglish, Telugu, Tamil, etc.), respond in that language. Keep item names as they appear on the menu.`;

function trimHistory(history) {
  const max = HISTORY_TURNS * 4;
  return history.length > max ? history.slice(-max) : history;
}

function extractEmbeddedToolCall(text) {
  if (!text) return null;
  const p1 = text.match(/\{\s*"type"\s*:\s*"function"\s*,\s*"name"\s*:\s*"(\w+)"\s*,\s*"parameters"\s*:\s*(\{[^}]*\})/);
  if (p1) {
    try { return { name: p1[1], args: JSON.parse(p1[2]) }; } catch { /* fall through */ }
  }
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed.name && (parsed.arguments || parsed.parameters)) {
      return { name: parsed.name, args: parsed.arguments || parsed.parameters || {} };
    }
    if (parsed.function?.name) {
      const a = parsed.function.arguments || {};
      return { name: parsed.function.name, args: typeof a === 'string' ? JSON.parse(a) : a };
    }
  } catch { /* not JSON */ }
  const jsonMatch = text.match(/\{[^{}]*"name"\s*:\s*"(search_menu|add_to_cart|remove_from_cart|view_cart|place_order|check_order_status)"[^{}]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]);
      const name = obj.name;
      const args = obj.parameters || obj.arguments || {};
      if (name && toolMap[name]) return { name, args };
    } catch { /* fall through */ }
  }
  return null;
}

function containsToolCallJSON(text) {
  if (!text) return false;
  return /\{\s*"type"\s*:\s*"function"/.test(text) ||
    /\{\s*"name"\s*:\s*"(search_menu|add_to_cart|remove_from_cart|view_cart|place_order|check_order_status)"/.test(text);
}

async function handleMessage({ sessionKey, text, customerPhone, contactName } = {}) {
  const session = await sessionStore.load(sessionKey);
  if (customerPhone) session.customerPhone = customerPhone;
  if (contactName && !session.customerName) {
    session.customerName = contactName;
  }
  if (session.mode === 'human') {
    session.history.push({ role: 'user', content: text });
    await sessionStore.save(session);
    return { reply: null, session, humanMode: true };
  }

  let client;
  try {
    client = getClient();
  } catch (e) {
    console.error('[agent] client init failed:', e.message);
    session.history.push({ role: 'user', content: text });
    session.history.push({ role: 'assistant', content: "Sorry, the assistant isn't configured yet. Please try again shortly." });
    await sessionStore.save(session);
    return { reply: "Sorry, the assistant isn't configured yet. Please try again shortly.", session };
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...trimHistory(session.history),
    { role: 'user', content: text }
  ];

  let finalReply = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let completion;
    try {
      completion = await client.chat.completions.create({
        model: MODEL,
        messages,
        tools: toolSchemas,
        tool_choice: 'auto',
        temperature: 0.2,
        // gpt-oss reasoning knob — ignored gracefully by non-reasoning models.
        reasoning_effort: REASONING_EFFORT
      });
    } catch (e) {
      console.error('[agent] LLM call failed:', e.message);
      finalReply = "Sorry, I'm having trouble right now. Please try again in a moment.";
      break;
    }

    const msg = completion.choices?.[0]?.message;
    if (!msg) {
      finalReply = "Sorry, I didn't catch that. Could you say it again?";
      break;
    }

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push(msg);
      for (const call of msg.tool_calls) {
        const tool = toolMap[call.function?.name];
        let result;
        try {
          const args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
          result = tool ? await tool.run(args, session) : { error: `Unknown tool: ${call.function?.name}` };
        } catch (e) {
          result = { error: `Tool "${call.function?.name}" failed: ${e.message}` };
        }
        await sessionStore.save(session);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
      continue;
    }

    const content = msg.content || '';
    const embedded = extractEmbeddedToolCall(content);
    if (embedded && toolMap[embedded.name]) {
      console.log(`[agent] detected embedded tool call in text: ${embedded.name}(${JSON.stringify(embedded.args)})`);
      let result;
      try {
        result = await toolMap[embedded.name].run(embedded.args, session);
      } catch (e) {
        result = { error: `Tool "${embedded.name}" failed: ${e.message}` };
      }
      await sessionStore.save(session);
      messages.push({ role: 'assistant', content });
      messages.push({
        role: 'user',
        content: `[System: The tool "${embedded.name}" was executed and returned the following result. Please now respond to the customer with this data in a natural, friendly way. Do NOT output any JSON or tool calls — just speak naturally.]\n\nTool result:\n${JSON.stringify(result, null, 2)}`
      });
      continue;
    }

    if (containsToolCallJSON(content)) {
      const cleaned = content.replace(/\{[^{}]*"(type|name)"\s*:\s*"(function|search_menu|add_to_cart|remove_from_cart|view_cart|place_order|check_order_status)"[^{}]*\}/g, '').trim();
      if (cleaned.length > 10) {
        finalReply = cleaned;
      } else {
        messages.push({ role: 'assistant', content });
        messages.push({
          role: 'user',
          content: '[System: Your last response contained raw JSON which cannot be shown to the customer. Please respond again in natural conversational language only. Use the function-calling mechanism if you need to call a tool.]'
        });
        continue;
      }
    } else {
      finalReply = content;
    }
    break;
  }

  if (!finalReply) {
    finalReply = "Sorry, I got a little tangled up. Could you say that again?";
  }

  session.history.push({ role: 'user', content: text });
  session.history.push({ role: 'assistant', content: finalReply });
  session.history = trimHistory(session.history);
  await sessionStore.save(session);

  return { reply: finalReply, session };
}

module.exports = { handleMessage, SYSTEM_PROMPT };
