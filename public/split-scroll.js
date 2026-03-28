(function () {
  const scene = document.querySelector("[data-split-scene]");
  const header = document.querySelector("[data-site-header]");
  if (!scene) return;

  const stage = scene.querySelector(".stage"); // IMPORTANT
  const tiles = Array.from(scene.querySelectorAll(".collage .tile"));
  const content = scene.querySelector(".hero-content");
  if (!stage || tiles.length === 0) return;

  // Layout is now in STAGE-PERCENT units (px derived each frame)
  // x/y are offsets from center, expressed as % of stage width/height
  const layoutDesktop = [
    { x: -44, y: -32, size: 105 }, // top-left
    { x: -16, y: -46, size: 80  }, // top-mid-left
    { x:  16, y: -46, size: 80  }, // top-mid-right
    { x:  44, y: -32, size: 120 }, // top-right
    { x: -46, y:  10, size: 150 }, // mid-left
    { x:  46, y:   8, size: 150 }, // mid-right
    { x: -18, y:  42, size: 110 }, // bottom-mid-left
    { x:  44, y:  44, size: 120 }, // bottom-right
  ];

  const layoutMobile = [
    { x: -40, y: -30, size: 86  },
    { x: -14, y: -46, size: 62  },
    { x:  14, y: -46, size: 62  },
    { x:  40, y: -30, size: 92  },
    { x: -40, y:  10, size: 110 },
    { x:  40, y:   8, size: 110 },
    { x: -12, y:  42, size: 82  },
    { x:  40, y:  44, size: 92  },
  ];

  function getLayout() {
    return window.innerWidth < 520 ? layoutMobile : layoutDesktop;
  }

  // Start = single centered image
  const startSize = 260;

  // Progress timing
  const splitEnd = 1.0;

  const contentStart = 0.10;
  const contentEnd = 0.34;

  const tilesInStart = 0.10;
  const tilesInEnd = 0.30;

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

    const layout = getLayout();
    const splitT = clamp01(progress / splitEnd);
    const t = easeOutCubic(splitT);

    const tilesInT = easeOutCubic(
      clamp01((progress - tilesInStart) / (tilesInEnd - tilesInStart))
    );

    // Stage geometry (center point)
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const cx = sw / 2;
    const cy = sh / 2;

    tiles.forEach((tile, i) => {
      const f = layout[i] || layout[layout.length - 1];

      // Convert stage-% offsets to px offsets
      const fx = (f.x / 100) * sw;
      const fy = (f.y / 100) * sh;

      // Start at exact center (0,0 offset)
      const x = lerp(0, fx, t);
      const y = lerp(0, fy, t);
      const size = lerp(startSize, f.size, t);

      tile.style.width = `${size}px`;

      // Absolute positioning inside .stage
      tile.style.left = `${cx + x}px`;
      tile.style.top = `${cy + y}px`;
      tile.style.transform = "translate(-50%, -50%)";

      // Visibility behavior
      if (i === 0) {
        tile.style.opacity = "1"; // only one visible at start
      } else {
        tile.style.opacity = String(tilesInT);
      }
    });

    if (content) {
      const contentT = easeOutCubic(
        clamp01((progress - contentStart) / (contentEnd - contentStart))
      );
      content.style.opacity = String(contentT);
      content.style.transform = `translateY(${lerp(10, 0, contentT)}px)`;
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

  // Ensure centered state is correct immediately (even before any scroll)
  apply(0);

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
})();
