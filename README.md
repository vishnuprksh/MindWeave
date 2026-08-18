# Mindweave

A prompt-based mindmap editor for Markdown bullet outlines. Run `npm install`, then `npm run dev`.

Use **Tab** to add a child, **Enter** to add a sibling, **F2** or double-click to edit, and **Delete** to remove a node. Import/export Markdown from the left panel.

## Supabase authentication and saved maps

1. Create a Supabase project and copy `.env.example` to `.env`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.
3. In Supabase SQL Editor, create the user-owned maps table:

```sql
create table public.mindmaps (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	title text not null,
	content text not null,
	updated_at timestamptz not null default now(),
	unique (user_id, title)
);

alter table public.mindmaps enable row level security;
create policy "Users can manage their own mindmaps"
	on public.mindmaps for all
	using (auth.uid() = user_id)
	with check (auth.uid() = user_id);
```

The app provides email/password sign-up and sign-in, loads the signed-in user's maps, and saves the current Markdown outline with **Save map**. Keep the Supabase anon key in the frontend environment only; never expose a service-role key.

## Local AI testing

1. Copy `.env.example` to `.env`.
2. Replace `your_openrouter_api_key_here` with your OpenRouter API key.
3. Run `npm run dev`. This starts both the Vite frontend on `http://localhost:5173` and the Node API server on port `10000`.
4. The Node server loads values from the local `.env` file with `dotenv`; the key is never exposed to the browser.
5. Use **Prompt Composer** to generate or edit the mindmap.

The key is read by the local Node server and is not exposed to the browser. Do not commit `.env`.

## Deploy to Vercel

The production frontend is built by Vite and the OpenRouter integration runs in the Vercel function at `api/index.mjs`. The API key stays server-side; do not prefix it with `VITE_`.

### 1. Push the project to GitHub

1. Create a repository on GitHub.
2. From the project directory, commit and push the project, including `package-lock.json` and `vercel.json`.
3. Confirm that `src/`, `files/`, `package.json`, `api/`, and `vercel.json` are present in the repository.

### 2. Import the project into Vercel

1. Sign in at [vercel.com](https://vercel.com/) and choose **Add New → Project**.
2. Import the GitHub repository and keep the detected Vite settings.
3. Use `npm run build` as the build command and `dist` as the output directory if Vercel asks for them.
4. Deploy the project. `vercel.json` supplies the API and SPA routes.

### 3. Configure the AI service in Vercel

1. Open the project in Vercel and select **Settings → Environment Variables**.
3. Set the key to `OPENROUTER_API_KEY`.
4. Paste the OpenRouter API key as the value. Do not add `VITE_` to this name: browser-exposed Vite variables are not private.
5. Optionally override `OPENROUTER_MODEL` to select another model supported by OpenRouter. The Blueprint defaults it to `inclusionai/ling-3.0-flash`.
6. Optionally set `APP_URL` to the deployed Vercel URL, then redeploy so the function receives the variables.

Vercel's environment variables take precedence over local `.env` values, and `.env` must not be committed. The server-side function reads `process.env.OPENROUTER_API_KEY`.

The server calls the configured OpenRouter model. The API key is only read by `api/index.mjs` and is never sent to the browser. Use `/api/healthz` to verify the deployed function.

Vercel installs the locked dependencies, runs the TypeScript/Vite production build, serves `dist`, and routes `/api/*` to `api/index.mjs`. Vercel functions do not provide persistent writes to the repository, so use the existing Export action for downloads; connect a database or Vercel Blob later if server-side map persistence is needed.

### 4. Verify the deployment

1. Wait for the first deployment to finish.
2. Open the Vercel URL shown in the project dashboard.
3. Verify that the sample Markdown maps load and that import/export works.
4. Enter a request in **Prompt Composer** and choose **Generate map**. The current outline is sent as context, so prompts can edit or extend the existing map.

### 5. Future deployments

Push changes to the configured branch. Vercel automatically starts a new deployment.

### Local production check

Run `npm ci && npm run build` before pushing. The production output is written to `dist/`.
