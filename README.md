# Setty

**[Open Setty in your browser](https://krisschnee.github.io/Setty/)**

No account. No install. Click the link, then draw.

A browser tool for drawing simple 3D sets, then exporting a camera still for an AI video pipeline.

Stack: TypeScript, Vite, Canvas 2D (map editor), Three.js (3D view, next).

## AI credit

This project was written with [Grok](https://x.ai) (xAI). If you want to avoid AI-made software, skip Setty.

## Run locally

Node is only for *you* while editing. People using the app just open a web page.

```bash
npm install
npm run dev
```

Open http://localhost:5173

Stop the server with **Ctrl+C** in that same terminal. That ends the `localhost` process; it is not a background service.

If the terminal is gone and the page still loads, something is still bound to port 5173. Stop it with:

```bash
fuser -k 5173/tcp
```

## Share a build

`npm run build` writes a static site into `dist/` (HTML, CSS, JS). No Node is required to view it. Host that folder anywhere that serves files:

- **GitHub Pages** — free URL such as `https://<you>.github.io/Setty/`. Visitors never need a GitHub account. A workflow in `.github/workflows/pages.yml` builds and publishes on each push to `main`.
- **Netlify Drop** — [app.netlify.com/drop](https://app.netlify.com/drop): drag the `dist` folder onto the page and get a link in a minute.
- **itch.io** — a friendly public page for tools; upload the contents of `dist` as an HTML5 project.

GitHub is a good home for the source. The thing you send to other people is the Pages (or Netlify/itch) URL, not the repository.

## Coordinates

World is Y-up, right-handed (Three.js). Polygons live on the XZ ground plane, in meters.

The 2D map draws +X to the right and +Z down the screen. A later top-down Three.js camera will use `camera.up = (0, 0, -1)` so those screen axes match.

## Now

- Click to place polygon vertices
- Enter or double-click to close (needs 3+ points)
- Optional snap-to-grid (`G`)
- Undo, pan, zoom

## Next

- 3D viewport from the same document
- Heights, colors, textures
- JSON save/load
- PNG/JPG camera export
