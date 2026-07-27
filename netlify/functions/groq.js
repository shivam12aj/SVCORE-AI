// Server-side proxy for Groq — keys never reach the browser.
// Configure these in Netlify dashboard: Site settings → Environment variables
//   GROQ_KEY_1, GROQ_KEY_2, GROQ_KEY_3, GROQ_KEY_4

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Bad request body' }) };
  }

  const { messages } = payload;
  if (!messages || !Array.isArray(messages)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'messages array required' }) };
  }

  const keys = [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
    process.env.GROQ_KEY_3,
    process.env.GROQ_KEY_4
  ].filter(Boolean);

  if (keys.length === 0) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No GROQ keys configured on server' }) };
  }

  let lastError = null;

  for (const key of keys) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // fast fail per key

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.8,
          max_tokens: 220 // short, voice-friendly replies
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const data = await res.json();

      if (data.error) {
        lastError = data.error;
        continue; // try next key
      }

      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (reply) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reply })
        };
      }
    } catch (err) {
      lastError = err.message;
      continue;
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply: null, error: lastError || 'All keys failed' })
  };
};
