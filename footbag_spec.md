# Footbag Panel SVG Generator - Project Specification

## Project Overview

**Purpose:** Create a web application that generates printable SVG templates for footbag (hacky sack) panels with configurable parameters.

**Target Platform:** GitHub Pages (static hosting)
**Technology Stack:** Vanilla HTML, CSS, JavaScript (no build process required)
**Output Format:** SVG files suitable for printing and cutting fabric/leather panels

## Background & Domain Knowledge

### Footbag Construction Basics
- **Standard Footbag:** Typically uses 32 panels (most common professional standard)
- **Panel Types:** Combination of different polygon shapes depending on design
- **Materials:** Usually synthetic suede, leather, or fabric
- **Stitching:** Hand-stitched with running stitch, ~5mm from edges
- **Size:** Standard diameter 4.5-5.0cm, but varies from mini (4.0cm) to large (5.5cm)

### Common Footbag Geometries
Based on polyhedron structures:

1. **Soccer Ball Pattern (Truncated Icosahedron)**
   - 32 panels: 12 pentagons + 20 hexagons
   - Most common professional footbag design
   - Excellent roundness and balance

2. **Dodecahedron**
   - 12 panels: All pentagons
   - Good bag, limited color patterns

3. **Cubeoctahedron**
   - 14 panels: 6 squares + 8 triangles
   - Easy to sew, good beginner option

4. **Simple Designs**
   - 6-panel: 6 identical curved triangular sections
   - 8-panel: 8 triangular panels
   - 12-panel: Various triangle/square combinations

## Functional Requirements

### Core Features
1. **Panel Shape Selection**
   - Triangle (3-sided)
   - Square (4-sided) 
   - Pentagon (5-sided)
   - Hexagon (6-sided)

2. **Configurable Parameters**
   - Panel size (radius or diameter)
   - Number of stitching marks per side
   - Seam allowance width (typically 5-6mm)
   - Panel orientation

3. **Output Options**
   - Individual panel templates
   - Multiple panels on single sheet for efficient cutting
   - Print-optimized layout (Letter/A4 paper)
   - SVG download
   - PDF export (optional)

### Advanced Features (Future Iterations)
1. **Pre-configured Footbag Patterns**
   - 32-panel soccer ball pattern
   - 12-panel dodecahedron
   - 14-panel cubeoctahedron
   - Custom panel combinations

2. **Layout Optimization**
   - Automatic nesting of panels on cutting sheets
   - Minimal waste calculation
   - Grain line indicators for fabric

3. **Measurement Tools**
   - Seam allowance visualization
   - Finished size preview
   - Material usage calculator

## Technical Requirements

### Panel Geometry Specifications

#### Triangle (3-sided)
- **Shape:** Equilateral or isosceles triangle
- **Typical Use:** 6-panel or 8-panel simple footbags
- **Curve:** Slight outward curve on all sides for 3D assembly

#### Square (4-sided)
- **Shape:** Square with curved edges
- **Typical Use:** Cubeoctahedron designs (6 squares + 8 triangles)
- **Curve:** Moderate outward curve for spherical assembly

#### Pentagon (5-sided)
- **Shape:** Regular pentagon with curved edges
- **Typical Use:** Soccer ball pattern (12 pentagons + 20 hexagons)
- **Curve:** Calculated curve for truncated icosahedron geometry

#### Hexagon (6-sided)
- **Shape:** Regular hexagon with curved edges  
- **Typical Use:** Soccer ball pattern (12 pentagons + 20 hexagons)
- **Curve:** Calculated curve for truncated icosahedron geometry

