const aiModel = process.env.OPENROUTER_MODEL || 'inclusionai/ling-3.0-flash';

function json(res, status, body) {
  res.status(status).json(body);
}

export default async function handler(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (req.method === 'GET' && pathname === '/api/healthz') {
    return json(res, 200, { ok: true, aiConfigured: Boolean(process.env.OPENROUTER_API_KEY) });
  }

  const mapMatch = pathname.match(/^\/api\/maps\/([^/]+)$/);
  if (req.method === 'PUT' && mapMatch) {
    return json(res, 501, { error: 'Map persistence is not configured for Vercel. Use export to download the Markdown file.' });
  }

  if (req.method !== 'POST' || pathname !== '/api/generate-map') {
    return json(res, 404, { error: 'Not found.' });
  }
  const { prompt, markdown = '', fileName } = req.body ?? {};
  if (!process.env.OPENROUTER_API_KEY) return json(res, 503, { error: 'OPENROUTER_API_KEY is not configured on the server.' });
  if (typeof prompt !== 'string' || !prompt.trim()) return json(res, 400, { error: 'Enter a prompt first.' });

  const instruction = `You edit Markdown mindmaps. Return ONLY a valid Markdown outline: one # root heading followed by nested bullet items using two spaces per level. Preserve useful existing content unless the user asks to replace it. Do not use code fences or commentary.\n\nExisting map:\n${markdown}\n\nUser request:\n${prompt}`;
  let response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://vercel.com',
        'X-Title': 'Mindweave',
      },
      body: JSON.stringify({ model: aiModel, messages: [{ role: 'user', content: instruction }], temperature: 0.2 }),
    });
  } catch {
    return json(res, 502, { error: 'Could not reach OpenRouter. Check the server network connection and API configuration.' });
  }
  try {
    const raw = await response.text();
    let data = {};
    if (raw.trim()) {
      try { data = JSON.parse(raw); } catch { return json(res, 502, { error: 'OpenRouter returned an invalid response.' }); }
    }
    if (!response.ok) return json(res, response.status, { error: data.error?.message || 'OpenRouter request failed.' });
    const content = data.choices?.[0]?.message?.content?.replace(/^```(?:markdown)?\s*|\s*```$/gi, '').trim();
    if (!content) return json(res, 502, { error: 'OpenRouter returned no map.' });
    return json(res, 200, { markdown: content, saved: false });
  } catch {
    return json(res, 500, { error: 'OpenRouter returned a response that could not be processed.' });
  }
}