import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = process.env.PORT || 10000;
const root = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: '32kb' }));
app.post('/api/generate-map', async (req, res) => {
  const { prompt, markdown = '' } = req.body ?? {};
  if (!process.env.OPENROUTER_API_KEY) return res.status(503).json({ error: 'OPENROUTER_API_KEY is not configured on the server.' });
  if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Enter a prompt first.' });
  const instruction = `You edit Markdown mindmaps. Return ONLY a valid Markdown outline: one # root heading followed by nested bullet items using two spaces per level. Preserve useful existing content unless the user asks to replace it. Do not use code fences or commentary.\n\nExisting map:\n${markdown}\n\nUser request:\n${prompt}`;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.APP_URL || 'https://mindweave.onrender.com', 'X-Title': 'Mindweave' }, body: JSON.stringify({ model: 'nvidia/nemotron-3.5-lightning:free', messages: [{ role: 'user', content: instruction }], temperature: 0.2 }) });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'OpenRouter request failed.' });
    const content = data.choices?.[0]?.message?.content?.replace(/^```(?:markdown)?\s*|\s*```$/gi, '').trim();
    if (!content) return res.status(502).json({ error: 'OpenRouter returned no map.' });
    return res.json({ markdown: content });
  } catch { return res.status(502).json({ error: 'Could not reach OpenRouter.' }); }
});

app.use(express.static(path.join(root, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
app.listen(port, () => console.log(`Mindweave listening on ${port}`));