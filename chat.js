export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const message = (body.message || body.prompt || '').toString().trim();
    if (!message) return res.status(400).json({ error: 'message required' });
    const system = 'You are SVCORE AI — Bharat Ka Voice AI. Help Indian users and businesses. Reply in the same language as the user (Hindi, Hinglish, or English). Be clear, practical, professional. If you do not know a fact, say so honestly. Do not invent company CEOs, metrics, or testimonials.';
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_KEY_1 || process.env.GROQ_API_KEY;
    const errors = [];
    if (geminiKey) {
      try {
        for (const model of ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-latest']) {
          const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(geminiKey);
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: system + '\n\nUser: ' + message }] }],
              generationConfig: { temperature: 0.6, maxOutputTokens: 1200 }
            })
          });
          const data = await r.json();
          const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
          if (r.ok && text) return res.status(200).json({ reply: text, provider: 'gemini', model });
          errors.push('gemini:' + model + ':' + (data?.error?.message || r.status));
        }
      } catch (e) { errors.push('gemini:' + e.message); }
    }
    if (groqKey) {
      try {
        for (const model of ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b']) {
          const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + groqKey },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: message }
              ],
              temperature: 0.6,
              max_tokens: 1200
            })
          });
          const data = await r.json();
          const text = data?.choices?.[0]?.message?.content || '';
          if (r.ok && text) return res.status(200).json({ reply: text, provider: 'groq', model });
          errors.push('groq:' + model + ':' + (data?.error?.message || r.status));
        }
      } catch (e) { errors.push('groq:' + e.message); }
    }
    if (!geminiKey && !groqKey) return res.status(503).json({ error: 'API keys missing on Vercel' });
    return res.status(502).json({ error: 'AI temporarily unavailable', detail: errors.slice(0, 3).join(' | ') });
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: String(e?.message || e) });
  }
}
