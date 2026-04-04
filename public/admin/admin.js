(() => {
  const API = "/api/admin-content";
  const TOKEN_KEY = "admin_builder_token_v1";
  const MAX_SLIDES = 5;

  const $ = (id) => document.getElementById(id);

  const state = {
    locked: true,
    token: "",
    currentPage: "home",
    models: { home: null, products: null, about: null, contact: null },
    dirty: { home: false, products: false, about: false, contact: false },
    selection: null
  };

  function setStatus(msg) { $("status").textContent = msg || ""; }
  function setAuthStatus(msg) { $("authStatus").textContent = msg || ""; }

  function getToken() { return sessionStorage.getItem(TOKEN_KEY) || ""; }
  function setToken(t) {
    if (!t) sessionStorage.removeItem(TOKEN_KEY);
    else sessionStorage.setItem(TOKEN_KEY, t);
  }

  function showModal(id, show) { $(id).setAttribute("aria-hidden", String(!show)); }

  async function safeText(res) { try { return await res.text(); } catch { return ""; } }

  async function apiGet(page) {
    const res = await fetch(`${API}?page=${encodeURIComponent(page)}`, {
      method: "GET",
      headers: { "x-admin-token": state.token }
    });
    if (!res.ok) throw new Error((await safeText(res)) || "Failed to load.");
    return res.json();
  }

  async function apiSave(page, data) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": state.token },
      body: JSON.stringify({ action: "save", page, data })
    });
    if (!res.ok) throw new Error((await safeText(res)) || "Failed to save.");
    return res.json();
  }

  async function apiUpload(file) {
    const base64 = await fileToBase64(file);
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": state.token },
      body: JSON.stringify({ action: "upload", filename: file.name, contentType: file.type, base64 })
    });
    if (!res.ok) throw new Error((await safeText(res)) || "Upload failed.");
    return res.json();
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("File read error"));
      r.onload = () => {
        const result = String(r.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      r.readAsDataURL(file);
    });
  }

  function updateLockUI() {
    $("lockText").textContent = state.locked ? "Locked" : "Unlocked";
    $("lockDot").classList.toggle("is-unlocked", !state.locked);
    $("whoami").textContent = state.locked ? "Locked" : "Unlocked (session)";
  }

  function prettyPage(p) {
    return p === "home" ? "Home" :
      p === "products" ? "Products" :
      p === "about" ? "About" :
      p === "contact" ? "Contact" : p;
  }

  function setPage(page) {
    state.currentPage = page;

    document.querySelectorAll(".nav-item").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.page === page);
    });

    $("currentPageLabel").textContent = prettyPage(page);

    const url =
      page === "home" ? "/index.html?admin=1" :
      page === "products" ? "/shop.html?admin=1" :
      page === "about" ? "/about.html?admin=1" :
      page === "contact" ? "/contact.html?admin=1" :
      "/index.html?admin=1";

    $("previewFrame").src = url;
    clearSelection();

    if (page === "products") {
      state.selection = { page: "products", target: "catalog" };
      renderInspectorForSelection(state.selection);
      postToPreview({ type: "rerenderProducts", page: "products", products: (state.models.products?.items || []) });
    }
  }

  function markDirty(page, isDirty) {
    state.dirty[page] = !!isDirty;
    updateSaveButton();
  }

  function updateSaveButton() {
    const anyDirty = Object.values(state.dirty).some(Boolean);
    $("saveBtn").disabled = state.locked || !anyDirty;
  }

  function clearSelection() {
    state.selection = null;
    renderInspectorEmpty();
  }

  function renderInspectorEmpty() {
    $("inspectorTitle").textContent = "Inspector";
    $("inspectorSub").textContent = "Click an element in the preview to edit.";
    $("inspectorBody").innerHTML = `
      <div class="empty">
        <div class="empty-title">Nothing selected</div>
        <div class="empty-sub">Click a heading, text, product, or slide in the preview.</div>
      </div>
    `;
  }

  function renderInspectorForSelection(sel) {
    $("inspectorTitle").textContent = `${prettyPage(sel.page)} • ${sel.target}`;
    $("inspectorSub").textContent = "Changes apply live. Click Save to persist.";

    if (sel.page === "home") return renderHomeInspector(sel);
    if (sel.page === "products") return renderProductsInspector(sel);
    if (sel.page === "about") return renderAboutInspector(sel);
    if (sel.page === "contact") return renderContactInspector(sel);

    renderInspectorEmpty();
  }

  function clampNum(n, min, max) {
    n = Number.isFinite(n) ? n : min;
    return Math.max(min, Math.min(max, n));
  }

  function postToPreview(msg) {
    const frame = $("previewFrame");
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ __adminBuilder: true, ...msg }, window.location.origin);
  }

  // ===== Home Inspector =====
  function renderHomeInspector(sel) {
    const home = state.models.home;
    if (!home) return renderInspectorEmpty();

    home.storySlides = Array.isArray(home.storySlides) ? home.storySlides.slice(0, MAX_SLIDES) : [];
    home.theme = home.theme || {};

    if (sel.target === "tickerText") {
      $("inspectorBody").innerHTML = `
        <div class="section">
          <div class="section-title">Ticker</div>
          <div class="control">
            <label>Text</label>
            <input id="val" type="text" />
          </div>
        </div>
      `;
      const input = $("val");
      input.value = home.tickerText || "";
      input.addEventListener("input", () => {
        home.tickerText = input.value.slice(0, 80);
        markDirty("home", true);
        postToPreview({ type: "apply", page: "home", target: "tickerText", value: home.tickerText });
      });
      return;
    }

    if (sel.target === "subtext") {
      $("inspectorBody").innerHTML = `
        <div class="section">
          <div class="section-title">Subtext</div>
          <div class="control">
            <label>Text</label>
            <textarea id="val"></textarea>
          </div>

          <div class="hr"></div>

          <div class="section-title">Style</div>
          <div class="grid2">
            <div class="control">
              <label>Color</label>
              <input id="color" type="text" placeholder="#0d0d0d" />
            </div>
            <div class="control">
              <label>Align</label>
              <select id="align">
                <option value="left">Left</option>
                <option value="center">Center</option>
              </select>
            </div>
          </div>
        </div>
      `;

      const input = $("val");
      input.value = home.subtext || "";
      input.addEventListener("input", () => {
        home.subtext = input.value.slice(0, 500);
        markDirty("home", true);
        postToPreview({ type: "apply", page: "home", target: "subtext", value: home.subtext });
      });

      home.theme.subtextColor = home.theme.subtextColor || "";
      home.theme.heroAlign = home.theme.heroAlign || "left";

      const color = $("color");
      const align = $("align");
      color.value = home.theme.subtextColor || "";
      align.value = home.theme.heroAlign || "left";

      const applyStyle = () => {
        markDirty("home", true);
        postToPreview({
          type: "applyStyle",
          page: "home",
          target: "subtext",
          style: { color: home.theme.subtextColor || "", align: home.theme.heroAlign || "left" }
        });
      };

      color.addEventListener("input", () => { home.theme.subtextColor = color.value.slice(0, 24); applyStyle(); });
      align.addEventListener("change", () => { home.theme.heroAlign = align.value; applyStyle(); });
      return;
    }

    if (sel.target === "heroHeading") {
      $("inspectorBody").innerHTML = `
        <div class="section">
          <div class="section-title">Hero Heading</div>
          <div class="hint">Click heading in preview and type. Use buttons to style the selected word.</div>

          <div class="rowBtns" style="margin-top:10px;">
            <button class="btn" id="italicBtn" type="button">Playfair Italic (word)</button>
            <button class="btn btn-ghost" id="normalBtn" type="button">Inter (remove italic)</button>
          </div>

          <div class="hr"></div>

          <div class="section-title">Style</div>
          <div class="grid2">
            <div class="control">
              <label>Heading color</label>
              <input id="hColor" type="text" placeholder="#0d0d0d" />
            </div>
            <div class="control">
              <label>Align</label>
              <select id="align">
                <option value="left">Left</option>
                <option value="center">Center</option>
              </select>
            </div>
          </div>
        </div>
      `;

      home.theme.headingColor = home.theme.headingColor || "";
      home.theme.heroAlign = home.theme.heroAlign || "left";

      const hColor = $("hColor");
      const align = $("align");
      hColor.value = home.theme.headingColor || "";
      align.value = home.theme.heroAlign || "left";

      const applyHeadingStyle = () => {
        markDirty("home", true);
        postToPreview({
          type: "applyStyle",
          page: "home",
          target: "heroHeading",
          style: { color: home.theme.headingColor || "", align: home.theme.heroAlign || "left" }
        });
      };

      hColor.addEventListener("input", () => { home.theme.headingColor = hColor.value.slice(0, 24); applyHeadingStyle(); });
      align.addEventListener("change", () => { home.theme.heroAlign = align.value; applyHeadingStyle(); });

      $("italicBtn").addEventListener("click", () => postToPreview({ type: "heroWordStyle", page: "home", action: "italic" }));
      $("normalBtn").addEventListener("click", () => postToPreview({ type: "heroWordStyle", page: "home", action: "normal" }));
      return;
    }

    // ===== SLIDE editor (DROPDOWN + ADJUST + CROP BOX DRAG) =====
    if (sel.target && sel.target.startsWith("slide:")) {
      const idx = Number(sel.target.split(":")[1] || "0");
      const slides = home.storySlides;
      const slide = slides[idx];
      if (!slide) return renderInspectorEmpty();

      slide.type = slide.type === "video" ? "video" : "image";
      slide.overlay = slide.overlay || { enabled: true, opacity: 0.45 };
      slide.adjust = slide.adjust || { fit: "cover", x: 50, y: 50, zoom: 1 };

      $("inspectorBody").innerHTML = `
        <div class="section">
          <div class="section-title">Slide</div>

          <div class="control">
            <label>Select slide</label>
            <select id="slidePick"></select>
          </div>

          <div class="hr"></div>

          <div class="grid2">
            <div class="control">
              <label>Type</label>
              <select id="type">
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div class="control">
              <label>Alt</label>
              <input id="alt" type="text" />
            </div>
          </div>

          <div class="control">
            <label>Caption (optional)</label>
            <input id="caption" type="text" />
          </div>

          <div class="grid2">
            <div class="control">
              <label>Overlay</label>
              <select id="overlayOn">
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </div>
            <div class="control">
              <label>Overlay opacity (0–0.85)</label>
              <input id="overlayOpacity" type="number" min="0" max="0.85" step="0.05" />
            </div>
          </div>

          <div class="hr"></div>

          <div class="section-title">Crop / Move</div>

          <div class="cropBox" id="cropBox">
            <img id="cropImg" class="cropMedia" alt="Crop preview" />
            <div class="cropHint">Drag to move</div>
          </div>

          <div class="grid2" style="margin-top:10px;">
            <div class="control">
              <label>Fit</label>
              <select id="fit">
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
              </select>
            </div>
            <div class="control">
              <label>Zoom (1.0–2.0)</label>
              <input id="zoom" type="number" min="1" max="2" step="0.05" />
            </div>
          </div>

          <div class="grid2">
            <div class="control">
              <label>X (0–100)</label>
              <input id="posX" type="number" min="0" max="100" step="1" />
            </div>
            <div class="control">
              <label>Y (0–100)</label>
              <input id="posY" type="number" min="0" max="100" step="1" />
            </div>
          </div>

          <div class="rowBtns">
            <button class="btn btn-ghost" id="centerCrop" type="button">Center</button>
            <button class="btn btn-ghost" id="resetCrop" type="button">Reset</button>
          </div>

          <div class="hr"></div>

          <div class="section-title">Media</div>
          <div class="control">
            <label>URL</label>
            <input id="src" type="text" />
          </div>
          <div class="control">
            <label>Upload file</label>
            <input id="upload" type="file" />
          </div>

          <div class="hr"></div>

          <div class="rowBtns">
            <button class="btn btn-ghost" id="left" type="button">Move left</button>
            <button class="btn btn-ghost" id="right" type="button">Move right</button>
            <button class="btn" id="remove" type="button" style="border-color: rgba(255,90,104,.35);">Delete</button>
          </div>
        </div>
      `;

      const slidePick = $("slidePick");
      slidePick.innerHTML = slides.map((_, i) => `<option value="${i}">Slide ${i + 1}</option>`).join("");
      slidePick.value = String(idx);

      slidePick.addEventListener("change", () => {
        const nextIdx = Number(slidePick.value || "0");
        state.selection = { page: "home", target: "slide:" + nextIdx };
        renderInspectorForSelection(state.selection);
        postToPreview({ type: "selectSlide", page: "home", index: nextIdx });
      });

      const type = $("type");
      const alt = $("alt");
      const caption = $("caption");
      const overlayOn = $("overlayOn");
      const overlayOpacity = $("overlayOpacity");
      const src = $("src");
      const upload = $("upload");

      const fit = $("fit");
      const zoom = $("zoom");
      const posX = $("posX");
      const posY = $("posY");

      const cropBox = $("cropBox");
      const cropImg = $("cropImg");
      const centerCrop = $("centerCrop");
      const resetCrop = $("resetCrop");

      type.value = slide.type;
      alt.value = slide.alt || "";
      caption.value = slide.caption || "";
      overlayOn.value = slide.overlay.enabled === false ? "off" : "on";
      overlayOpacity.value = clampNum(slide.overlay.opacity ?? 0.45, 0, 0.85);
      src.value = slide.src || "";

      fit.value = slide.adjust.fit === "contain" ? "contain" : "cover";
      zoom.value = clampNum(slide.adjust.zoom ?? 1, 1, 2);
      posX.value = clampNum(slide.adjust.x ?? 50, 0, 100);
      posY.value = clampNum(slide.adjust.y ?? 50, 0, 100);

      const commitSlide = () => {
        markDirty("home", true);
        postToPreview({ type: "applySlide", page: "home", index: idx, slide });
        postToPreview({ type: "selectSlide", page: "home", index: idx });
      };

      function renderCropPreview() {
        if (!cropBox || !cropImg) return;

        const isImage = slide.type !== "video";
        cropBox.style.display = isImage ? "block" : "none";
        if (!isImage) return;

        cropImg.src = slide.src || "";
        cropImg.style.objectFit = slide.adjust.fit === "contain" ? "contain" : "cover";
        cropImg.style.objectPosition = `${slide.adjust.x}% ${slide.adjust.y}%`;
        cropImg.style.transform = `scale(${slide.adjust.zoom})`;
        cropImg.style.transformOrigin = `${slide.adjust.x}% ${slide.adjust.y}%`;
      }

      // Drag-to-move
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let startAdjX = 50;
      let startAdjY = 50;

      function toPercentDelta(dxPx, dyPx) {
        const r = cropBox.getBoundingClientRect();
        const dx = (dxPx / Math.max(1, r.width)) * 100;
        const dy = (dyPx / Math.max(1, r.height)) * 100;
        return { dx, dy };
      }

      cropBox?.addEventListener("pointerdown", (e) => {
        if (slide.type === "video") return;
        dragging = true;
        cropBox.setPointerCapture(e.pointerId);
        startX = e.clientX;
        startY = e.clientY;
        startAdjX = slide.adjust.x ?? 50;
        startAdjY = slide.adjust.y ?? 50;
      });

      cropBox?.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const { dx, dy } = toPercentDelta(e.clientX - startX, e.clientY - startY);

        slide.adjust.x = clampNum(startAdjX - dx, 0, 100);
        slide.adjust.y = clampNum(startAdjY - dy, 0, 100);

        posX.value = String(Math.round(slide.adjust.x));
        posY.value = String(Math.round(slide.adjust.y));

        commitSlide();
        renderCropPreview();
      });

      cropBox?.addEventListener("pointerup", () => { dragging = false; });
      cropBox?.addEventListener("pointercancel", () => { dragging = false; });

      centerCrop?.addEventListener("click", () => {
        slide.adjust.x = 50;
        slide.adjust.y = 50;
        posX.value = "50";
        posY.value = "50";
        commitSlide();
        renderCropPreview();
      });

      resetCrop?.addEventListener("click", () => {
        slide.adjust.fit = "cover";
        slide.adjust.zoom = 1;
        slide.adjust.x = 50;
        slide.adjust.y = 50;
        fit.value = "cover";
        zoom.value = "1";
        posX.value = "50";
        posY.value = "50";
        commitSlide();
        renderCropPreview();
      });

      type.addEventListener("change", () => {
        slide.type = type.value === "video" ? "video" : "image";
        commitSlide();
        renderCropPreview();
      });

      alt.addEventListener("input", () => { slide.alt = alt.value.slice(0, 140); commitSlide(); });
      caption.addEventListener("input", () => { slide.caption = caption.value.slice(0, 80); commitSlide(); });

      overlayOn.addEventListener("change", () => {
        slide.overlay.enabled = overlayOn.value === "on";
        commitSlide();
      });

      overlayOpacity.addEventListener("input", () => {
        slide.overlay.opacity = clampNum(parseFloat(overlayOpacity.value || "0.45"), 0, 0.85);
        overlayOpacity.value = String(slide.overlay.opacity);
        commitSlide();
      });

      src.addEventListener("input", () => {
        slide.src = src.value.trim().slice(0, 700);
        commitSlide();
        renderCropPreview();
      });

      fit.addEventListener("change", () => {
        slide.adjust.fit = fit.value === "contain" ? "contain" : "cover";
        commitSlide();
        renderCropPreview();
      });

      zoom.addEventListener("input", () => {
        slide.adjust.zoom = clampNum(parseFloat(zoom.value || "1"), 1, 2);
        zoom.value = String(slide.adjust.zoom);
        commitSlide();
        renderCropPreview();
      });

      posX.addEventListener("input", () => {
        slide.adjust.x = clampNum(parseFloat(posX.value || "50"), 0, 100);
        posX.value = String(slide.adjust.x);
        commitSlide();
        renderCropPreview();
      });

      posY.addEventListener("input", () => {
        slide.adjust.y = clampNum(parseFloat(posY.value || "50"), 0, 100);
        posY.value = String(slide.adjust.y);
        commitSlide();
        renderCropPreview();
      });

      upload.addEventListener("change", async () => {
        const f = upload.files && upload.files[0];
        if (!f) return;
        try {
          setStatus("Uploading…");
          const out = await apiUpload(f);
          slide.src = out.url || "";
          src.value = slide.src;
          setStatus("Uploaded.");
          commitSlide();
          renderCropPreview();
        } catch (e) {
          setStatus(e.message || "Upload failed.");
        }
      });

      $("left").addEventListener("click", () => {
        if (idx <= 0) return;
        const tmp = slides[idx - 1];
        slides[idx - 1] = slides[idx];
        slides[idx] = tmp;
        home.storySlides = slides;
        markDirty("home", true);
        postToPreview({ type: "rerenderSlides", page: "home", slides });
        state.selection = { page: "home", target: "slide:" + (idx - 1) };
        renderInspectorForSelection(state.selection);
        postToPreview({ type: "selectSlide", page: "home", index: idx - 1 });
      });

      $("right").addEventListener("click", () => {
        if (idx >= slides.length - 1) return;
        const tmp = slides[idx + 1];
        slides[idx + 1] = slides[idx];
        slides[idx] = tmp;
        home.storySlides = slides;
        markDirty("home", true);
        postToPreview({ type: "rerenderSlides", page: "home", slides });
        state.selection = { page: "home", target: "slide:" + (idx + 1) };
        renderInspectorForSelection(state.selection);
        postToPreview({ type: "selectSlide", page: "home", index: idx + 1 });
      });

      $("remove").addEventListener("click", () => {
        slides.splice(idx, 1);
        home.storySlides = slides;
        markDirty("home", true);
        postToPreview({ type: "rerenderSlides", page: "home", slides });
        clearSelection();
      });

      renderCropPreview();
      return;
    }

    renderInspectorEmpty();
  }

  // ===== Products Inspector =====
  function renderProductsInspector(sel) {
    const products = state.models.products;
    if (!products) return renderInspectorEmpty();
    products.items = Array.isArray(products.items) ? products.items : [];

    if (sel.target === "catalog") {
      $("inspectorBody").innerHTML = `
        <div class="section">
          <div class="section-title">Catalog</div>
          <div class="hint">Add products. Click a product card in preview to edit it.</div>
          <div class="hr"></div>
          <div class="control">
            <label>Add new product</label>
            <button class="btn" id="add" type="button">+ Add product</button>
          </div>
        </div>
      `;
      $("add").addEventListener("click", () => {
        const id = "p" + String(Date.now());
        products.items.unshift({
          id,
          title: "New product",
          price: 19.99,
          currency: "USD",
          image: "",
          category: "",
          badge: "",
          description: "",
          buyLink: ""
        });
        markDirty("products", true);
        postToPreview({ type: "rerenderProducts", page: "products", products: products.items });
      });
      return;
    }

    if (sel.target && sel.target.startsWith("product:")) {
      const id = sel.target.split(":")[1];
      const item = products.items.find((p) => p.id === id);
      if (!item) return renderInspectorEmpty();

      $("inspectorBody").innerHTML = `
        <div class="section">
          <div class="section-title">Product</div>

          <div class="control">
            <label>Title</label>
            <input id="title" type="text" />
          </div>

          <div class="grid2">
            <div class="control">
              <label>Price</label>
              <input id="price" type="number" step="0.01" />
            </div>
            <div class="control">
              <label>Currency</label>
              <select id="currency">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="PKR">PKR</option>
                <option value="INR">INR</option>
                <option value="AED">AED</option>
              </select>
            </div>
          </div>

          <div class="grid2">
            <div class="control">
              <label>Category</label>
              <input id="category" type="text" />
            </div>
            <div class="control">
              <label>Badge</label>
              <input id="badge" type="text" />
            </div>
          </div>

          <div class="control">
            <label>Description</label>
            <textarea id="description"></textarea>
          </div>

          <div class="control">
            <label>Buy link</label>
            <input id="buyLink" type="text" placeholder="https://..." />
          </div>

          <div class="hr"></div>

          <div class="section-title">Image</div>
          <div class="control">
            <label>Image URL</label>
            <input id="image" type="text" placeholder="/uploads/..." />
          </div>
          <div class="control">
            <label>Upload image</label>
            <input id="upload" type="file" accept="image/*" />
          </div>

          <div class="hr"></div>

          <div class="rowBtns">
            <button class="btn btn-ghost" id="dup" type="button">Duplicate</button>
            <button class="btn" id="del" type="button" style="border-color: rgba(255,90,104,.35);">Delete</button>
          </div>
        </div>
      `;

      const title = $("title");
      const price = $("price");
      const currency = $("currency");
      const category = $("category");
      const badge = $("badge");
      const description = $("description");
      const buyLink = $("buyLink");
      const image = $("image");
      const upload = $("upload");

      title.value = item.title || "";
      price.value = String(item.price ?? 0);
      currency.value = item.currency || "USD";
      category.value = item.category || "";
      badge.value = item.badge || "";
      description.value = item.description || "";
      buyLink.value = item.buyLink || "";
      image.value = item.image || "";

      const commit = () => {
        markDirty("products", true);
        postToPreview({ type: "rerenderProducts", page: "products", products: products.items });
      };

      title.addEventListener("input", () => { item.title = title.value.slice(0, 80); commit(); });
      price.addEventListener("input", () => { item.price = clampNum(parseFloat(price.value || "0"), 0, 100000); commit(); });
      currency.addEventListener("change", () => { item.currency = currency.value; commit(); });
      category.addEventListener("input", () => { item.category = category.value.slice(0, 40); commit(); });
      badge.addEventListener("input", () => { item.badge = badge.value.slice(0, 20); commit(); });
      description.addEventListener("input", () => { item.description = description.value.slice(0, 500); commit(); });
      buyLink.addEventListener("input", () => { item.buyLink = buyLink.value.trim().slice(0, 400); commit(); });
      image.addEventListener("input", () => { item.image = image.value.trim().slice(0, 400); commit(); });

      upload.addEventListener("change", async () => {
        const f = upload.files && upload.files[0];
        if (!f) return;
        try {
          setStatus("Uploading…");
          const out = await apiUpload(f);
          item.image = out.url || "";
          image.value = item.image;
          setStatus("Uploaded.");
          commit();
        } catch (e) {
          setStatus(e.message || "Upload failed.");
        }
      });

      $("dup").addEventListener("click", () => {
        const clone = JSON.parse(JSON.stringify(item));
        clone.id = "p" + String(Date.now());
        clone.title = clone.title + " (copy)";
        products.items.unshift(clone);
        markDirty("products", true);
        postToPreview({ type: "rerenderProducts", page: "products", products: products.items });
      });

      $("del").addEventListener("click", () => {
        products.items = products.items.filter((p) => p.id !== item.id);
        markDirty("products", true);
        postToPreview({ type: "rerenderProducts", page: "products", products: products.items });
        clearSelection();
      });

      return;
    }

    renderInspectorEmpty();
  }

  // ===== About Inspector =====
  function renderAboutInspector() {
    const about = state.models.about;
    if (!about) return renderInspectorEmpty();

    $("inspectorBody").innerHTML = `
      <div class="section">
        <div class="section-title">About</div>

        <div class="control">
          <label>Heading</label>
          <input id="heading" type="text" />
        </div>

        <div class="control">
          <label>Body</label>
          <textarea id="body"></textarea>
        </div>

        <div class="control">
          <label>Image URL</label>
          <input id="image" type="text" placeholder="/uploads/..." />
        </div>

        <div class="control">
          <label>Upload image</label>
          <input id="upload" type="file" accept="image/*" />
        </div>
      </div>
    `;

    const heading = $("heading");
    const body = $("body");
    const image = $("image");
    const upload = $("upload");

    heading.value = about.heading || "";
    body.value = about.body || "";
    image.value = about.image || "";

    const commit = () => {
      markDirty("about", true);
      postToPreview({ type: "applyAbout", page: "about", data: about });
    };

    heading.addEventListener("input", () => { about.heading = heading.value.slice(0, 80); commit(); });
    body.addEventListener("input", () => { about.body = body.value.slice(0, 4000); commit(); });
    image.addEventListener("input", () => { about.image = image.value.trim().slice(0, 700); commit(); });

    upload.addEventListener("change", async () => {
      const f = upload.files && upload.files[0];
      if (!f) return;
      try {
        setStatus("Uploading…");
        const out = await apiUpload(f);
        about.image = out.url || "";
        image.value = about.image;
        setStatus("Uploaded.");
        commit();
      } catch (e) {
        setStatus(e.message || "Upload failed.");
      }
    });
  }

  // ===== Contact Inspector =====
  function renderContactInspector() {
    const contact = state.models.contact;
    if (!contact) return renderInspectorEmpty();
    contact.social = contact.social || {};

    $("inspectorBody").innerHTML = `
      <div class="section">
        <div class="section-title">Contact</div>

        <div class="control">
          <label>Heading</label>
          <input id="heading" type="text" />
        </div>

        <div class="control">
          <label>Intro text</label>
          <textarea id="intro"></textarea>
        </div>

        <div class="hr"></div>

        <div class="control">
          <label>Email</label>
          <input id="email" type="text" />
        </div>
        <div class="control">
          <label>Phone</label>
          <input id="phone" type="text" />
        </div>
        <div class="control">
          <label>Address</label>
          <textarea id="address"></textarea>
        </div>

        <div class="hr"></div>

        <div class="control">
          <label>Instagram</label>
          <input id="ig" type="text" placeholder="https://instagram.com/..." />
        </div>
        <div class="control">
          <label>TikTok</label>
          <input id="tt" type="text" placeholder="https://tiktok.com/..." />
        </div>
        <div class="control">
          <label>YouTube</label>
          <input id="yt" type="text" placeholder="https://youtube.com/..." />
        </div>
      </div>
    `;

    const heading = $("heading");
    const intro = $("intro");
    const email = $("email");
    const phone = $("phone");
    const address = $("address");
    const ig = $("ig");
    const tt = $("tt");
    const yt = $("yt");

    heading.value = contact.heading || "";
    intro.value = contact.intro || "";
    email.value = contact.email || "";
    phone.value = contact.phone || "";
    address.value = contact.address || "";
    ig.value = contact.social.instagram || "";
    tt.value = contact.social.tiktok || "";
    yt.value = contact.social.youtube || "";

    const commit = () => {
      markDirty("contact", true);
      postToPreview({ type: "applyContact", page: "contact", data: contact });
    };

    heading.addEventListener("input", () => { contact.heading = heading.value.slice(0, 80); commit(); });
    intro.addEventListener("input", () => { contact.intro = intro.value.slice(0, 2000); commit(); });
    email.addEventListener("input", () => { contact.email = email.value.slice(0, 140); commit(); });
    phone.addEventListener("input", () => { contact.phone = phone.value.slice(0, 80); commit(); });
    address.addEventListener("input", () => { contact.address = address.value.slice(0, 400); commit(); });
    ig.addEventListener("input", () => { contact.social.instagram = ig.value.slice(0, 400); commit(); });
    tt.addEventListener("input", () => { contact.social.tiktok = tt.value.slice(0, 400); commit(); });
    yt.addEventListener("input", () => { contact.social.youtube = yt.value.slice(0, 400); commit(); });
  }

  // ===== Messaging from iframe =====
  window.addEventListener("message", (ev) => {
    if (ev.origin !== window.location.origin) return;
    const data = ev.data || {};
    if (!data.__adminPreview) return;

    if (data.type === "select") {
      state.selection = { page: data.page, target: data.target };
      renderInspectorForSelection(state.selection);
      return;
    }

    if (data.type === "homeHeroHtml") {
      if (state.models.home) {
        state.models.home.heroHtml = String(data.heroHtml || "");
        markDirty("home", true);
      }
      return;
    }
  });

  async function loadAll() {
    setStatus("Loading…");
    const [home, products, about, contact] = await Promise.all([
      apiGet("home"),
      apiGet("products"),
      apiGet("about"),
      apiGet("contact")
    ]);

    state.models.home = home;
    state.models.products = products;
    state.models.about = about;
    state.models.contact = contact;

    state.dirty.home = false;
    state.dirty.products = false;
    state.dirty.about = false;
    state.dirty.contact = false;

    updateSaveButton();
    setStatus("Loaded.");
  }

  async function doSave() {
    const pages = ["home", "products", "about", "contact"];
    const dirtyPages = pages.filter((p) => state.dirty[p]);
    if (!dirtyPages.length) return;

    $("saveBtn").disabled = true;
    setStatus("Saving…");

    try {
      for (const p of dirtyPages) {
        await apiSave(p, state.models[p]);
        state.dirty[p] = false;
      }
      updateSaveButton();
      setStatus("Saved.");
    } catch (e) {
      setStatus(e.message || "Save failed.");
      updateSaveButton();
    } finally {
      updateSaveButton();
    }
  }

  // ===== UI events =====
  document.querySelectorAll(".nav-item").forEach((b) => {
    b.addEventListener("click", () => setPage(b.dataset.page));
  });

  $("saveBtn").addEventListener("click", doSave);

  $("reloadPreviewBtn").addEventListener("click", () => {
    const f = $("previewFrame");
    f.src = f.src;
    setStatus("Preview reloaded.");
  });

  $("resetSelectionBtn").addEventListener("click", () => {
    clearSelection();
    postToPreview({ type: "clearHighlight" });
  });

  $("closeInspectorBtn").addEventListener("click", () => clearSelection());

  $("logoutBtn").addEventListener("click", () => {
    state.locked = true;
    state.token = "";
    setToken("");
    updateLockUI();
    updateSaveButton();
    showModal("authModal", true);
    setAuthStatus("Logged out.");
    setStatus("");
  });

  $("loginBtn").addEventListener("click", async () => {
    const pw = $("passwordInput").value || "";
    if (!pw) return setAuthStatus("Enter password.");
    state.token = pw;
    state.locked = false;
    setToken(pw);
    $("passwordInput").value = "";
    setAuthStatus("");
    showModal("authModal", false);
    updateLockUI();

    try {
      await loadAll();
      setPage("home");
    } catch (e) {
      state.locked = true;
      state.token = "";
      setToken("");
      updateLockUI();
      showModal("authModal", true);
      setAuthStatus(e.message || "Login failed.");
    }
  });

  $("cancelLoginBtn").addEventListener("click", () => showModal("authModal", true));

  (function boot() {
    const tok = getToken();
    if (!tok) {
      state.locked = true;
      updateLockUI();
      showModal("authModal", true);
      renderInspectorEmpty();
      return;
    }

    state.token = tok;
    state.locked = false;
    updateLockUI();
    showModal("authModal", false);

    loadAll()
      .then(() => { setPage("home"); renderInspectorEmpty(); })
      .catch((e) => {
        state.locked = true;
        state.token = "";
        setToken("");
        updateLockUI();
        showModal("authModal", true);
        setAuthStatus(e.message || "Login failed.");
      });
  })();
})();
