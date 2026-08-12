# Mindweave

A prompt-based mindmap editor for Markdown bullet outlines. Run `npm install`, then `npm run dev`.

Use **Tab** to add a child, **Enter** to add a sibling, **F2** or double-click to edit, and **Delete** to remove a node. Import/export Markdown from the left panel.

## Local AI testing

1. Copy `.env.example` to `.env`.
2. Replace `your_openrouter_api_key_here` with your OpenRouter API key.
3. Run `npm run dev`. This starts both the Vite frontend on `http://localhost:5173` and the Node API server on port `10000`.
4. The Node server loads values from the local `.env` file with `dotenv`; the key is never exposed to the browser.
5. Use **Prompt Composer** to generate or edit the mindmap.

The key is read by the local Node server and is not exposed to the browser. Do not commit `.env`.

## Deploy to Render (free)

This repository includes `render.yaml`. The app uses a small Node server so the OpenRouter key stays server-side.

### 1. Push the project to GitHub

1. Create a repository on GitHub.
2. From the project directory, commit and push the project, including `package-lock.json` and `render.yaml`.
3. Confirm that `src/`, `files/`, `package.json`, and `render.yaml` are present in the repository.

### 2. Create the Render service

1. Sign in at [render.com](https://render.com/) and open the dashboard.
2. Select **New +** → **Static Site**.
3. Connect GitHub and select the Mindweave repository. Choose **Web Service** (not Static Site).
4. Set **Branch** to `main` (or the branch containing the deployment files).
5. Use these settings:
	- **Build Command:** `npm ci && npm run build`
	- **Start Command:** `npm start`
	- **Instance/plan:** Free
6. Click **Create Web Service**.

### 3. Add the OpenRouter key in Render

1. Open the service in Render and select **Environment**.
2. Click **Add Environment Variable**.
3. Set the key to `OPENROUTER_API_KEY`.
4. Paste the OpenRouter API key as the value. Do not add `VITE_` to this name: browser-exposed Vite variables are not private.
5. Save changes and choose **Manual Deploy** → **Deploy latest commit** (or wait for the automatic deploy).

On Render, `OPENROUTER_API_KEY` and `APP_URL` are supplied by Render's environment-variable settings. Render's values take precedence over any local `.env` values, and `.env` must not be committed. The server reads `process.env.OPENROUTER_API_KEY` in both cases.

The server calls the free `nvidia/nemotron-3.5-lightning:free` model through OpenRouter. The key is never sent to the browser.

Render will install the locked dependencies, run the TypeScript/Vite production build, and serve `dist` through `server.mjs`.

### 4. Verify the deployment

1. Wait for the first deploy to finish with status **Live**.
2. Open the `onrender.com` URL shown by Render.
3. Verify that the sample Markdown maps load and that import/export works.
4. Enter a request in **Prompt Composer** and choose **Generate map**. The current outline is sent as context, so prompts can edit or extend the existing map.

### 5. Future deployments

Push changes to the configured branch. Render automatically starts a new deployment. To deploy manually, open the service and choose **Manual Deploy** → **Deploy latest commit**.

### Local production check

Run `npm ci && npm run build` before pushing. The production output is written to `dist/`.
