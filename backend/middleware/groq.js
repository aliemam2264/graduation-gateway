const Groq = require("groq-sdk");

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile"; // free & powerful

/**
 * Single-turn completion
 */
async function complete(systemPrompt, userMessage, maxTokens = 2000) {
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });
  return response.choices[0].message.content;
}

/**
 * Multi-turn chat (pass full history)
 */
async function chat(systemPrompt, messages, maxTokens = 1500) {
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  });
  return response.choices[0].message.content;
}

module.exports = { complete, chat };
