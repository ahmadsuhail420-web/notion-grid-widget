(function () {
  const scene = document.querySelector("[data-split-scene]");
  const header = document.querySelector("[data-site-header]");
  if (!scene) return;

  const tiles = Array.from(scene.querySelectorAll(".collage .tile"));
  const content = scene.querySelector(".hero-content");
  const cross = scene.querySelector(".cross-tile, .overlay-tile");

  // Layout closer to image 7: tiles spread all around (top band + mid sides + bottom)
  const final = [
    { x: -26, y: -30, size: 150 }, // top-left (glass)
    { x:   0, y: -34, size: 160 }, // top-center (shoes)
    { x:  26, y: -30, size: 150 }, // top-right (ring)
    { x: -34, y:   8, size: 240 }, // left big (shoes w/ tag)
    { x:  34, y:  10, size: 220 }, // right big (book)
    { x: -12, y:  36, size: 140 }, // bottom-mid-left (calla)
    { x:  30, y:  38, size: 160 }, // bottom-right (flower)
    { x:   0, y:  16, size: 1 },   // placeholder if you keep 8 tiles; ignored visually
  ];

  const start = { x: 0, y: 0, size: 240 };

  // ✅ Make split + content appear quickly (about 3 wheel scrolls)
  const splitEnd = 0.22;        // split finishes very early
  const contentStart = 0.18;    // content starts right after split begins
  const contentEnd = 0.28;      // content fully visible quickly

  const crossStart = 0.62;
  const crossEnd = 0.74;

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
    // Header hides immediately
    if (header) header.classList.toggle("is-hidden", progress > 0.02);

    // Split quick
    const splitT = clamp01(progress / splitEnd);
    const t = easeOutCubic(splitT);

    tiles.forEach((tile, i) => {
      const f = final[i] || final[final.length - 1];

      // If a tile is not used (size 1), hide it
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

      // first tile visible at start, others fade in almost instantly
      tile.style.opacity = i === 0 ? "1" : String(clamp01((splitT - 0.04) / 0.10));
    });

    // Content appears after split is basically done
    const contentT = clamp01((progress - contentStart) / (contentEnd - contentStart));
    content.style.opacity = String(contentT);
    content.style.transform = `translateY(${lerp(10, 0, easeOutCubic(contentT))}px)`;

    // Optional crossing tile (if present)
    if (cross) {
      const ct = clamp01((progress - crossStart) / (crossEnd - crossStart));
      cross.style.opacity = String(ct);
    }
  }

  function onScroll() {
    apply(getProgress());
  }

  apply(0);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
})();
