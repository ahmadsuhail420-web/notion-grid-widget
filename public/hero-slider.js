(function () {
  const root = document.querySelector("[data-hero-slider]");
  if (!root) return;

  const slides = Array.from(root.querySelectorAll(".hero-slide"));
  const btnPrev = root.querySelector("[data-hero-prev]");
  const btnNext = root.querySelector("[data-hero-next]");

  const currentEl = root.querySelector("[data-hero-current]");
  const totalEl = root.querySelector("[data-hero-total]");

  let index = 0;
  let timer = null;
  const AUTOPLAY_MS = 5200;

  function setActive(nextIndex) {
    index = (nextIndex + slides.length) % slides.length;

    slides.forEach((s, i) => {
      const active = i === index;
      s.classList.toggle("is-active", active);
      s.setAttribute("aria-hidden", active ? "false" : "true");
    });

    if (currentEl) currentEl.textContent = String(index + 1);
    if (totalEl) totalEl.textContent = String(slides.length);
  }

  function next() {
    setActive(index + 1);
  }

  function prev() {
    setActive(index - 1);
  }

  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function start() {
    stop();
    timer = window.setInterval(next, AUTOPLAY_MS);
  }

  btnNext?.addEventListener("click", () => {
    next();
    start();
  });

  btnPrev?.addEventListener("click", () => {
    prev();
    start();
  });

  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  root.addEventListener("focusin", stop);
  root.addEventListener("focusout", start);

  setActive(0);
  start();
})();
