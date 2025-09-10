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

### Printing Notes
- Ensure "Actual size" / 100% scaling when printing so millimeter units are accurate
- Use the 10mm grid lines in exported SVGs to validate printer scaling
- Grid lines are intentionally faint to avoid interference with cutting lines
- For laser cutting, use black lines (cutting) and ignore gray marks (reference only)

## Features

### Panel Generation
- **Shape Options**: Curved or straight polygon panels for 3/4/5/6 sides (triangle, square, pentagon, hexagon)
- **Configurable Parameters**: Side length (mm), seam allowance (mm), stitch holes per side
- **Advanced Controls**: 
  - Hole spacing control (min 1mm; dynamic max based on geometry)
  - Adjustable stitch dot size (0.2–1.5mm diameter)
  - Curvature factor control (0.10–0.40) when edges are curved
  - Corner margin settings with dynamic constraints
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
```

### Deployment
The app is automatically deployed to GitHub Pages via GitHub Actions when pushing to the main branch.

## Project Structure

- `index.html`: App shell with responsive layout and comprehensive tooltip system
- `styles.css`: Complete responsive styling including wide-screen layouts and tooltip behaviors
- `src/main.ts`: TypeScript app orchestration — streamlined with modular architecture
- `src/types.ts`: Comprehensive type definitions for the entire application
- `src/lib/dom.ts`: DOM element management and validation utilities
- `src/lib/validation.ts`: Input validation, configuration collection, and geometry computation  
- `src/lib/layout.ts`: Multi-panel layout system with material utilization calculations
- `src/lib/events.ts`: Event handling, reset functionality, and import/export logic
- `src/lib/renderer.ts`: Rendering pipeline, SVG generation, and error handling
- `src/lib/utils.js`: Shared helpers (`clamp`, `deg2rad`). Exposes `window.FB.utils`
- `src/lib/constants.js`: Colors, stroke widths, default curvature factors. Exposes `window.FB.CONSTANTS`
- `src/lib/geometry.js`: Geometry primitives (regular polygons, curves, sampling, truncated hex). Exposes `window.FB.geometry`
- `src/lib/stitches.js`: Hole spacing, centering, allowable spacing calculations. Exposes `window.FB.stitches`
- `src/lib/svg.js`: SVG assembly (outline, marks, light grid). Exposes `window.FB.svg`
- `src/lib/state.js`: Import/export helpers (`collect`, `apply`). Exposes `window.FB.state`
- `src/lib/ui.js`: UI helpers (`syncPair`, `updateVisibility`, `fixUiTextArtifacts`) and zoom helpers. Exposes `window.FB.ui`
- `src/lib/tooltips.js`: Comprehensive tooltip system for enhanced user experience
- `public/favicon.svg`: Custom pentagon-themed favicon for professional presentation

## Build System

- **TypeScript** with Vite for modern development experience with modular architecture
- **Type Safety**: Comprehensive type definitions for geometric calculations and UI interactions
- **Automated Deployment**: GitHub Actions builds and deploys to GitHub Pages
- **Development Server**: Hot reload with `npm run dev`
- **Asset Management**: Public directory serving for favicon and static assets


## Future Enhancements
- Preset polyhedron patterns (e.g., 32‑panel soccer ball configurations)
- PDF export option
- Automatic nesting algorithms for irregular shapes?
- Bag size estimator?

## Contributing

Bug reports and improvements welcome! Please keep changes focused and incremental.