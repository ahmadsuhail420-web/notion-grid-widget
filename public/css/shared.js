// Sync & Style — shared footer + reveal animations + nav helpers
(function () {
  // Inject footer if a placeholder exists
  const footerSlot = document.getElementById('ss-footer-slot');
  if (footerSlot) {
    footerSlot.innerHTML = `
      <footer class="ss-footer">
        <div class="ss-footer-inner">
          <div class="ss-footer-brand">
            <a href="/" class="ss-footer-logo">Sync &amp; Style</a>
            <span class="ss-footer-tagline">Beautifully crafted digital wedding invitations.</span>
          </div>
          <nav class="ss-footer-links" aria-label="Footer">
            <a href="/">Home</a>
            <a href="/templates">Templates</a>
            <a href="/contact-us.html">Contact</a>
            <a href="/terms-and-conditions.html">Terms</a>
            <a href="/privacy-policy.html">Privacy</a>
            <a href="/cancellation-and-refund.html">Refunds</a>
            <a href="/shipping-and-exchange.html">Shipping</a>
          </nav>
          <div class="ss-footer-copy">
            &copy; ${new Date().getFullYear()} Sync &amp; Style &middot; Crafted with &#9825;
          </div>
        </div>
      </footer>
    `;
  }

  // Reveal-on-scroll for any element with .ss-reveal
  const reveals = document.querySelectorAll('.ss-reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.12 });
    reveals.forEach(el => obs.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('visible'));
  }
})();
