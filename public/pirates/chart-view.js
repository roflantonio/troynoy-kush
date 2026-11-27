const bound = (value, min, max) => Math.max(min, Math.min(max, value));

export function chartView(viewport, canvas, draw, zoomIn, zoomOut) {
  const pointers = new Map();
  let width = 0, height = 0;
  let zoom = 1, left = 0, top = 0;
  let player;

  const minZoom = () => Math.min(.85, width / canvas.width, height / canvas.height);
  const maxZoom = 3.5;
  const limit = (position, frame, paper) => {
    const margin = frame * .28;
    return bound(position, Math.min(0, frame - paper) - margin, Math.max(0, frame - paper) + margin);
  };

  function paint() {
    if (!width || !height) return;
    left = limit(left, width, canvas.width * zoom);
    top = limit(top, height, canvas.height * zoom);
    canvas.style.transform = "translate3d(" + left + "px," + top + "px,0) scale(" + zoom + ")";
    zoomIn.disabled = zoom >= maxZoom - .0001;
    zoomOut.disabled = zoom <= minZoom() + .0001;
  }

  function zoomAt(value, x = width / 2, y = height / 2) {
    const next = bound(value, minZoom(), maxZoom);
    const ratio = next / zoom;
    left = x - (x - left) * ratio;
    top = y - (y - top) * ratio;
    zoom = next;
  }

  function measure() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if (!w || !h) return;
    const cx = (width / 2 - left) / zoom;
    const cy = (height / 2 - top) / zoom;
    width = w;
    height = h;
    zoom = bound(zoom, minZoom(), maxZoom);
    left = w / 2 - cx * zoom;
    top = h / 2 - cy * zoom;
    paint();
  }
  new ResizeObserver(measure).observe(viewport);

  function focusPlayer() {
    if (!player) return;
    zoom = bound(height / canvas.height * .92, minZoom(), 1.65);
    left = width / 2 - player.x * zoom;
    top = height / 2 - player.y * zoom;
    paint();
  }

  function open(world, keepPosition) {
    if (!keepPosition || !player) {
      player = draw(canvas, world);
      measure();
      focusPlayer();
    } else measure();
  }

  const locate = event => {
    const rect = viewport.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  function pinch() {
    const [a, b] = pointers.values();
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, span: Math.max(8, Math.hypot(a.x - b.x, a.y - b.y)) };
  }

  viewport.addEventListener("pointerdown", event => {
    if (event.button !== 0 || pointers.size >= 2) return;
    viewport.focus({ preventScroll: true });
    pointers.set(event.pointerId, locate(event));
    viewport.setPointerCapture(event.pointerId);
    viewport.setAttribute("data-grabbing", "");
    event.preventDefault();
  });

  viewport.addEventListener("pointermove", event => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const before = pointers.size === 2 ? pinch() : previous;
    const point = locate(event);
    pointers.set(event.pointerId, point);
    const after = pointers.size === 2 ? pinch() : point;
    if (before.span) zoomAt(zoom * after.span / before.span, before.x, before.y);
    left += after.x - before.x;
    top += after.y - before.y;
    paint();
  });

  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    viewport.addEventListener(type, event => {
      if (pointers.delete(event.pointerId) && !pointers.size) viewport.removeAttribute("data-grabbing");
    });
  }

  function cancel() {
    const ids = [...pointers.keys()];
    pointers.clear();
    for (const id of ids) if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id);
    viewport.removeAttribute("data-grabbing");
  }

  viewport.addEventListener("wheel", event => {
    event.preventDefault();
    const { x, y } = locate(event);
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    zoomAt(zoom * Math.exp(-event.deltaY * units * .002), x, y);
    paint();
  }, { passive: false });

  const zoomBy = factor => {
    zoomAt(zoom * factor);
    paint();
  };
  zoomIn.addEventListener("click", () => zoomBy(1.28));
  zoomOut.addEventListener("click", () => zoomBy(1 / 1.28));

  viewport.addEventListener("keydown", event => {
    const pan = { ArrowLeft: [32, 0], ArrowRight: [-32, 0], ArrowUp: [0, 32], ArrowDown: [0, -32] }[event.key];
    if (pan) {
      left += pan[0];
      top += pan[1];
      paint();
    } else if (event.key === "+" || event.key === "=") zoomBy(1.28);
    else if (event.key === "-") zoomBy(1 / 1.28);
    else return;
    event.preventDefault();
  });
  return { open, cancel };
}
