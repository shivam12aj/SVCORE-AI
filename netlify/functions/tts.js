// Server-side proxy for ElevenLabs TTS — key never reaches the browser.
// Configure in Netlify dashboard: Site settings → Environment variables
//   ELEVENLABS_KEY

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

  const { text, voiceId } = payload;
  const ELEVEN_KEY = process.env.ELEVENLABS_KEY;

  if (!ELEVEN_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'No ElevenLabs key configured on server' }) };
  }
  if (!text || !voiceId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'text and voiceId required' }) };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId + '/stream', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.85,
          style: 0.3,
          use_speaker_boost: true
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: 'ElevenLabs error ' + res.status }) };
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64 })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
