(() => {
  const PRODUCTS = (window.STORE_PRODUCTS || []).slice();

  // Manual exchange rates from USD (demo). Update anytime.
  const FX = {
    USD: { symbol: "$", rate: 1 },
    EUR: { symbol: "€", rate: 0.92 },
    GBP: { symbol: "£", rate: 0.79 },
    PKR: { symbol: "Rs", rate: 278 },
    INR: { symbol: "₹", rate: 83 },
    AED: { symbol: "د.إ", rate: 3.67 }
  };

  const CART_KEY = "gs_cart_v1";
  const CURR_KEY = "gs_currency_v1";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function getCurrency() {
    return localStorage.getItem(CURR_KEY) || "USD";
  }
  function setCurrency(code) {
    localStorage.setItem(CURR_KEY, code);
  }

  function fmtMoneyUSD(usd, curr) {
    const c = FX[curr] ? curr : "USD";
    const rate = FX[c].rate;
    const symbol = FX[c].symbol;
    const val = usd * rate;

    // Keep it simple (no Intl currency formatting for symbol placement variations)
    const fixed = (c === "PKR" || c === "INR") ? val.toFixed(0) : val.toFixed(2);
    return `${symbol}${fixed}`;
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : { items: {} };
      if (!parsed.items) parsed.items = {};
      return parsed;
    } catch {
      return { items: {} };
    }
  }
  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }
  function cartCount(cart) {
    return Object.values(cart.items).reduce((sum, qty) => sum + qty, 0);
  }
  function setCartCountUI() {
    const cart = loadCart();
    const el = $("#cartCount");
    if (el) el.textContent = String(cartCount(cart));
  }

  function getProductById(id) {
    return PRODUCTS.find(p => p.id === id);
  }

  function addToCart(id, qty = 1) {
    const cart = loadCart();
    cart.items[id] = (cart.items[id] || 0) + qty;
    if (cart.items[id] <= 0) delete cart.items[id];
    saveCart(cart);
    setCartCountUI();
  }

  function setQty(id, qty) {
    const cart = loadCart();
    if (qty <= 0) delete cart.items[id];
    else cart.items[id] = qty;
    saveCart(cart);
    setCartCountUI();
  }

  function computeTotals(cart) {
    const items = Object.entries(cart.items).map(([id, qty]) => {
      const p = getProductById(id);
      return p ? { product: p, qty } : null;
    }).filter(Boolean);

    const subtotal = items.reduce((sum, it) => sum + it.product.priceUSD * it.qty, 0);

    // Simple demo rules
    const shipping = subtotal === 0 ? 0 : (subtotal >= 50 ? 0 : 6.99);
    const tax = subtotal * 0.07; // 7% demo tax
    const total = subtotal + shipping + tax;

    return { items, subtotal, shipping, tax, total };
  }

  function productCardHTML(p, curr) {
    const badge = p.badge ? `<div class="prod-badge">${escapeHtml(p.badge)}</div>` : "";
    return `
      <article class="prod">
        <a class="prod-img ${p.image}" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="${escapeHtml(p.name)}"></a>
        <div class="prod-body">
          <div class="prod-top">
            <div class="prod-name"><a href="product.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.name)}</a></div>
            <div class="prod-price" data-usd="${p.priceUSD}">${fmtMoneyUSD(p.priceUSD, curr)}</div>
          </div>
          <div class="prod-meta">
            <span class="pill">${escapeHtml(p.category)}</span>
            <span class="muted small">★ ${p.rating}</span>
          </div>
          <div class="prod-actions">
            <button class="btn btn-dark btn-sm" data-add="${escapeHtml(p.id)}">Add to cart</button>
            <a class="btn btn-ghost btn-sm" href="product.html?id=${encodeURIComponent(p.id)}">Details</a>
          </div>
        </div>
        ${badge}
      </article>
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function initCurrencySelect() {
    const sel = $("#currencySelect");
    if (!sel) return;

    const saved = getCurrency();
    sel.value = saved;

    sel.addEventListener("change", () => {
      setCurrency(sel.value);
      // Re-render relevant UIs
      setCartCountUI();
      renderAll();
    });
  }

  function bindAddToCartButtons() {
    $$("[data-add]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-add");
        addToCart(id, 1);
        btn.textContent = "Added";
        setTimeout(() => (btn.textContent = "Add to cart"), 700);
      });
    });
  }

  // ---------- Page renderers ----------
  function renderHomeFeatured() {
    const root = $("#featuredProducts");
    if (!root) return;

    const curr = getCurrency();
    const featured = PRODUCTS.slice(0, 4);
    root.innerHTML = featured.map(p => productCardHTML(p, curr)).join("");
    bindAddToCartButtons();
  }

  function renderShop() {
    const root = $("#shopProducts");
    if (!root) return;

    const curr = getCurrency();
    const params = new URLSearchParams(location.search);
    const presetCategory = params.get("category") || "All";

    const searchInput = $("#searchInput");
    const sortSelect = $("#sortSelect");
    const chipsRoot = $("#categoryChips");
    const resetBtn = $("#resetBtn");

    const categories = ["All", ...Array.from(new Set(PRODUCTS.map(p => p.category)))];

    let state = {
      q: "",
      category: presetCategory,
      sort: "featured"
    };

    function drawChips() {
      if (!chipsRoot) return;
      chipsRoot.innerHTML = categories.map(c => `
        <button class="chip ${c === state.category ? "is-active" : ""}" data-cat="${escapeHtml(c)}" type="button">${escapeHtml(c)}</button>
      `).join("");

      $$("[data-cat]").forEach(b => {
        b.addEventListener("click", () => {
          state.category = b.getAttribute("data-cat");
          draw();
        });
      });
    }

    function applyFilters(list) {
      let out = list.slice();

      if (state.category && state.category !== "All") {
        out = out.filter(p => p.category === state.category);
      }
      if (state.q) {
        const q = state.q.toLowerCase();
        out = out.filter(p => (p.name + " " + p.desc).toLowerCase().includes(q));
      }

      switch (state.sort) {
        case "price-asc":
          out.sort((a, b) => a.priceUSD - b.priceUSD); break;
        case "price-desc":
          out.sort((a, b) => b.priceUSD - a.priceUSD); break;
        case "name-asc":
          out.sort((a, b) => a.name.localeCompare(b.name)); break;
        default:
          // featured = original order
          break;
      }
      return out;
    }

    function draw() {
      drawChips();
      const filtered = applyFilters(PRODUCTS);
      root.innerHTML = filtered.map(p => productCardHTML(p, curr)).join("");
      bindAddToCartButtons();
    }

    if (searchInput) {
      searchInput.value = "";
      searchInput.addEventListener("input", () => {
        state.q = searchInput.value.trim();
        draw();
      });
    }
    if (sortSelect) {
      sortSelect.value = state.sort;
      sortSelect.addEventListener("change", () => {
        state.sort = sortSelect.value;
        draw();
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        state = { q: "", category: "All", sort: "featured" };
        if (searchInput) searchInput.value = "";
        if (sortSelect) sortSelect.value = "featured";
        draw();
      });
    }

    draw();
  }

  function renderProduct() {
    const root = $("#productView");
    if (!root) return;

    const curr = getCurrency();
    const params = new URLSearchParams(location.search);
    const id = params.get("id") || "p001";
    const p = getProductById(id) || PRODUCTS[0];

    root.innerHTML = `
      <div class="product-media ${p.image}" role="img" aria-label="${escapeHtml(p.name)}"></div>
      <div class="product-info">
        <div class="product-kicker">${escapeHtml(p.category)}</div>
        <h1 class="product-title">${escapeHtml(p.name)}</h1>
        <div class="product-price" data-usd="${p.priceUSD}">${fmtMoneyUSD(p.priceUSD, curr)}</div>
        <p class="muted">${escapeHtml(p.desc)}</p>

        <div class="product-actions">
          <button class="btn btn-primary" id="addToCartBtn" type="button">Add to cart</button>
          <a class="btn btn-ghost" href="cart.html">View cart</a>
        </div>

        <div class="product-features">
          <div class="product-features-title">Highlights</div>
          <ul>
            ${p.features.map(f => `<li>${escapeHtml(f)}</li>`).join("")}
          </ul>
        </div>
      </div>
    `;

    const addBtn = $("#addToCartBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        addToCart(p.id, 1);
        addBtn.textContent = "Added to cart";
        setTimeout(() => (addBtn.textContent = "Add to cart"), 900);
      });
    }

    const relatedRoot = $("#relatedProducts");
    if (relatedRoot) {
      const related = PRODUCTS.filter(x => x.id !== p.id).slice(0, 4);
      relatedRoot.innerHTML = related.map(x => productCardHTML(x, curr)).join("");
      bindAddToCartButtons();
    }
  }

  function renderCart() {
    const root = $("#cartItems");
    if (!root) return;

    const curr = getCurrency();
    const cart = loadCart();
    const totals = computeTotals(cart);

    const empty = $("#cartEmpty");
    if (totals.items.length === 0) {
      root.innerHTML = "";
      if (empty) empty.hidden = false;
    } else {
      if (empty) empty.hidden = true;
      root.innerHTML = totals.items.map(({ product, qty }) => `
        <div class="cart-item">
          <div class="cart-thumb ${product.image}"></div>
          <div class="cart-main">
            <div class="cart-title">
              <a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a>
              <span class="muted small">${escapeHtml(product.category)}</span>
            </div>

            <div class="cart-controls">
              <div class="qty">
                <button class="qty-btn" data-dec="${escapeHtml(product.id)}" type="button">−</button>
                <input class="qty-input" value="${qty}" inputmode="numeric" data-qty="${escapeHtml(product.id)}" />
                <button class="qty-btn" data-inc="${escapeHtml(product.id)}" type="button">+</button>
              </div>

              <button class="link danger" data-remove="${escapeHtml(product.id)}" type="button">Remove</button>
            </div>
          </div>

          <div class="cart-price">
            <div>${fmtMoneyUSD(product.priceUSD * qty, curr)}</div>
            <div class="muted small">${fmtMoneyUSD(product.priceUSD, curr)} each</div>
          </div>
        </div>
      `).join("");
    }

    const subEl = $("#cartSubtotal");
    const shipEl = $("#cartShipping");
    const taxEl = $("#cartTax");
    const totalEl = $("#cartTotal");
    if (subEl) subEl.textContent = fmtMoneyUSD(totals.subtotal, curr);
    if (shipEl) shipEl.textContent = fmtMoneyUSD(totals.shipping, curr);
    if (taxEl) taxEl.textContent = fmtMoneyUSD(totals.tax, curr);
    if (totalEl) totalEl.textContent = fmtMoneyUSD(totals.total, curr);

    $$("[data-inc]").forEach(b => b.addEventListener("click", () => {
      const id = b.getAttribute("data-inc");
      const c = loadCart();
      setQty(id, (c.items[id] || 0) + 1);
      renderCart();
    }));
    $$("[data-dec]").forEach(b => b.addEventListener("click", () => {
      const id = b.getAttribute("data-dec");
      const c = loadCart();
      setQty(id, (c.items[id] || 0) - 1);
      renderCart();
    }));
    $$("[data-remove]").forEach(b => b.addEventListener("click", () => {
      const id = b.getAttribute("data-remove");
      setQty(id, 0);
      renderCart();
    }));
    $$("[data-qty]").forEach(inp => inp.addEventListener("change", () => {
      const id = inp.getAttribute("data-qty");
      const val = Math.max(0, parseInt(inp.value || "0", 10));
      setQty(id, val);
      renderCart();
    }));

    const clearBtn = $("#clearCartBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        saveCart({ items: {} });
        setCartCountUI();
        renderCart();
      });
    }
  }

  function renderCheckout() {
    const subEl = $("#checkoutSubtotal");
    if (!subEl) return;

    const curr = getCurrency();
    const cart = loadCart();
    const totals = computeTotals(cart);

    $("#checkoutSubtotal").textContent = fmtMoneyUSD(totals.subtotal, curr);
    $("#checkoutShipping").textContent = fmtMoneyUSD(totals.shipping, curr);
    $("#checkoutTax").textContent = fmtMoneyUSD(totals.tax, curr);
    $("#checkoutTotal").textContent = fmtMoneyUSD(totals.total, curr);

    const emptyNote = $("#checkoutEmptyNote");
    if (emptyNote) emptyNote.hidden = totals.items.length !== 0;

    const form = $("#checkoutForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (totals.items.length === 0) {
          alert("Your cart is empty.");
          return;
        }
        // Demo "place order"
        alert("Order placed (demo)! Thank you.");
        saveCart({ items: {} });
        setCartCountUI();
        location.href = "index.html";
      });
    }
  }

  function renderAll() {
    renderHomeFeatured();
    renderShop();
    renderProduct();
    renderCart();
    renderCheckout();
  }

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", () => {
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    initCurrencySelect();
    setCartCountUI();
    renderAll();
  });
})();
