(function () {
  const scene = document.querySelector("[data-split-scene]");
  const header = document.querySelector("[data-site-header]");
  if (!scene) return;

  const tiles = Array.from(scene.querySelectorAll(".collage .tile"));
  const content = scene.querySelector(".hero-content");
  const overlayTile = scene.querySelector(".tile--bottomOverlay");

  // Final positions spread TOP + LEFT + RIGHT + BOTTOM (not only sides/bottom)
  // size in px; still 1:1 due to aspect-ratio
  const final = [
    { x: -46, y: -26, size: 64,  r: 0 },  // 1 top-left corner
    { x:  46, y: -26, size: 64,  r: 0 },  // 2 top-right corner
    { x: -40, y:  -6, size: 160, r: 0 },  // 3 left-upper
    { x:  40, y:  -6, size: 160, r: 0 },  // 4 right-upper
    { x: -30, y:  16, size: 92,  r: 0 },  // 5 mid-left small
    { x:  30, y:  16, size: 92,  r: 0 },  // 6 mid-right small
    { x: -44, y:  42, size: 240, r: 0 },  // 7 bottom-left big
    { x:  12, y:  44, size: 180, r: 0 },  // 8 bottom-mid big
  ];

  // Initial: one centered tile visible; others stacked/hide
  const start = { x: 0, y: 0, size: 220, r: 0 };

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
    // Hide header as soon as scrolling starts
    if (header) header.classList.toggle("is-hidden", progress > 0.02);

    // split completes fast: first 55% of scene scroll
    const splitT = clamp01(progress / 0.55);
    const t = easeOutCubic(splitT);

    tiles.forEach((tile, i) => {
      const f = final[i] || final[final.length - 1];

      const x = lerp(start.x, f.x, t);
      const y = lerp(start.y, f.y, t);
      const size = lerp(start.size, f.size, t);
      const r = lerp(start.r, f.r, t);

      tile.style.width = `${size}px`;
      tile.style.transform =
        `translate(calc(50vw + ${x}vw), calc(50vh + ${y}vh)) translate(-50%, -50%) rotate(${r}deg)`;

      // show center immediately, others fade in quickly
      if (i === 0) {
        tile.style.opacity = "1";
      } else {
        const fade = clamp01((splitT - 0.06) / 0.16);
        tile.style.opacity = String(fade);
      }
    });

    // Content reveal centered: starts early and finishes by mid scroll
    const contentT = clamp01((progress - 0.12) / 0.24);
    content.style.opacity = String(contentT);
    content.style.transform = `translateY(${lerp(14, 0, easeOutCubic(contentT))}px)`;

    // Bottom overlay: appears near the end and sits into next section
    if (overlayTile) {
      const o = clamp01((progress - 0.58) / 0.18);
      overlayTile.style.opacity = String(o);

      // position overlay tile (center-ish like ref)
      const size = lerp(220, 260, easeOutCubic(o));
      overlayTile.style.width = `${size}px`;
      overlayTile.style.transform = `translateX(-50%) translateY(${lerp(30, 0, easeOutCubic(o))}px)`;
    }
  }

  function onScroll() {
    apply(getProgress());
  }

  apply(0);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
})();
