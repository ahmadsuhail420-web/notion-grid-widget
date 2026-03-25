(function () {
  const scene = document.querySelector("[data-split-scene]");
  const header = document.querySelector("[data-site-header]");
  if (!scene) return;

  const tiles = Array.from(scene.querySelectorAll(".collage .tile"));
  const content = scene.querySelector(".hero-content");

  // Final positions/sizes tuned to your Image 7 (smaller, spaced around content).
  const final = [
    { x: -26, y: -34, size: 120 }, // top-left
    { x:   0, y: -38, size: 130 }, // top-center
    { x:  26, y: -34, size: 120 }, // top-right
    { x: -36, y:   4, size: 220 }, // left big
    { x:  36, y:   6, size: 200 }, // right big
    { x: -10, y:  34, size: 120 }, // bottom-mid-left
    { x:  34, y:  36, size: 125 }, // bottom-right
    { x:  20, y:  22, size: 1 },   // unused (keeps 8 tiles safe)
  ];

  // Initial: stacked in the center
  const start = { x: 0, y: 0, size: 240 };

  // Fast interaction: feels like ~3 wheel scroll steps on a typical mouse.
  const splitEnd = 0.22;
  const contentStart = 0.18;
  const contentEnd = 0.28;

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
    return clamp01((-rect.top) / total);
  }

  function apply(progress) {
    // Hide header as soon as scroll starts
    if (header) header.classList.toggle("is-hidden", progress > 0.02);

    // Split phase
    const splitT = clamp01(progress / splitEnd);
    const t = easeOutCubic(splitT);

    tiles.forEach((tile, i) => {
      const f = final[i] || final[final.length - 1];

      if (f.size <= 2) {
        tile.style.opacity = "0";
        return;
      }

      const x = lerp(start.x, f.x, t);
      const y = lerp(start.y, f.y, t);
      const size = lerp(start.size, f.size, t);

      tile.style.width = `${size}px`;
      tile.style.transform =
        `translate(calc(50vw + ${x}vw), calc(50vh + ${y}vh)) translate(-50%, -50%)`;

      // Center visible, others fade in quickly
      tile.style.opacity = i === 0 ? "1" : String(clamp01((splitT - 0.04) / 0.10));
    });

    // Content reveal after split is basically done
    const contentT = clamp01((progress - contentStart) / (contentEnd - contentStart));
    content.style.opacity = String(contentT);
    content.style.transform = `translateY(${lerp(10, 0, easeOutCubic(contentT))}px)`;
  }

  function onScroll() {
    apply(getProgress());
  }

  apply(0);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
})();
