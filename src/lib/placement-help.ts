import { latticePlacements, type Lattice } from './lattice';

/** Use the same placement rules as the editable layout for the help illustrations. */
export function initializePlacementHelp(): void {
  const help = document.getElementById('placementPatternHelp');
  const icon = document.querySelector<HTMLElement>('[aria-describedby="placementPatternHelp"]');
  if (!help || !icon) return;
  const descriptions = [
    ['Aligned', 'Centers line up in rows and columns.'],
    ['Alternating rows', 'Centers stay aligned. Every other row can turn 180°.'],
    ['Staggered rows', 'Every other row shifts right by half the horizontal center spacing.'],
    ['Alternating columns', 'Centers stay aligned. Every other column can turn 180°.'],
    ['Staggered columns', 'Every other column shifts down by half the vertical center spacing.'],
  ];
  const ns = 'http://www.w3.org/2000/svg';
  descriptions.forEach(([name, description], pattern) => {
    const row = document.createElement('div');
    row.className = 'placement-example';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 80');
    svg.setAttribute('aria-hidden', 'true');
    for (const { x, y, angle } of latticePlacements(
      {
        columns: 3,
        pitchX: 28,
        pitchY: 24,
        pattern: pattern as Lattice['pattern'],
        angle: 0,
        rotateAlternates: true,
      },
      9,
    )) {
      const panel = document.createElementNS(ns, 'path');
      panel.setAttribute('d', 'M 0,-8 L 8,-2 L 5,7 L -5,7 L -8,-2 Z M 0,-5 V 0');
      panel.setAttribute('transform', `translate(${12 + x} ${10 + y}) rotate(${angle})`);
      svg.append(panel);
    }
    const text = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = name;
    const detail = document.createElement('span');
    detail.textContent = description;
    text.append(title, detail);
    row.append(svg, text);
    help.append(row);
  });
  const note = document.createElement('div');
  note.className = 'placement-help-note';
  note.textContent =
    'Examples show alternate rotation on. In Advanced parameters, “Rotate alternate rows/columns 180°” controls the flips for all alternating and staggered patterns. Turn it off to keep every panel at the base rotation. Staggering still shifts centers; panel shapes stay unchanged.';
  help.append(note);

  // The illustrated guide is larger than ordinary tips; keep it within the viewport.
  const position = () => {
    const anchor = icon.getBoundingClientRect();
    const box = help.getBoundingClientRect();
    help.style.left = `${Math.max(8, Math.min(anchor.left - 8, window.innerWidth - box.width - 8))}px`;
    const below = anchor.bottom + 8;
    help.style.top = `${Math.max(8, below + box.height <= window.innerHeight - 8 ? below : anchor.top - box.height - 8)}px`;
  };
  icon.addEventListener('focus', position);
  icon.addEventListener('mouseenter', position);
  icon.addEventListener('click', position);
  const repositionIfOpen = () => {
    if (
      icon.parentElement?.classList.contains('tooltip-active') ||
      document.activeElement === icon ||
      icon.matches(':hover')
    )
      position();
  };
  window.addEventListener('resize', repositionIfOpen);
  window.addEventListener('scroll', repositionIfOpen, true);
}
