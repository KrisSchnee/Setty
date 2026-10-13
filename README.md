# Setty

**[Open Setty in your browser](https://krisschnee.github.io/Setty/)**

No account. No install. Click the link, then draw.

A browser tool for drawing simple 3D sets, then exporting a camera still for an AI video pipeline.

Stack: TypeScript, Vite, Canvas 2D (map editor), Three.js (3D view, next).

## AI credit

This project was written with [Grok](https://x.ai) (xAI).

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
