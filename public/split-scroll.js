(function () {
  const scene = document.querySelector("[data-split-scene]");
  if (!scene) return;

  const tiles = Array.from(scene.querySelectorAll(".tile"));
  const content = scene.querySelector(".hero-content");

  // Final collage positions + sizes (all remain 1:1 due to aspect-ratio).
  // x/y are vw/vh offsets from viewport center.
  const final = [
    { x: -46, y: -16, size: 70,  r: 0 }, // 1 small corner
    { x:  46, y: -16, size: 70,  r: 0 }, // 2 small corner
    { x: -44, y:   9, size: 150, r: 0 }, // 3 left-mid bigger
    { x:  44, y:   9, size: 150, r: 0 }, // 4 right-mid bigger
    { x: -28, y:  27, size: 82,  r: 0 }, // 5 small
    { x:  28, y:  27, size: 82,  r: 0 }, // 6 small
    { x: -44, y:  40, size: 240, r: 0 }, // 7 big bottom-left
    { x:  10, y:  42, size: 180, r: 0 }, // 8 big bottom-mid
  ];

  // Initial state: one center 1:1 tile, others stacked and hidden
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
    // split should complete faster (first ~55% of scroll)
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

      // opacity: center tile visible immediately; others fade in quickly
      if (i === 0) {
        tile.style.opacity = "1";
      } else {
        const fade = clamp01((splitT - 0.06) / 0.18);
        tile.style.opacity = String(fade);
      }
    });

    // content reveal begins shortly after split starts
    const contentT = clamp01((progress - 0.18) / 0.25);
    content.style.opacity = String(contentT);
    content.style.transform = `translateY(${lerp(14, 0, easeOutCubic(contentT))}px)`;
  }

  function onScroll() {
    apply(getProgress());
  }

  // init
  apply(0);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
})();
