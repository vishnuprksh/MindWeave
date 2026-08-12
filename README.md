# Mindweave

A prompt-based mindmap editor for Markdown bullet outlines. Run `npm install`, then `npm run dev`.

Use **Tab** to add a child, **Enter** to add a sibling, **F2** or double-click to edit, and **Delete** to remove a node. Import/export Markdown from the left panel.

## Deploy to Render (free)

This repository includes `render.yaml`, so Render can build the Vite app as a free static site. The application is client-side only and does not require a server, database, environment variables, or a paid plan.

### 1. Push the project to GitHub

1. Create a repository on GitHub.
2. From the project directory, commit and push the project, including `package-lock.json` and `render.yaml`.
3. Confirm that `src/`, `files/`, `package.json`, and `render.yaml` are present in the repository.

### 2. Create the Render service

1. Sign in at [render.com](https://render.com/) and open the dashboard.
2. Select **New +** → **Static Site**.
3. Connect GitHub and select the Mindweave repository.
4. Set **Branch** to `main` (or the branch containing the deployment files).
5. Use these settings:
	- **Build Command:** `npm ci && npm run build`
	- **Publish Directory:** `dist`
	- **Instance/plan:** Free
6. Click **Create Static Site**.

Render will install the locked dependencies, run the TypeScript/Vite production build, and publish the generated `dist` directory. The rewrite in `render.yaml` makes direct browser navigation work if client-side routes are added later.

### 3. Verify the deployment

1. Wait for the first deploy to finish with status **Live**.
2. Open the `onrender.com` URL shown by Render.
3. Verify that the sample Markdown maps load and that import/export works.

### 4. Future deployments

Push changes to the configured branch. Render automatically starts a new deployment. To deploy manually, open the service and choose **Manual Deploy** → **Deploy latest commit**.

### Local production check

Run `npm ci && npm run build` before pushing. The production output is written to `dist/`.
