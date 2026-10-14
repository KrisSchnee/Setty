# Setty

**[Open Setty in your browser](https://krisschnee.github.io/Setty/)**

No account. No install. Click the link, then draw.

A browser tool for drawing simple 3D sets, then exporting a camera still for an AI video pipeline.

Stack: TypeScript, Vite, Canvas 2D (map editor), Three.js (3D preview).

## AI credit

This project was written with [Grok](https://x.ai) (xAI).

## Coordinates

World is Y-up, right-handed (Three.js). Polygons live on the XZ ground plane, in meters.

The 2D map is a true top-down: +X right, +Z down the screen. Camera heading is degrees counter-clockwise from +X (0° faces +X, 90° faces +Z). The default camera sits at `(0, 1.5, 0)` with roll 0.

## Now

- Place mode (`P`): click to place vertices; Enter or click the first point to close
- Select mode (`S`): click a polygon, then edit height (0–100 m, 0.1 steps) and color in the side panel
- Click empty map space to select the floor and set floor color (`#202020`) and sky color (`#00BFFF`)
- Click the yellow camera marker to select it; drag to move; set Y-axis rotation (0–359°, 0° = +X) and height (0.1–100 m) in the side panel
- Optional snap-to-grid (`G`)
- Undo, pan, zoom
- 3D preview (16:9, inner and outer walls share the same material)
- Export PNG (`E`): 1920×1080 16:9 still of the camera view, sized for Grok Imagine 1080p

## Next

- Camera presets and camera move
- Per-polygon textures
- JSON save/load
