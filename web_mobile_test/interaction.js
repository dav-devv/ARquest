(function (root) {
  const contains = (r, x, y, padding = 0) => x >= r.x - padding && x <= r.x + r.width + padding && y >= r.y - padding && y <= r.y + r.height + padding;
  function dockButtons(p) {
    const start = p.x + p.width * 0.32;
    const spacing = p.width * 0.64 / 6;
    return Array.from({ length: 6 }, (_, index) => ({
      x: start + (index + 0.5) * spacing - Math.min(16, spacing * 0.42),
      y: p.y + p.height / 2 - Math.min(16, p.height * 0.4),
      width: Math.min(32, spacing * 0.84), height: Math.min(32, p.height * 0.8)
    }));
  }
  function controls(x, y, width) {
    const w = Math.min(width, 300);
    const pill = { x: x + (width - w) / 2, y, width: w, height: 40 };
    return { pill, buttons: ['minimize', 'resize', 'close'].map((action, index) => ({
      action, x: pill.x + w - (3 - index) * 36, y: y + 2, width: 34, height: 36
    })) };
  }
  function appTiles(p, count = 9) {
    const padding = Math.min(14, p.width * 0.04, p.height * 0.05);
    const header = Math.min(42, p.height * 0.2);
    const gap = Math.min(10, p.width * 0.025, p.height * 0.035);
    const columns = 3;
    const rows = Math.max(1, Math.ceil(count / columns));
    const width = (p.width - padding * 2 - gap * (columns - 1)) / columns;
    const height = (p.height - header - padding * 2 - gap * (rows - 1)) / rows;
    return Array.from({ length: count }, (_, i) => ({
      x: p.x + padding + (i % columns) * (width + gap),
      y: p.y + header + padding + Math.floor(i / columns) * (height + gap), width, height
    }));
  }
  function gestureIntent(elapsed, movement, released, organize) {
    if (released) return elapsed < 600 && movement < 12 && !organize ? 'click' : 'cancel';
    return (organize || elapsed >= 220) && movement >= 12 ? 'drag' : 'pending';
  }
  const api = { contains, dockButtons, controls, appTiles, gestureIntent };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MRInteraction = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
