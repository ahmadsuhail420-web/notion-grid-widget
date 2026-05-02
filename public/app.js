function smoothScrollTo(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-scroll]");
  if (!btn) return;

  const target = btn.getAttribute("data-scroll");
  if (!target) return;

  e.preventDefault();
  smoothScrollTo(target);
});

// Guard: only set year if the element exists on this page
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

