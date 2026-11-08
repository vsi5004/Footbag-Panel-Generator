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
- Compare total panel area with full exported sheet area; padding and spacing affect the percentage
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
- **Panel Area / Sheet Area**: Total panel area divided by the full exported sheet area, including padding and spacing
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
npx playwright install chromium firefox webkit
npm run test:browser # Real-browser tests against the production build
npm run benchmark    # Advisory warmed Node/jsdom timing measurements
npm run benchmark:browser # Advisory interaction measurements against the built app
npm run format     # Format TypeScript and test/helper sources
npm run settings:sync # Update HTML/schema after changing schema/controls.json
```

### Settings and controls

`schema/controls.json` defines numeric control defaults, bounds and schema paths. Runtime validators/imports use it directly. After editing it, run `npm run settings:sync` to update HTML attributes and the JSON schema. `npm run settings:check` and consistency tests prevent these from drifting apart. The broader historical stitch-count schema bounds remain explicit for compatibility; geometry still determines dynamic spacing/margin limits.

`src/lib/controls.ts` lists each range/number pair once for binding, import display updates and reset. Layout reset reads numeric defaults from the generated HTML and checkbox defaults from their declarations, so it follows the same definitions as a fresh page. Panel, sheet and preview elements have separate types in `src/types.ts`. Modules use direct imports; there is no global registration or startup polling.

Settings imports validate their complete payload before changing controls. Historical partial files and finite numeric strings remain supported; omitted options retain their current values, except a missing export scale resets to 100%. Unsupported versions, unknown shapes, invalid field types and non-finite numbers are rejected. Unknown extra fields are ignored for compatibility.

Imported geometry values are applied without limits inherited from the previous design, then constraints are recomputed before the first render. Curvature radius is saved and restored even with straight edges selected. Only the latest selected file may update the design; read failures leave the current design intact. SVG and settings downloads flush pending panel edits first, so the exported design includes the latest geometry constraints.

### Regression coverage

`tests/fixtures/deployed-baseline.json` records 36 cases captured from main at `a9ced1f5a55791f736a9dd6bbd3f2bdad5a4b201`, before the maintenance refactor. They cover all shapes, straight/curved edges, no-hole and custom/bunched-hole modes, inverted sheets, SVG exports at 75/100/125%, constraints and material utilization. Exact hashes detect changes to geometry and serialized SVG output. The baseline comparison preserves every field except the intentionally corrected utilization value; dedicated analytic tests now verify that ratio against full exported dimensions. Do not regenerate this fixture just to make a refactor pass; investigate differences and document any intentional behavior change.

Playwright tests use the built app to exercise startup, shape/visibility changes, paired controls, resets, zoom, grids, downloads, file imports, legacy settings, 12×12 layouts, spacing extrema and a mobile viewport. They run in Chromium, Firefox and WebKit in CI before merging or deploying. Browser regressions also verify immediate exports after edits, invalid-sheet recovery and keyboard help controls. On Windows, an installed Edge can be used for the Chromium project with `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:browser -- --project=chromium` after `npm run build`.

Star validation and rendering share the same alternating tip/root vertices and the same minimum stitch corner margin. Curvature limits account for the real star edge chords and round upward to the radius control's 0.5 mm step. Material utilization uses the full exported sheet area as described below.

Star limits are corrected from the former regular-decagon approximation. For straight edges, eight holes per side, zero requested corner margin and the default root offset:

| Outer radius | Root angle | Minimum curve radius, old → new | Maximum hole spacing, old → new |
| --- | --- | --- | --- |
| 30 mm | 100° | 15 → 10 mm | 8.3 → 4.6 mm |
| 30 mm | 128° | 15 → 10 mm | 8.3 → 5.1 mm |
| 30 mm | 150° | 15 → 11.5 mm | 8.3 → 5.9 mm |
| 80 mm | 128° | 40 → 27 mm | 22.2 → 14.4 mm |

Existing star settings above a corrected spacing limit are clamped on edit/import, so affected stitch positions and SVG downloads can change. Valid settings within the new limits retain the same geometry. The original 36 baseline cases, including their star outputs, remain unchanged; additional analytic and browser tests cover the changed limits, live radius changes and corrected-design round trips.

### Panel area / sheet area

The percentage is `100 × sum of panel areas ÷ (exported sheet width × exported sheet height)`. The denominator includes sheet padding, row/column spacing, nesting offset and the stroke/dot allowances used by SVG generation. Stroke and hole markings do not add to the panel-area numerator. Curved panel area includes only arcs that the outline actually renders.

For six 30 mm squares, 4 mm horizontal spacing, 5 mm vertical spacing, 10 mm padding and 1 mm dots, the exported sheet is 121 × 87 mm. The corrected ratio is 51.3%; the old calculation showed 84.8% by excluding sheet margins and rendering allowances.

Panels that overlap are counted separately. A ratio over 100% remains visible and does not represent unique occupied area. Non-positive or non-finite sheet dimensions display an unavailable value (`—`). Global export scaling multiplies both areas by the same factor squared, so the percentage stays unchanged. Panel shapes, stitch positions and SVG dimensions are unchanged by this metric correction. Layouts with non-positive or non-finite sheet dimensions show an explanation instead of an invalid preview and disable layout download. Increase horizontal/vertical spacing or padding to restore it; individual panel export remains available.

### Optional nesting and clearance checks

Manual layouts keep their existing behavior. **Check clearance** examines the current placement of cut outlines at the requested gap, including alternating-column reflections and nesting offsets. It warns about overlap, contact or insufficient gap; it does not block manual exports. Hole marks are not included in clearance checks.

**Optimize layout** searches aligned grids, alternating rows/columns and staggered rows/columns. Allowed rotations are explicit: no rotation, 0°/180° (the existing default), or 90° increments. New searches never reflect panels. Choose a rotation policy suited to fabric grain and nap.

The default goal minimizes cropped sheet area for the current panel count and retains the existing bounded column search. **Fit current count within stock** tries every column count, respecting a required stock width and optional maximum height. With width only, it minimizes the length used along a roll. Stock dimensions are actual millimeters at the current export scale, including padding and drawing allowances; scaling converts stock limits into design coordinates for the search. SVGs remain cropped to the arrangement rather than padded to the full stock rectangle. The existing dimensions display remains in design millimeters at 100% export; the candidate message also shows actual scaled dimensions.

**Find capacity within stock** requires both dimensions and searches up to 144 copies. It reports the best count found across the supported arrangements, not a proven maximum. Applying capacity commits the actual count and the complete arrangement into editable **Pattern layout** settings; exports, filenames and area ratios use that count. A deterministic bounded search reduces lattice pitches. Stock searches use a repeated neighborhood for trial clearance checks, then independently validate every placement in each final candidate. This is a heuristic for repeated copies of one shape, not a guarantee of optimal packing.

Search controls apply to the next search. **Apply candidate** fills the manual Pattern layout controls: panel count, columns, horizontal/vertical center spacing, placement pattern, base rotation, alternating rotations, allowed rotations, cutting gap and stock limits. A partial final row is supported; rows are derived from count and columns. These settings reproduce the calculated positions exactly and can be edited directly, including patterns that the original grid controls cannot describe. The original grid controls remain available in **Grid layout** mode. Choosing **Use grid layout** is an explicit mode change; design or spacing edits do not restore it automatically.

Pattern settings remain in place when panel geometry, hole settings, spacing or export scale changes. Clearance, allowed rotations and stock fit are rechecked before export. Unsafe edited patterns retain their controls and show an explanation with download disabled, so the user can adjust them or optimize again. Search options do not alter the current pattern until another result is applied. Changing settings while a search/candidate is pending cancels it so stale results cannot be applied.

The search runs in a cancellable Web Worker. Its result is a proposal: a translucent green candidate overlays the current layout, aligned at the top-left sheet edge, with dimensions and area difference reported before committing. The comparison canvas grows if the candidate is larger. **Apply candidate** commits the editable pattern and removes the green layer; **Reject candidate** removes it while preserving the current layout. Settings edits discard stale proposals; preview zoom remains available. The green layer is a separate image outside the exportable SVG, so downloading while comparing still exports only the current arrangement. A safe arrangement may need more area than an overlapping grid. Layout reset explicitly restores the default grid.

The minimum gap is in millimeters at 100% export and scales with the template. Circular arcs are flattened from the actual rounded SVG outline with at most 0.02 mm chord error; clearance includes an additional 0.045 mm for both outlines and coordinate rounding. Bounding boxes reject distant pairs; segment distance/intersection and containment tests handle convex and concave panels. Self-crossing outlines are rejected by automatic nesting. Exports retain their original circular paths and ordinary hole circles; the approximation is used only for placement checks.

Settings version 1 supports optional `layout.nesting` next-search preferences and `layout.editable` for the committed manual pattern. The latter stores the lattice (`columns`, `pitchX`, `pitchY`, `pattern`, `angle`, `rotateAlternates`) plus `count`, `gap`, `rotations` and optional physical `stock` limits. Legacy `layout.optimized` plans with explicit positions are still accepted; new search results also carry their lattice so Apply can verify exact reproduction before committing. The schema forbids simultaneous editable and optimized layouts. Imports validate every extension before mutating controls. Malformed pattern imports are atomic; valid but unsafe patterns stay editable with export blocked. Legacy stale or overlapping optimized plans retain their previous fallback to the grid. Files with neither extension select the original grid, and absent export scale defaults to 100%. Older app versions do not understand editable patterns or enforce stock limits; use the current app for these exports.

### Geometry performance

Constraint validation and stitch placement share a bounded cache of sampled edge metrics keyed by endpoints, radius and sample count. Sampling and distance accumulation retain the same operation order. Panels with no stitch holes skip hole sampling; UI renders reuse the latest computed panel when its resolved configuration is unchanged. Repeated sheet panels clone ordinary SVG markup, avoiding repeated attribute construction while preserving compatibility with cutting software.

`npm run benchmark` reports median warmed timings from five trials in Node/jsdom; these are advisory measurements, not CI thresholds or phone benchmarks. On the same Windows host with Node 22.22.2, before/after results were:

| Workload | Before (ms) | After (ms) |
| --- | ---: | ---: |
| Mixed panel calculation | 0.065 | 0.015 |
| Panel calculation with no holes | 0.062 | 0.005 |
| 12×12 star SVG, 28,800 hole circles | 287.936 | 236.526 |

All 36 outputs captured from merged main before this change match exactly after optimization, including utilization. The historical deployed-baseline fixture is unchanged. Additional tests cover cache eviction/input changes, concave containment, touching outlines, curve approximation, independently finer clearance checks, all shape variants, deterministic searches, 144 panels, scaled exports, settings compatibility, stale workers and mobile controls.

### Incremental preview updates

Layout changes are coalesced into one animation frame and read the latest controls. When the panel geometry, dot diameter, panel count and manual/optimized SVG structure are unchanged, the sheet retains its paths and hole circles. Spacing, padding, inversion and nesting-offset edits update transforms, dimensions, viewBox and grid as needed. Geometry/dot/count changes and transitions between manual and optimized layouts rebuild through the existing SVG factory. Invalid dimensions still clear the preview and disable sheet export.

The panel grid updates only the single-panel grid layer. Sheet grid toggles replace only that grid layer; unchanged grids and attributes are retained. Downloads, settings export and nesting actions synchronously flush both pending panel edits and queued layout frames before reading state. This prevents immediate exports or clearance checks from using a previous frame.

`npm run benchmark:browser -- --runs=5 --out=work/browser-timings.json` measures the current production build in Chromium at 1280×900; run `npm run build` first and create the output directory if specifying one. The script starts/stops its own local preview on port 4322 and supports `--browser=firefox` or `--browser=webkit` when installed. Each workload has a warm-up and reports median handler time, time over two animation frames, sheet replacements and retained-node identity. Frame timing includes scheduling/rendering opportunities and is not a direct paint timestamp. Measurements are advisory, with no CI timing thresholds.

On the same Windows desktop in Chromium 158.0.8127.18, five-run medians for the 12×12 star sheet (28,800 hole circles) were:

| Interaction | Before: two-frame time (ms) | After: two-frame time (ms) |
| --- | ---: | ---: |
| Horizontal spacing edit | 75.0 | 31.6 |
| Padding edit | 69.2 | 32.8 |
| Sheet grid toggle | 123.8 | 73.4 |
| Panel grid toggle | 161.0 | 63.2 |
| Synthetic burst of 24 spacing inputs in one task | 2051.9 | 98.9 |

The burst previously replaced the sheet 24 times; it now performs one layout commit while retaining the existing SVG and hole circles. These are desktop browser measurements, not phone performance guarantees. Browser regression tests assert node retention, one-frame coalescing and latest-value downloads without timing thresholds. Unit tests compare incremental SVG serialization and 75/100/125% exports exactly against fresh SVGs across every shape, straight/curved edges, holes on/off, inversion, same-count row/column changes and optimized placements.

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
- General nesting of different shapes into fixed stock dimensions
- Bag size estimator?

## Contributing

Bug reports and improvements welcome! Please keep changes focused and incremental.
