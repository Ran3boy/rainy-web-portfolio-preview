// Selection and panel size are native/CSS. Moving keyboard focus should never reposition the page.
(() => {
  const group = document.querySelector("[data-services] .sd-list");
  if (!group) return;
  const choices = [...group.querySelectorAll('input[type="radio"]')];
  const rack = group.closest("[data-services]").querySelector(".sd-tool-rack");
  if (rack && "IntersectionObserver" in window && matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) {
    rack.dataset.waiting = "";
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio < .72) return;
      observer.disconnect();
      delete rack.dataset.waiting;
    }, { threshold: .72 });
    observer.observe(rack);
    group.addEventListener("change", () => {
      observer.disconnect();
      delete rack.dataset.waiting;
    }, { once: true });
  }

  // The map pieces lean towards a nearby fine pointer. Move their printed
  // faces only; flight geometry and the selector's native targets stay fixed.
  const media = group.closest("[data-services]").querySelector(".sd-panels");
  const section = group.closest("#services");
  const maps = group.querySelector('[value="maps"]');
  const mapPieces = [...media.querySelectorAll('[data-tools="maps"] .sd-object')];
  const canLean = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  let pointer, frame = 0;
  function clearLean() {
    cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
    for (const piece of mapPieces) {
      piece.style.removeProperty("--lean-x");
      piece.style.removeProperty("--lean-y");
    }
  }
  function paintLean() {
    frame = 0;
    const boxes = mapPieces.map(piece => piece.parentElement.getBoundingClientRect());
    mapPieces.forEach((piece, i) => {
      const box = boxes[i];
      const dx = pointer.x - (box.x + box.width / 2), dy = pointer.y - (box.y + box.height / 2);
      const distance = Math.hypot(dx, dy);
      const weight = Math.max(0, 1 - distance / 125) * 0.12;
      piece.style.setProperty("--lean-x", (dx * weight).toFixed(1) + "px");
      piece.style.setProperty("--lean-y", (dy * weight).toFixed(1) + "px");
    });
  }
  section.addEventListener("pointermove", event => {
    if (!canLean.matches || !maps.checked || event.pointerType !== "mouse") return;
    pointer = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(paintLean);
  }, { passive: true });
  section.addEventListener("pointerleave", clearLean);
  group.addEventListener("change", clearLean);
  canLean.addEventListener("change", clearLean);

  group.addEventListener("keydown", (event) => {
    const index = choices.indexOf(event.target);
    if (index < 0 || event.altKey || event.ctrlKey || event.metaKey) return;

    let next;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp": next = (index + choices.length - 1) % choices.length; break;
      case "ArrowRight":
      case "ArrowDown": next = (index + 1) % choices.length; break;
      case "Home": next = 0; break;
      case "End": next = choices.length - 1; break;
      case "Enter": next = index; break;
      default: return;
    }
    event.preventDefault();
    choices[next].focus({ preventScroll: true });
    choices[next].click();
  });
})();
