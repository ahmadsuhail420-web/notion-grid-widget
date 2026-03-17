(function () {
  const scene = document.querySelector("[data-split-scene]");
  if (!scene) return;

  const sticky = scene.querySelector(".split-sticky");
  const tiles = Array.from(scene.querySelectorAll(".tile"));
  const content = scene.querySelector(".hero-content");

  // Configure final collage positions (percent of viewport)
  // These are tuned to resemble image 5.
  // x,y are in vw/vh units relative to viewport center.
  const final = [
    { x: -44, y: -18, s: 0.95, r: 0 }, // 1 top-left small
    { x:  46, y: -18, s: 0.95, r: 0 }, // 2 top-right small
    { x: -40, y:   6, s: 1.10, r: 0 }, // 3 left-mid
    { x:  40, y:   6, s: 1.10, r: 0 }, // 4 right-mid
    { x: -26, y:  25, s: 0.95, r: 0 }, // 5 bottom-left small
    { x:  26, y:  25, s: 0.95, r: 0 }, // 6 bottom-right small
    { x: -42, y:  34, s: 1.55, r: 0 }, // 7 big bottom-left (projects)
    { x:  10, y:  38, s: 1.15, r: 0 }, // 8 bottom-mid (projects image)
  ];

  // Initial stacked state: all tiles centered 1:1
  // One tile is visible, others hidden until scroll begins.
  const center = { x: 0, y: 0, s: 1.35, r: 0 };

  function clamp01(n) {
    return Math.min(1, Math.max(0, n));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function apply(progress) {
    const t = easeInOut(progress);

    tiles.forEach((tile, i) => {
      const f = final[i] || final[final.length - 1];

      // tiles split outward as you scroll
      const x = lerp(center.x, f.x, t);
      const y = lerp(center.y, f.y, t);
      const s = lerp(center.s, f.s, t);
      const r = lerp(center.r, f.r, t);

      tile.style.transform = `translate(calc(50vw + ${x}vw), calc(50vh + ${y}vh)) translate(-50%, -50%) scale(${s}) rotate(${r}deg)`;

      // only first tile visible at very start; others fade in quickly
      const fadeStart = i === 0 ? 0 : 0.05;
      const fade = clamp01((progress - fadeStart) / 0.15);
      tile.style.opacity = String(i === 0 ? 1 : fade);
    });

    // content reveal: starts after split begins
    const contentT = clamp01((progress - 0.18) / 0.28);
    content.style.opacity = String(contentT);
    content.style.transform = `translateY(${lerp(14, 0, easeInOut(contentT))}px)`;
  }

  function getProgress() {
    const rect = scene.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) return 1;
    const scrolled = -rect.top;
    return clamp01(scrolled / total);
  }

  function onScroll() {
    apply(getProgress());
  }

  // Initial paint
  apply(0);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
})();
