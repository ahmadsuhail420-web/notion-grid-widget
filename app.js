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

document.getElementById("year").textContent = new Date().getFullYear();
