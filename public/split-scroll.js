(function () {
  const scene = document.querySelector("[data-split-scene]");
  const header = document.querySelector("[data-site-header]");
  if (!scene) return;

  const stage = scene.querySelector(".stage");
  const tiles = Array.from(scene.querySelectorAll(".collage .tile"));
  const content = scene.querySelector(".hero-content");
  if (!stage || tiles.length === 0) return;

  // Spread around hero after split
  const layoutDesktop = [
    { x: -44, y: -32, size: 110 },
    { x: -16, y: -50, size: 90  },
    { x:  16, y: -50, size: 90  },
    { x:  44, y: -32, size: 140 },

    { x: -46, y:  10, size: 190 },
    { x:  46, y:  10, size: 165 },

    { x: -18, y:  46, size: 115 },
    { x:  44, y:  48, size: 130 },
  ];

  const layoutMobile = [
    { x: -40, y: -30, size: 86  },
    { x: -14, y: -48, size: 62  },
    { x:  14, y: -48, size: 62  },
    { x:  40, y: -30, size: 92  },

    { x: -40, y:  10, size: 120 },
    { x:  40, y:  10, size: 110 },

    { x: -12, y:  46, size: 82  },
    { x:  40, y:  48, size: 92  },
  ];

  function getLayout() {
    return window.innerWidth < 520 ? layoutMobile : layoutDesktop;
  }

  const startSize = 260;

  // Smoothness tuning
  const splitEnd = 1.0;
  const tilesInStart = 0.10;
  const tilesInEnd = 0.38;

  const contentStart = 0.06;
  const contentEnd = 0.30;

  function clamp01(n) {
    return Math.min(1, Math.max(0, n));
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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
    const t = easeInOutCubic(splitT);

    const tilesInT = easeInOutCubic(
      clamp01((progress - tilesInStart) / (tilesInEnd - tilesInStart))
    );

    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const cx = sw / 2;
    const cy = sh / 2;

    tiles.forEach((tile, i) => {
      const f = layout[i] || layout[layout.length - 1];

      const fx = (f.x / 100) * sw;
      const fy = (f.y / 100) * sh;

      const x = lerp(0, fx, t);
      const y = lerp(0, fy, t);
      const size = lerp(startSize, f.size, t);

      // Add subtle scale-in for smoothness on non-primary tiles
      const appearScale = i === 0 ? 1 : lerp(0.92, 1, tilesInT);

      tile.style.width = `${size}px`;
      tile.style.left = `${cx + x}px`;
      tile.style.top = `${cy + y}px`;
      tile.style.transform = `translate(-50%, -50%) scale(${appearScale})`;

      if (i === 0) {
        tile.style.opacity = "1";
      } else {
        tile.style.opacity = String(tilesInT);
      }
    });

    if (content) {
      const contentT = easeInOutCubic(
        clamp01((progress - contentStart) / (contentEnd - contentStart))
      );
      content.style.opacity = String(contentT);
      content.style.transform = `translateY(${lerp(14, 0, contentT)}px)`;
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
