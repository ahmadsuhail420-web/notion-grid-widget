(function () {
  const scene = document.querySelector("[data-split-scene]");
  const header = document.querySelector("[data-site-header]");
  if (!scene) return;

  const tiles = Array.from(scene.querySelectorAll(".collage .tile"));
  const content = scene.querySelector(".hero-content");
  const overlay = scene.querySelector(".overlay-tile");

  // Spread into top + sides + bottom with different sizes (1:1 always).
  const final = [
    { x: -46, y: -26, size: 64,  r: 0 },  // top-left tiny
    { x:  46, y: -26, size: 64,  r: 0 },  // top-right tiny
    { x: -40, y:  -6, size: 160, r: 0 },  // left upper
    { x:  40, y:  -6, size: 160, r: 0 },  // right upper
    { x: -30, y:  16, size: 92,  r: 0 },  // mid-left
    { x:  30, y:  16, size: 92,  r: 0 },  // mid-right
    { x: -44, y:  42, size: 240, r: 0 },  // bottom-left big
    { x:  12, y:  44, size: 180, r: 0 },  // bottom-mid
  ];

  // Initial: one centered tile visible
  const start = { x: 0, y: 0, size: 230, r: 0 };

  // Split completes early, then we hold.
  const splitEnd = 0.35;   // ✅ fast split
  const contentStart = 0.24;
  const contentEnd = 0.40; // content fully visible after split is basically done

  function clamp01(n) {
    return Math.min(1, Math.max(0, n));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function getProgress() {
    const rect = scene.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) return 1;
    const scrolled = -rect.top;
    return clamp01(scrolled / total);
  }

  function apply(progress) {
    // header hides immediately on scroll
    if (header) header.classList.toggle("is-hidden", progress > 0.02);

    // Split phase
    const splitT = clamp01(progress / splitEnd);
    const t = easeOutCubic(splitT);

    tiles.forEach((tile, i) => {
      const f = final[i] || final[final.length - 1];

      const x = lerp(start.x, f.x, t);
      const y = lerp(start.y, f.y, t);
      const size = lerp(start.size, f.size, t);

      tile.style.width = `${size}px`;
      tile.style.transform =
        `translate(calc(50vw + ${x}vw), calc(50vh + ${y}vh)) translate(-50%, -50%)`;

      // only tile 0 visible at top; others fade in during split
      if (i === 0) tile.style.opacity = "1";
      else tile.style.opacity = String(clamp01((splitT - 0.08) / 0.18));
    });

    // Content reveal AFTER split completes (your requirement)
    const contentT = clamp01((progress - contentStart) / (contentEnd - contentStart));
    content.style.opacity = String(contentT);
    content.style.transform = `translateY(${lerp(14, 0, easeOutCubic(contentT))}px)`;

    // Overlay tile appears near end of scene so it overlaps into second section
    if (overlay) {
      const o = clamp01((progress - 0.70) / 0.15);
      overlay.style.opacity = String(o);
      overlay.style.transform = `translate(-50%, ${lerp(18, 0, easeOutCubic(o))}px)`;
    }
  }

  function onScroll() {
    apply(getProgress());
  }

  apply(0);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
})();
