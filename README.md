# Footbag Panel Generator

Single‑page web app that generates printable SVG templates for footbag (hacky sack) panels. Panels have curved edges for spherical assembly, a visual seam allowance, and evenly‑spaced stitch marks. Output SVGs are suitable for printing or importing into laser cutting software (e.g., LaserWeb, LightBurn).

See `footbag_spec.md` for the full specification and roadmap.

## Quick Start

- Open `index.html` in any modern browser (no build step required).
- Adjust controls (shape, side length, seam, stitches, curved/straight) and view the live preview.
- Click “Download SVG” to save a print‑ready SVG in millimeters.

## Project Structure

- `index.html`: App shell and controls. Loads JS files (non‑module) in dependency order for easy file:// testing and GitHub Pages.
- `styles.css`: Layout and theming, including preview toolbar and advanced parameters section.
- `src/main.js`: App orchestration — UI bindings, render pipeline, zoom, export/import, visibility rules.
- `src/lib/utils.js`: Shared helpers (`clamp`, `deg2rad`). Exposes `window.FB.utils`.
- `src/lib/constants.js`: Colors, stroke widths, default curvature factors. Exposes `window.FB.CONSTANTS`.
- `src/lib/geometry.js`: Geometry primitives (regular polygons, curves, sampling, truncated hex). Exposes `window.FB.geometry`.
- `src/lib/stitches.js`: Hole spacing, centering, allowable spacing calculations. Exposes `window.FB.stitches`.
- `src/lib/svg.js`: SVG assembly (outline, marks, light grid). Exposes `window.FB.svg`.
- `src/lib/state.js`: Import/export helpers (`collect`, `apply`). Exposes `window.FB.state`.
- `src/lib/ui.js`: UI helpers (`syncPair`, `updateVisibility`, `fixUiTextArtifacts`) and zoom helpers under `FB.ui.zoom` (`getPct`, `setPct`, `adjustBy`, `updateDisplay`, `apply`). Exposes `window.FB.ui`.

## Features (MVP)

- Curved or straight polygon panels for 3/4/5/6 sides (triangle, square, pentagon, hexagon)
- Configurable side length (mm), seam allowance (mm), stitch holes per side
- Optional hole spacing control (min 1mm; dynamic max based on geometry). If spacing is too large to fit the requested count, spacing is reduced to preserve the count.
- Adjustable stitch dot size (0.2–1.5mm diameter)
- Optional curvature factor control (0.10–0.40) when edges are curved
- Export/Import: Save and load panel settings as JSON
  - JSON Schema: `schema/settings.schema.json` (referenced in exported files via `$schema`)
- Clean, printable SVG with units in millimeters
- Visual stitch marks as dots
- Optional light grid to verify print scaling (10mm)

## SVG Colors and Strokes

- Black (0.5mm): Cutting outline
- Gray (0.2mm): Stitch marks

## Printing Notes

- Ensure “Actual size” / 100% scaling when printing so millimeter units are accurate.
- Use the 10mm grid lines in the export to validate printer scaling (very faint to avoid interference).

## Roadmap (Next)

- Multi‑panel layout on Letter/A4 sheets
- Preset polyhedron patterns (e.g., 32‑panel soccer ball)
- PDF export option
- Intelligent nesting and waste calculation

## Contributing

Bug reports and improvements welcome. Please keep changes focused and incremental.