### SVG Technical Specifications
- **Coordinate System:** Standard SVG coordinates (top-left origin)
- **Units:** Millimeters for precise cutting
- **Stroke Width:** 0.5mm for cutting lines, 0.25mm for stitch marks
- **Colors:**
  - Black (#000000): Cutting lines
  - Gray (#808080): Stitch marks

### Default Panel Dimensions
- **Small:** 25mm radius (50mm diameter)
- **Medium:** 30mm radius (60mm diameter) - Standard
- **Large:** 35mm radius (70mm diameter)
- **Custom:** User-defined radius (15-50mm range)

### Stitch Mark Specifications
- **Spacing:** Evenly distributed along each edge
- **Offset:** 5-6mm from edge (seam allowance)
- **Count Options:** 3, 5, 7, 9, 11 stitches per side
- **Mark Style:** Small cross (2mm) or dot (1mm diameter)

## User Interface Requirements

### Main Interface
```
[Header: Footbag Panel Generator]

Panel Configuration:
┌─────────────────────────────────┐
│ Shape: [Triangle▼] [Square] [Pentagon] [Hexagon]     │
│                                 │
│ Size: [●] Small [○] Medium [○] Large [○] Custom     │
│ Custom Size: [30] mm radius     │
│                                 │
│ Stitches per side: [5▼]         │
│ Seam allowance: [5] mm          │
│                                 │
│ [Generate Preview]              │
└─────────────────────────────────┘

Preview Panel:
┌─────────────────────────────────┐
│        [SVG Preview Here]       │
│                                 │
│ Dimensions: 60mm x 52mm         │
│ Stitches: 5 per side            │
└─────────────────────────────────┘

Layout Options:
┌─────────────────────────────────┐
│ Panels per sheet: [6▼]          │
│ Paper size: [Letter▼] [A4]      │
│ Orientation: [●] Portrait [○] Landscape │
│                                 │
│ [Download SVG] [Print Preview]  │
└─────────────────────────────────┘
```

### Responsive Design
- Mobile-friendly interface
- Touch-friendly controls
- Collapsible sections on small screens

## File Structure

```
footbag-generator/
├── index.html              # Main application page
├── css/
│   ├── styles.css         # Main stylesheet
│   └── print.css          # Print-specific styles
├── js/
│   ├── app.js             # Main application logic
│   ├── geometry.js        # Panel geometry calculations
│   ├── svg-generator.js   # SVG creation and manipulation
│   └── layout.js          # Multi-panel layout logic
├── assets/
│   ├── icons/             # UI icons
│   └── examples/          # Sample output files
└── README.md              # Usage instructions
```

## Development Phases

### Phase 1: Basic Functionality (MVP)
- Single panel generation (pentagon and hexagon)
- Basic parameter controls
- SVG download
- Simple responsive design

### Phase 2: Enhanced Features  
- All panel shapes (triangle, square, pentagon, hexagon)
- Multi-panel layouts
- Print optimization
- Better UI/UX

### Phase 3: Advanced Features
- Pre-configured footbag patterns
- Layout optimization algorithms
- Material usage calculations
- Advanced customization options

## Mathematical Specifications

### Curved Edge Calculation
For 3D assembly, panel edges need curvature. The curve amount depends on:
- Panel shape (number of sides)
- Target sphere radius
- Position in overall footbag geometry

**Formula for edge curve (simplified):**
```
curve_depth = panel_radius * sin(π / num_sides) * curvature_factor
```

Where `curvature_factor` varies by panel type:
- Triangle: 0.15-0.25
- Square: 0.20-0.30  
- Pentagon: 0.25-0.35
- Hexagon: 0.30-0.40

### Stitch Mark Positioning
```
for each edge:
  edge_length = calculate_curved_edge_length()
  stitch_spacing = (edge_length - 2 * corner_margin) / (num_stitches + 1)
  
  for i in range(num_stitches):
    position = corner_margin + (i + 1) * stitch_spacing
    mark_point = point_along_curved_edge(position)
```

## Success Criteria

### Minimum Viable Product (MVP)
- [ ] Generates accurate pentagon and hexagon SVG templates
- [ ] Configurable panel size and stitch count
- [ ] Clean, printable SVG output
- [ ] Responsive web interface
- [ ] Hosted successfully on GitHub Pages

### Full Success
- [ ] All panel shapes working correctly
- [ ] Multi-panel cutting layouts
- [ ] Pre-configured popular footbag patterns
- [ ] Print-optimized outputs
- [ ] Mobile-friendly interface
- [ ] Comprehensive documentation

## Testing Requirements

### Functional Testing
- Verify mathematical accuracy of panel geometries
- Test all parameter combinations
- Validate SVG output in multiple browsers
- Confirm print scaling accuracy

### Usability Testing
- Mobile device compatibility
- Print workflow testing
- User interface intuitiveness
- Performance on various browsers

## Success Criteria (Clean Build Goals)

### Phase 1 Success (Core MVP)
- [ ] Single panel generation works flawlessly for all 4 shapes
- [ ] Preview updates smoothly with debounced input (no lag/stuttering)
- [ ] Input validation prevents all invalid states
- [ ] Memory usage remains stable during extended use
- [ ] Clean, maintainable codebase with clear separation of concerns

### Phase 2 Success (Multi-Panel + Optimization)
- [ ] Multi-panel layouts render smoothly up to 50+ panels
- [ ] **Basic grid layout** works for all shapes (rows × columns)
- [ ] Slider controls provide immediate visual feedback
- [ ] Layout calculations are mathematically precise
- [ ] Grid spacing and alignment is pixel-perfect
- [ ] Performance remains excellent with complex layouts

### Phase 3 Success (Intelligent Nesting + Export)
- [ ] **Hexagon tessellation** implemented for maximum material efficiency
- [ ] **Waste calculation** shows material utilization percentage
- [ ] **Shape-specific nesting** optimized for each polygon type
- [ ] **Custom material sizes** (fabric width/length constraints)
- [ ] SVG exports are clean, scalable, and print-ready
- [ ] Export files work consistently across all browsers/devices
- [ ] **Dual export modes**: "Basic Grid" vs "Optimized Nesting"
- [ ] File naming includes efficiency metrics
- [ ] Overall user experience is professional and smooth

### Advanced Features Success (Future)
- [ ] **Intelligent tessellation**: Hexagon honeycomb and optimized nesting patterns
- [ ] **Batch processing**: Multiple footbag designs on single sheet
- [ ] **Cutting path optimization**: Minimize laser travel time
- [ ] **Material calculator**: Total material needed for complete footbag sets
- [ ] **Grain line indicators**: Fabric orientation guides
- [ ] **Custom sheet sizes**: Industry standard material dimensions
- [ ] **Finished size estimator**: Accurate diameter prediction from panel geometry
- [ ] **Size validation**: Warning if panels will create unusually large/small footbag
- [ ] **Multi-unit display**: Show diameter in mm, cm, and inches simultaneously
- [ ] **Configuration sharing**: Export/import settings between users
- [ ] **Material database**: Preset kerf and thickness values for common materials

### Technical Performance Benchmarks
- **Initial Load**: Under 200ms to interactive
- **Preview Updates**: Under 50ms for single panels, under 200ms for multi-panel
- **Memory Usage**: Stable baseline, no leaks during normal usage
- **Export Generation**: Under 1 second for layouts up to 100 panels
- **Browser Support**: Works perfectly in all modern browsers (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)

### Export Validation Requirements
- [ ] **SVG 1.0 Compliance**: Files validate against SVG 1.0 DTD
- [ ] **LaserWeb Compatible**: Import without errors or warnings
- [ ] **LightBurn Compatible**: Layers automatically recognized by color
- [ ] **Scaling Accuracy**: Physical measurements match digital measurements
- [ ] **Path Continuity**: All cutting paths are properly closed
- [ ] **No Overlapping**: Stitch holes don't interfere with cutting lines
- [ ] **File Size Optimization**: Minimal file size while maintaining precision

### Manufacturing Workflow Testing
- [ ] **Print Test**: Rulers and measurements are accurate on paper
- [ ] **Laser Test**: Red lines cut cleanly, blue circles mark precisely  
- [ ] **Software Import**: No errors when importing into LaserWeb/LightBurn
- [ ] **Multi-Panel Efficiency**: Layouts minimize material waste
- [ ] **Precision Validation**: Cut panels assemble into proper footbag geometry

---

**Development Approach**: Build each phase completely and test thoroughly before moving to the next. Focus on getting the fundamentals rock-solid rather than rushing to add features.