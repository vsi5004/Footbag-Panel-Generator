/**
 * Lightweight tooltip system for form controls
 * Supports both hover (desktop) and click/tap (mobile) interactions
 */

export function initializeTooltips(): void {
  const tooltipContainers = document.querySelectorAll('.tooltip-container');
  
  tooltipContainers.forEach(container => {
    const icon = container.querySelector('.tooltip-icon');
    if (!icon) return;
    
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Close other open tooltips
      tooltipContainers.forEach(other => {
        if (other !== container) {
          other.classList.remove('tooltip-active');
        }
      });
      
      // Toggle this tooltip
      container.classList.toggle('tooltip-active');
    });
  });
  
  // Close tooltips when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as Element;
    if (!target.closest('.tooltip-container')) {
      tooltipContainers.forEach(container => {
        container.classList.remove('tooltip-active');
      });
    }
  });
}

// For backward compatibility with global window.FB
window.FB = window.FB || {};
(window.FB as any).tooltips = { initializeTooltips };
