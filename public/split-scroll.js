(function () {
  const scene = document.querySelector("[data-split-scene]");
  const header = document.querySelector("[data-site-header]");
  if (!scene) return;

  const tiles = Array.from(scene.querySelectorAll(".collage .tile"));
  const content = scene.querySelector(".hero-content");

  const final = [
    { x: -26, y: -34, size: 90 },
    { x:   0, y: -38, size: 100 },
    { x:  26, y: -34, size: 80 },
    { x: -36, y:   4, size: 150 },
    { x:  36, y:   6, size: 140 },
    { x: -10, y:  34, size: 85 },
    { x:  34, y:  36, size: 95 },
    { x:  20, y:  22, size: 1 },
  ];

  const start = { x: 0, y: 0, size: 190 };

  const splitEnd = 1.0;
  const contentStart = 0.35;
  const contentEnd = 0.75;

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
    if (header) header.classList.toggle("is-hidden", progress > 0.02);

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

      tile.style.opacity = i === 0 ? "1" : String(clamp01((splitT - 0.04) / 0.10));
    });

    if (content) {
      const contentT = clamp01((progress - contentStart) / (contentEnd - contentStart));
      content.style.opacity = String(contentT);
      content.style.transform = `translateY(${lerp(10, 0, easeOutCubic(contentT))}px)`;
    }
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      apply(getProgress());
    });
  }

  apply(0);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
})();
