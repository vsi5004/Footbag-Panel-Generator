# Footbag Panel Generator

[![Build and Deploy](https://github.com/vsi5004/Footbag-Panel-Generator/actions/workflows/deploy.yml/badge.svg)](https://github.com/vsi5004/Footbag-Panel-Generator/actions/workflows/deploy.yml)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen?logo=github)](https://vsi5004.github.io/Footbag-Panel-Generator/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)

Single‑page web app that generates printable SVG templates for footbag (hacky sack) panels. Features individual panel generation, plus multi-panel layout optimization for efficient integration into many common laser cutting workflows. Output SVGs are suitable for printing or importing into laser cutting software (e.g., LaserWeb, LightBurn).

## Usage Tips

### Panel Design
- Start with default pentagon settings for traditional footbag construction
- Use curved edges for more spherical panels, straight edges for easier cutting
- Adjust hole spacing based on thread thickness and stitching technique
- Use corner margins to avoid stitching too close to panel vertices

### Layout Optimization
- Enable inverted nesting and adjust spacing for maximum material efficiency
- Use negative horizontal spacing for overlapping panel arrangements
- Monitor material utilization percentage to minimize waste
- Export individual panels for single-piece cutting or full layouts for batch production

### Export Scale
- Set **Export scale (%)** to resize both panel and layout SVG downloads (1–1000%, default 100%).
- This scales the whole template, including seam allowances, holes, padding, and layout spacing. Base measurements and previews stay unchanged.
- Reference grid spacing remains 10 mm. Non-default scale is included in SVG filenames.
- Settings JSON saves the export scale; importing older settings without it resets scale to 100%.

### Printing Notes
- Ensure "Actual size" / 100% scaling when printing so millimeter units are accurate
- Use the 10mm grid lines in exported SVGs to validate printer scaling
- Grid lines are intentionally faint to avoid interference with cutting lines
- For laser cutting, use black lines (cutting) and ignore gray marks (reference only)

## Features

### Panel Generation
- **Shape Options**: Curved or straight polygon panels for 3/4/5/6/10 sides (triangle, square, pentagon, hexagon, star)
- **Configurable Parameters**: Side length (mm), seam allowance (mm), stitch holes per side
- **Stitch Hole Controls**:
  - **Show/hide toggle**: Option to generate panels without stitch holes for manual marking or different construction methods
  - Hole spacing control (min 1mm; dynamic max based on geometry)
  - **Hole bunching**: Creates pairs of holes closer together with compensating gaps between pairs (0 to spacing/2)
  - Adjustable stitch dot size (0.2–1.5mm diameter)
- **Advanced Controls**:
  - Curvature factor control (0.10–0.40) when edges are curved
  - Corner margin settings with dynamic constraints
  - **Custom corner stitch spacing**: Independent control of first/last hole spacing for smoother edge transitions
- **Star Shape Enhancements**:
  - Configurable root angle control (100°–150°) for precise star geometry
  - Smart corner spacing (applies only to tips, preserves natural root spacing)
- **Hexagon Variants**: Regular hexagons or truncated triangles for specialized designs
- **Zoom Controls**: 20%–300% zoom with 200% default for optimal viewing

### Layout Optimization System
- **Multi-Panel Layouts**: Arrange panels in customizable grids (up to 12×12)
- **Intelligent Spacing**: 
  - Horizontal spacing with negative values for tight nesting (-40mm to +70mm)
  - Vertical spacing optimization (0mm to +50mm)
- **Inverted Nesting**: Flip alternating panels for improved material efficiency
- **Nesting Offset**: Fine-tune vertical positioning of flipped panels (-40mm to +40mm)
- **Material Utilization**: Real-time calculation and display of material usage percentage
- **Layout Preview**: Dedicated preview with independent zoom and grid controls


## Development

### Quick Command Reference

```bash
npm install
npm run dev        # Start development server
npm run build      # Build for production
npm run type-check # TypeScript type checking
npm test           # Unit, compatibility and deployed-output regression tests
npm run check      # Settings consistency, lint, format, tests and production build
npx playwright install chromium
npm run test:browser # Real-browser tests against the production build
npm run format     # Format TypeScript and test/helper sources
npm run settings:sync # Update HTML/schema after changing schema/controls.json
```

### Settings and controls

`schema/controls.json` defines numeric control defaults, bounds and schema paths. Runtime validators/imports use it directly. After editing it, run `npm run settings:sync` to update HTML attributes and the JSON schema. `npm run settings:check` and consistency tests prevent these from drifting apart. The broader historical stitch-count schema bounds remain explicit for compatibility; geometry still determines dynamic spacing/margin limits.

`src/lib/controls.ts` lists each range/number pair once for binding, import display updates and reset. Panel, sheet and preview elements have separate types in `src/types.ts`. Modules use direct imports; there is no global registration or startup polling.

Settings imports validate their complete payload before changing controls. Historical partial files and finite numeric strings remain supported; omitted options retain their current values, except a missing export scale resets to 100%. Unsupported versions, unknown shapes, invalid field types and non-finite numbers are rejected. Unknown extra fields are ignored for compatibility.

Imported geometry values are applied without limits inherited from the previous design, then constraints are recomputed before the first render. Curvature radius is saved and restored even with straight edges selected. Only the latest selected file may update the design; read failures leave the current design intact.

### Regression coverage

`tests/fixtures/deployed-baseline.json` records 36 cases captured from main at `a9ced1f5a55791f736a9dd6bbd3f2bdad5a4b201`, before the maintenance refactor. They cover all shapes, straight/curved edges, no-hole and custom/bunched-hole modes, inverted sheets, SVG exports at 75/100/125%, constraints and material utilization. Exact hashes detect changes to geometry and serialized SVG output. Do not regenerate this fixture just to make a refactor pass; investigate differences and document any intentional behavior change.

Playwright tests use the built app to exercise startup, shape/visibility changes, paired controls, resets, zoom, grids, downloads, file imports, legacy settings, 12×12 layouts, spacing extrema and a mobile viewport. They run in Chromium in CI. On Windows, an installed Edge can be used with `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:browser` after `npm run build`.

The existing star constraint approximation and material-utilization definition are preserved. They are documented beside the shared calculations so future numerical changes can be reviewed separately.

### Deployment
The app is automatically deployed to GitHub Pages via GitHub Actions when pushing to the main branch. Settings, lint, formatting, regression tests, the production build and browser tests must pass before the deployment workflow uploads the site. Pull requests run the same checks without deploying.

## Project Structure

- `index.html`: App shell with responsive layout and comprehensive tooltip system
- `styles.css`: Complete responsive styling including wide-screen layouts and tooltip behaviors
- `src/main.ts`: TypeScript app orchestration — streamlined with modular architecture
- `src/types.ts`: Comprehensive type definitions for the entire application
- `src/lib/dom.ts`: DOM element management and validation utilities
- `src/lib/settings.ts`: Shared numeric normalization from the settings definitions
- `src/lib/controls.ts`: Shared panel/layout range and number pair registry
- `src/lib/shape-geometry.ts`: Shared polygon construction and orientation
- `src/lib/validation.ts`: Input validation, configuration collection, and geometry computation  
- `src/lib/layout.ts`: Multi-panel layout system with material utilization calculations
- `src/lib/events.ts`: Event handling, reset functionality, and import/export logic
- `src/lib/renderer.ts`: Rendering pipeline, SVG generation, and error handling
- `src/lib/utils.ts`: Shared helpers (`clamp`, `deg2rad`)
- `src/lib/constants.ts`: Colors, stroke widths, default curvature factors
- `src/lib/geometry.ts`: Geometry primitives (regular polygons, curves, sampling, truncated hex)
- `src/lib/stitches.ts`: Hole spacing, centering, allowable spacing calculations
- `src/lib/svg.ts`: SVG assembly (outline, marks, light grid)
- `src/lib/state.ts`: Import/export helpers (`collect`, `apply`)
- `src/lib/ui.ts`: UI helpers (`syncPair`, `updateVisibility`, `fixUiTextArtifacts`) and zoom helpers
- `src/lib/tooltips.ts`: Comprehensive tooltip system for enhanced user experience
- `public/favicon.svg`: Custom pentagon-themed favicon for professional presentation

## Build System

- **TypeScript** with Vite for modern development experience with modular architecture
- **Type Safety**: Comprehensive type definitions for geometric calculations and UI interactions
- **Automated Deployment**: GitHub Actions checks and browser tests gate deployment to GitHub Pages
- **Development Server**: Hot reload with `npm run dev`
- **Asset Management**: Public directory serving for favicon and static assets


## Future Enhancements
- Preset polyhedron patterns (e.g., 32‑panel soccer ball configurations)
- PDF export option
- Automatic nesting algorithms for irregular shapes?
- Bag size estimator?

## Contributing

Bug reports and improvements welcome! Please keep changes focused and incremental.
