(function () {
  const scene = document.querySelector("[data-split-scene]");
  const header = document.querySelector("[data-site-header]");
  if (!scene) return;

  const tiles = Array.from(scene.querySelectorAll(".collage .tile"));
  const content = scene.querySelector(".hero-content");

 const final = [
    { x: -41, y: -30, size: 105 }, // 1) top-left small
    { x: -14, y: -44, size: 80  }, // 2) top-mid-left tiny (near top)
    { x:  16, y: -44, size: 80  }, // 3) top-mid-right tiny (near top)
    { x:  41, y: -30, size: 120 }, // 4) top-right medium

    { x: -42, y:  12, size: 150 }, // 5) mid-left medium (left of text block)
    { x:  42, y:   8, size: 150 }, // 6) mid-right medium (right of paragraph)

    { x: -18, y:  40, size: 110 }, // 7) bottom-mid-left small
    { x:  41, y:  42, size: 120 }, // 8) bottom-right small
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
  `translate(calc(50% + ${x}vw), calc(50% + ${y}vh)) translate(-50%, -50%)`;

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
