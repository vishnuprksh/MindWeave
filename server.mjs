import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env for local development without overriding environment variables
// supplied by Render (or another deployment platform).
dotenv.config({ override: false });

const app = express();
const port = process.env.PORT || 10000;
const root = path.dirname(fileURLToPath(import.meta.url));
const filesDir = path.join(root, 'files');

function mapPath(name) {
  const safeName = path.basename(typeof name === 'string' ? name : '');
  if (!safeName || !/^[a-zA-Z0-9._-]+\.md$/.test(safeName)) return null;
  return path.join(filesDir, safeName);
}

app.use(express.json({ limit: '32kb' }));
app.put('/api/maps/:name', async (req, res) => {
  const destination = mapPath(req.params.name);
  const { markdown } = req.body ?? {};
  if (!destination) return res.status(400).json({ error: 'Invalid Markdown file name.' });
  if (typeof markdown !== 'string' || !markdown.trim()) return res.status(400).json({ error: 'Markdown cannot be empty.' });
  try {
    await fs.writeFile(destination, markdown.endsWith('\n') ? markdown : `${markdown}\n`, 'utf8');
    return res.json({ saved: true, name: path.basename(destination) });
  } catch {
    return res.status(500).json({ error: 'Could not save the active Markdown file.' });
  }
});

app.post('/api/generate-map', async (req, res) => {
  const { prompt, markdown = '', fileName } = req.body ?? {};
  if (!process.env.OPENROUTER_API_KEY) return res.status(503).json({ error: 'OPENROUTER_API_KEY is not configured on the server.' });
  if (typeof prompt !== 'string' || !prompt.trim()) return res.status(400).json({ error: 'Enter a prompt first.' });
  const instruction = `You edit Markdown mindmaps. Return ONLY a valid Markdown outline: one # root heading followed by nested bullet items using two spaces per level. Preserve useful existing content unless the user asks to replace it. Do not use code fences or commentary.\n\nExisting map:\n${markdown}\n\nUser request:\n${prompt}`;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': process.env.APP_URL || 'https://mindweave.onrender.com', 'X-Title': 'Mindweave' }, body: JSON.stringify({ model: 'inclusionai/ling-3.0-flash', messages: [{ role: 'user', content: instruction }], temperature: 0.2 }) });
    const raw = await response.text();
    let data = {};
    if (raw.trim()) {
      try { data = JSON.parse(raw); } catch { return res.status(502).json({ error: 'OpenRouter returned an invalid response.' }); }
    }
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'OpenRouter request failed.' });
    const content = data.choices?.[0]?.message?.content?.replace(/^```(?:markdown)?\s*|\s*```$/gi, '').trim();
    if (!content) return res.status(502).json({ error: 'OpenRouter returned no map.' });
    if (fileName) {
      const destination = mapPath(fileName);
      if (!destination) return res.status(400).json({ error: 'Invalid Markdown file name.' });
      await fs.writeFile(destination, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
    }
    return res.json({ markdown: content, saved: Boolean(fileName) });
  } catch { return res.status(502).json({ error: 'Could not reach OpenRouter.' }); }
});

app.use(express.static(path.join(root, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
app.listen(port, () => console.log(`Mindweave listening on ${port}`));