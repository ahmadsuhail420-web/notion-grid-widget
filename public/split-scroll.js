(function () {
  const scene = document.querySelector("[data-split-scene]");
  const header = document.querySelector("[data-site-header]");
  if (!scene) return;

  const tiles = Array.from(scene.querySelectorAll(".collage .tile"));
  const content = scene.querySelector(".hero-content");

  // Desktop layout = spread around hero (like image3)
  const layoutDesktop = [
    { x: -41, y: -30, size: 105 }, // top-left
    { x: -14, y: -44, size: 80  }, // top-mid-left
    { x:  16, y: -44, size: 80  }, // top-mid-right
    { x:  41, y: -30, size: 120 }, // top-right

    { x: -42, y:  12, size: 150 }, // mid-left
    { x:  42, y:   8, size: 150 }, // mid-right

    { x: -18, y:  40, size: 110 }, // bottom-mid-left
    { x:  41, y:  42, size: 120 }, // bottom-right
  ];

  // Mobile layout = smaller so it doesn't overwhelm
  const layoutMobile = [
    { x: -34, y: -30, size: 86  },
    { x: -10, y: -44, size: 62  },
    { x:  12, y: -44, size: 62  },
    { x:  34, y: -30, size: 92  },

    { x: -34, y:  10, size: 110 },
    { x:  34, y:   8, size: 110 },

    { x: -10, y:  40, size: 82  },
    { x:  34, y:  42, size: 92  },
  ];

  function getLayout() {
    return window.innerWidth < 520 ? layoutMobile : layoutDesktop;
  }

  // Before split: a single centered image (like image4)
  const start = { x: 0, y: 0, size: 260 };

  // Timing: split happens quickly, then you move into section 2 immediately
  const splitEnd = 1.0;

  // Hero content fade-in during early part of split
  const contentStart = 0.10;
  const contentEnd = 0.34;

  // Other tiles appear during split (so it's not instantly "all tiles")
  const tilesInStart = 0.12;
  const tilesInEnd = 0.32;

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

    const final = getLayout();

    // Split phase (0..1)
    const splitT = clamp01(progress / splitEnd);
    const t = easeOutCubic(splitT);

    // How much the extra tiles should be visible
    const tilesInT = easeOutCubic(
      clamp01((progress - tilesInStart) / (tilesInEnd - tilesInStart))
    );

    tiles.forEach((tile, i) => {
      const f = final[i] || final[final.length - 1];
      const x = lerp(start.x, f.x, t);
      const y = lerp(start.y, f.y, t);
      const size = lerp(start.size, f.size, t);

      tile.style.width = `${size}px`;

      // IMPORTANT: stage-centered coordinate system (so max-width works)
      tile.style.transform =
        `translate(calc(50% + ${x}vw), calc(50% + ${y}vh)) translate(-50%, -50%)`;

      // Before split: only tile 0 shows (single centered image)
      // During split: others fade/scale in smoothly
      if (i === 0) {
        tile.style.opacity = "1";
        tile.style.filter = "none";
      } else {
        tile.style.opacity = String(tilesInT);
      }
    });

    // Hero content reveals smoothly
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

  apply(0);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
})();
