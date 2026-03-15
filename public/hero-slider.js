(function () {
  const root = document.querySelector("[data-hero-slider]");
  if (!root) return;

  const slides = Array.from(root.querySelectorAll(".hero-slide"));
  const dots = Array.from(root.querySelectorAll("[data-hero-dot]"));
  const btnPrev = root.querySelector("[data-hero-prev]");
  const btnNext = root.querySelector("[data-hero-next]");

  let index = 0;
  let timer = null;
  const AUTOPLAY_MS = 5000;

  function setActive(nextIndex) {
    index = (nextIndex + slides.length) % slides.length;

    slides.forEach((s, i) => {
      const active = i === index;
      s.classList.toggle("is-active", active);
      s.setAttribute("aria-hidden", active ? "false" : "true");
    });

    dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
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

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const n = Number(dot.getAttribute("data-hero-dot") || "0");
      setActive(n);
      start();
    });
  });

  root.addEventListener("mouseenter", stop);
  root.addEventListener("mouseleave", start);
  root.addEventListener("focusin", stop);
  root.addEventListener("focusout", start);

  setActive(0);
  start();
})();
