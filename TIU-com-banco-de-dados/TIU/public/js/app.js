/* TIU — JavaScript puro
   Agora os dados (contas, avaliações, categorias, produtos, serviços,
   carrinho, compras e chats) ficam num banco de dados real (SQLite),
   acessado através da API em /api/*, servida por server/server.js.
   O tema (claro/escuro) continua salvo no localStorage por ser só
   uma preferência visual do navegador.
*/
(() => {
  "use strict";

  const API_BASE = "/api";
  const STORAGE_THEME = "tiu_theme";

  async function api(path, options = {}) {
    const opts = { credentials: "include", ...options };
    opts.headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) };
    const res = await fetch(API_BASE + path, opts);
    let data = null;
    try { data = await res.json(); } catch { /* sem corpo */ }
    if (!res.ok) throw Object.assign(new Error((data && data.error) || "Não foi possível concluir a ação."), { status: res.status, data });
    return data;
  }

  function $(selector, scope = document) { return scope.querySelector(selector); }
  function $all(selector, scope = document) { return [...scope.querySelectorAll(selector)]; }
  function escapeHTML(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char])); }
  function formatBRL(value) { return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function setMessage(element, text, type = "error") { if (!element) return; element.textContent = text; element.className = `form-message ${type}`; }

  // ---------------- sessão do usuário (cache por carregamento de página) ----------------
  let meCache = null;
  function currentUser() {
    if (!meCache) meCache = api("/auth/me").catch(() => null);
    return meCache;
  }

  let categoriesCache = null;
  function getCategories() {
    if (!categoriesCache) categoriesCache = api("/categories").catch(() => ({ serviceCategories: [], productCategories: [] }));
    return categoriesCache;
  }

  // ---------------- carrinho ----------------
  async function getCart() { try { return await api("/cart"); } catch { return []; } }
  function cartCount(cart) { return cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0); }
  function cartTotal(cart) { return cart.reduce((sum, item) => sum + Number(item.price || 0) * (Number(item.quantity) || 1), 0); }

  async function addToCart(product) {
    const user = await currentUser();
    if (!user) { location.href = `login.html?redirect=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`; return false; }
    if (product.ownerId && product.ownerId === user.id) return false;
    try { await api("/cart", { method: "POST", body: JSON.stringify({ productId: product.id }) }); await updateCartBadges(); return true; }
    catch { return false; }
  }

  async function updateCartBadges() {
    const user = await currentUser();
    const count = user ? cartCount(await getCart()) : 0;
    $all("[data-cart-count]").forEach(el => { el.textContent = count; el.classList.toggle("hidden", count === 0); });
  }

  // ---------------- tema (claro/escuro) ----------------
  function getTheme() { return localStorage.getItem(STORAGE_THEME) === "dark" ? "dark" : "light"; }
  function applyTheme(theme = getTheme()) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_THEME, theme);
    const button = $("#theme-toggle");
    if (button) { button.textContent = theme === "dark" ? "☀️ Modo claro" : "🌙 Modo escuro"; button.setAttribute("aria-pressed", String(theme === "dark")); }
  }
  function setupTheme() {
    applyTheme();
    updateCartBadges();
    $("#theme-toggle")?.addEventListener("click", () => applyTheme(getTheme() === "dark" ? "light" : "dark"));
  }

  function setupMenu() {
    const toggle = $(".menu-toggle"), nav = $("#main-nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => { const open = nav.classList.toggle("open"); toggle.setAttribute("aria-expanded", String(open)); });
    $all(".main-nav a, .main-nav button", nav).forEach(link => link.addEventListener("click", () => { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }));
  }

  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* segue mesmo se falhar */ }
    location.href = "index.html";
  }

  async function setupAuthNav() {
    const nav = $("#main-nav");
    if (!nav) return;
    const user = await currentUser();
    const login = $(".nav-login", nav), signup = $(".nav-signup", nav), divider = $(".nav-divider", nav);
    $(".nav-account", nav)?.remove(); $(".nav-logout", nav)?.remove();
    if (user) {
      login?.remove(); signup?.remove(); divider?.remove();
      const initials = user.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase();
      const account = document.createElement("a");
      account.className = "nav-account"; account.href = "dashboard.html"; account.setAttribute("aria-label", `Abrir painel de ${user.name}`);
      account.innerHTML = `<span class="nav-account-avatar" aria-hidden="true">${escapeHTML(initials || "U")}</span><span class="nav-account-name">${escapeHTML(user.name)}</span>`;
      nav.appendChild(account);
      const logoutBtn = document.createElement("button");
      logoutBtn.className = "nav-logout"; logoutBtn.type = "button"; logoutBtn.textContent = "Sair";
      logoutBtn.addEventListener("click", logout);
      nav.appendChild(logoutBtn);
    }
    if (!$("#cart-link", nav)) {
      const cartLink = document.createElement("a");
      cartLink.id = "cart-link"; cartLink.className = "nav-cart"; cartLink.href = "carrinho.html";
      cartLink.innerHTML = `🛒 Carrinho <span data-cart-count class="cart-badge hidden">0</span>`;
      nav.appendChild(cartLink);
    }
    if (!$("#theme-toggle", nav)) {
      const themeButton = document.createElement("button");
      themeButton.className = "nav-theme"; themeButton.id = "theme-toggle"; themeButton.type = "button";
      themeButton.addEventListener("click", () => applyTheme(getTheme() === "dark" ? "light" : "dark"));
      nav.appendChild(themeButton);
    }
    applyTheme();
    updateCartBadges();
  }

  // ---------------- cartões (templates) ----------------
  function professionalCard(p) {
    const avatar = p.hasCustomImage ? `<img src="${escapeHTML(p.image)}" alt="Ilustração de ${escapeHTML(p.name)}">` : escapeHTML(p.initials);
    return `<article class="professional-card"><div class="avatar ${p.id === "marcos" ? "avatar-orange" : ""}">${avatar}</div><div class="card-body"><div class="card-topline"><span class="badge purple">${escapeHTML(p.profession)}</span><span class="rating">★ ${Number(p.rating).toFixed(1)}</span></div><h3>${escapeHTML(p.name)}</h3><p class="location">⌖ ${escapeHTML(p.location)}</p><p>${escapeHTML(p.description)}</p><div class="card-footer"><span class="muted">${escapeHTML(p.experience)} de experiência</span><a class="text-link" href="perfil-profissional.html?id=${encodeURIComponent(p.id)}">Ver perfil →</a></div><button class="btn btn-primary btn-sm professional-contact-btn" type="button" data-professional-id="${escapeHTML(p.id)}">Entrar em contato</button></div></article>`;
  }

  function serviceCard(s) {
    return `<article class="service-card"><div class="service-card-icon">⚒</div><div class="service-card-body"><div class="card-topline"><span class="badge purple">${escapeHTML(s.category || "Serviço")}</span><span class="muted">${escapeHTML(s.location || "")}</span></div><h3>${escapeHTML(s.name)}</h3><strong class="price">${formatBRL(s.price)}${s.priceType === "a partir" ? " +" : ""}</strong><p>${escapeHTML(s.description)}</p><div class="card-footer"><span class="muted">${escapeHTML(s.ownerName || "Você")}</span><span class="text-link">Meu serviço ✓</span></div></div></article>`;
  }

  function productCard(p, user) {
    const visual = p.image ? `<img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}">` : `<span>${escapeHTML(p.icon || "▣")}</span>`;
    const own = !!(user && p.ownerId && p.ownerId === user.id);
    const actions = own
      ? `<div class="product-actions"><a class="btn btn-secondary btn-sm" href="produtos.html?produto=${encodeURIComponent(p.id)}">Gerenciar anúncio</a></div>`
      : `<div class="product-actions"><a class="btn btn-secondary btn-sm" href="produtos.html?produto=${encodeURIComponent(p.id)}">Ver produto</a><button class="btn btn-primary btn-sm add-cart-btn" type="button" data-product-id="${escapeHTML(p.id)}">＋ Carrinho</button></div>`;
    return `<article class="product-card"><a class="product-visual ${escapeHTML(p.tone || "purple")}" href="produtos.html?produto=${encodeURIComponent(p.id)}">${visual}<small>${escapeHTML(p.condition)}</small></a><div class="product-body"><div class="card-topline"><span class="badge orange">${escapeHTML(p.category)}</span><span class="muted">${escapeHTML(p.location)}</span></div><h3>${escapeHTML(p.name)}</h3><strong class="price">${formatBRL(p.price)}</strong><p>${escapeHTML(p.description)}</p><div class="card-footer"><span class="muted product-seller">Vendedor: ${escapeHTML(p.seller)}</span>${actions}</div></div></article>`;
  }

  function toNode(html) { const t = document.createElement("template"); t.innerHTML = html; return t.content.firstElementChild; }

  function attachAddToCart(scope) {
    $all(".add-cart-btn", scope).forEach(btn => btn.addEventListener("click", async () => {
      try {
        const product = await api(`/products/${encodeURIComponent(btn.dataset.productId)}`);
        if (await addToCart(product)) { btn.textContent = "✓ Adicionado"; setTimeout(() => (btn.textContent = "＋ Carrinho"), 1200); }
      } catch { /* produto pode ter sido removido */ }
    }));
  }

  // ---------------- páginas ----------------
  async function initHome() {
    const [professionalsList, allProducts, user] = await Promise.all([
      api("/professionals?limit=4").catch(() => []),
      api("/products?limit=4").catch(() => []),
      currentUser()
    ]);
    $("#home-professionals")?.replaceChildren(...professionalsList.map(p => toNode(professionalCard(p))));
    $("#home-products")?.replaceChildren(...allProducts.map(p => toNode(productCard(p, user))));
    attachAddToCart(document);
    const form = $("#home-search");
    form?.addEventListener("submit", async event => {
      event.preventDefault();
      const query = $("#home-search-input").value.trim();
      if (!query) return void (location.href = "profissionais.html");
      const all = await api("/professionals").catch(() => []);
      const found = all.some(p => `${p.name} ${p.profession}`.toLowerCase().includes(query.toLowerCase()));
      location.href = `${found ? "profissionais.html" : "produtos.html"}?busca=${encodeURIComponent(query)}`;
    });
  }

  async function initProfessionals() {
    const list = $("#professionals-list"); if (!list) return;
    const search = $("#professional-search"), category = $("#professional-category"), count = $("#professional-count"), empty = $("#professionals-empty");
    const params = new URLSearchParams(location.search); if (params.get("busca")) search.value = params.get("busca");
    const available = await api("/professionals").catch(() => []);
    const render = () => {
      const q = search.value.trim().toLowerCase(), cat = category.value.toLowerCase();
      const filtered = available.filter(p => {
        const text = `${p.name} ${p.profession} ${(p.categories || []).join(" ")} ${p.location} ${p.description}`.toLowerCase();
        return (!q || text.includes(q)) && (!cat || [p.profession, ...(p.categories || [])].some(c => String(c).toLowerCase() === cat));
      });
      list.innerHTML = filtered.map(professionalCard).join("");
      count.textContent = `${filtered.length} profissional${filtered.length === 1 ? "" : "is"}`;
      empty.classList.toggle("hidden", filtered.length !== 0);
      $all(".professional-contact-btn", list).forEach(btn => btn.addEventListener("click", () => openChatForProfessional(available.find(p => p.id === btn.dataset.professionalId))));
    };
    search.addEventListener("input", render); category.addEventListener("change", render); render();
  }

  function sellerDisplayName(product) { return product.seller || "Vendedor"; }
  function getSellerId(product) { return product.ownerId || `seller-${product.id}`; }

  async function openChatForProduct(product) {
    const user = await currentUser();
    if (!user) { location.href = `login.html?redirect=${encodeURIComponent(`chat.html?produto=${product.id}`)}`; return; }
    if (product.ownerId && product.ownerId === user.id) return;
    const chat = await api("/chats", { method: "POST", body: JSON.stringify({ sellerId: getSellerId(product), sellerName: sellerDisplayName(product), productId: product.id, productName: product.name }) });
    location.href = `chat.html?chat=${encodeURIComponent(chat.id)}`;
  }

  async function openChatForProfessional(professional) {
    const user = await currentUser();
    if (!professional) return;
    if (!user) { location.href = `login.html?redirect=${encodeURIComponent(`chat.html?profissional=${professional.id}`)}`; return; }
    if (professional.id === user.id) return;
    const chat = await api("/chats", { method: "POST", body: JSON.stringify({ sellerId: professional.id, sellerName: professional.name, professionalId: professional.id, productId: null, productName: "Atendimento profissional" }) });
    location.href = `chat.html?chat=${encodeURIComponent(chat.id)}`;
  }

  async function completeSimulatedPurchase(product, paymentMethod, cardData) {
    try {
      await api("/cart", { method: "POST", body: JSON.stringify({ productId: product.id }) });
      await api("/checkout", { method: "POST", body: JSON.stringify({ paymentMethod, card: cardData }) });
      $("#payment-modal")?.remove();
      setMessage($("#product-action-message"), `Compra simulada registrada! Pagamento escolhido: ${paymentMethod === "pix" ? "PIX" : "Cartão"}.`, "success");
      updateCartBadges();
    } catch (err) {
      setMessage($("#payment-modal-message") || $("#product-action-message"), err.message);
    }
  }

  function openPaymentModal(product) {
    if ($("#payment-modal")) return;
    const modal = document.createElement("div");
    modal.id = "payment-modal"; modal.className = "modal-backdrop";
    modal.innerHTML = `<div class="modal-card payment-modal-card" role="dialog" aria-modal="true" aria-labelledby="payment-title">
      <div class="modal-header"><div><span class="eyebrow">COMPRA SIMULADA</span><h2 id="payment-title">Finalizar compra</h2></div><button class="modal-close" id="close-payment" type="button" aria-label="Fechar">×</button></div>
      <div class="payment-summary"><div><strong>${escapeHTML(product.name)}</strong><span>Vendedor: ${escapeHTML(sellerDisplayName(product))}</span></div><strong class="payment-total">${formatBRL(product.price)}</strong></div>
      <div class="payment-section"><label class="payment-label">Escolha a forma de pagamento</label><div class="payment-options">
        <label class="payment-option"><input type="radio" name="payment-method" value="pix" checked><span><strong>PIX</strong><small>Pagamento por QR Code</small></span></label>
        <label class="payment-option"><input type="radio" name="payment-method" value="card"><span><strong>Cartão</strong><small>Simulação de pagamento</small></span></label>
      </div></div>
      <div id="pix-payment" class="pix-payment"><div class="pix-placeholder"><strong>QR CODE DO TIU</strong><span>Substitua esta imagem pelo QR Code PIX que você quiser usar.</span></div><p>Após colocar seu QR Code, ele aparecerá aqui quando o cliente escolher PIX.</p></div>
      <div id="card-payment" class="card-payment hidden"><div class="form-row"><div class="form-field"><label for="sim-card-name">Nome no cartão</label><input id="sim-card-name" placeholder="Nome do comprador"></div><div class="form-field"><label for="sim-card-number">Número</label><input id="sim-card-number" inputmode="numeric" maxlength="19" placeholder="0000 0000 0000 0000"></div></div><div class="form-row"><div class="form-field"><label for="sim-card-date">Validade</label><input id="sim-card-date" maxlength="5" placeholder="MM/AA"></div><div class="form-field"><label for="sim-card-cvv">CVV</label><input id="sim-card-cvv" inputmode="numeric" maxlength="4" placeholder="123"></div></div><small class="payment-note">Os dados acima são apenas demonstrativos e não são enviados para nenhum servidor externo.</small></div>
      <div class="form-message" id="payment-modal-message"></div>
      <div class="payment-actions"><button class="btn btn-secondary" id="cancel-payment" type="button">Cancelar</button><button class="btn btn-primary" id="confirm-payment" type="button">Confirmar compra simulada</button></div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    $("#close-payment").addEventListener("click", close);
    $("#cancel-payment").addEventListener("click", close);
    modal.addEventListener("click", e => { if (e.target === modal) close(); });
    $all('input[name="payment-method"]', modal).forEach(input => input.addEventListener("change", () => {
      const isPix = $("input[name=payment-method]:checked", modal).value === "pix";
      $("#pix-payment", modal).classList.toggle("hidden", !isPix);
      $("#card-payment", modal).classList.toggle("hidden", isPix);
    }));
    $("#confirm-payment").addEventListener("click", () => {
      const method = $("input[name=payment-method]:checked", modal).value;
      let cardData;
      if (method === "card") {
        const name = $("#sim-card-name").value.trim(), number = $("#sim-card-number").value.replace(/\D/g, "");
        if (!name || number.length < 12) return setMessage($("#payment-modal-message"), "Preencha os dados do cartão para continuar a simulação.");
        cardData = { name, number };
      }
      completeSimulatedPurchase(product, method, cardData);
    });
  }

  async function simulatePurchase(product) {
    const user = await currentUser();
    if (!user) { location.href = `login.html?redirect=${encodeURIComponent(`produtos.html?produto=${product.id}`)}`; return; }
    if (product.ownerId && product.ownerId === user.id) return;
    openPaymentModal(product);
  }

  function renderProductEditModal(product) {
    if ($("#product-edit-modal")) return;
    const modal = document.createElement("div");
    modal.id = "product-edit-modal"; modal.className = "modal-backdrop";
    modal.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="product-edit-title">
      <div class="modal-header"><div><span class="eyebrow">MEU ANÚNCIO</span><h2 id="product-edit-title">Editar produto</h2></div><button class="modal-close" id="close-product-edit" type="button" aria-label="Fechar">×</button></div>
      <form id="product-edit-form">
        <div class="form-row"><div class="form-field"><label for="edit-product-name">Nome</label><input id="edit-product-name" required></div><div class="form-field"><label for="edit-product-price">Preço (R$)</label><input id="edit-product-price" type="number" min="0" step="0.01" required></div></div>
        <div class="form-row"><div class="form-field"><label for="edit-product-category">Categoria</label><select id="edit-product-category" required><option>Celulares</option><option>Notebooks</option><option>Ferramentas</option><option>Câmeras</option><option>Consoles</option><option>Móveis</option><option>Vintage</option><option>Outros</option></select></div><div class="form-field"><label for="edit-product-condition">Condição</label><select id="edit-product-condition" required><option>Novo</option><option>Usado</option><option>Seminovo</option><option>Vintage</option><option>Restaurado</option></select></div></div>
        <div class="form-field"><label for="edit-product-location">Localização</label><input id="edit-product-location" required></div>
        <div class="form-field"><label for="edit-product-description">Descrição</label><textarea id="edit-product-description" rows="5" required></textarea></div>
        <div class="form-message" id="product-edit-message"></div>
        <button class="btn btn-primary btn-block" type="submit">Salvar alterações</button>
      </form>
    </div>`;
    document.body.appendChild(modal);
    $("#edit-product-name").value = product.name || "";
    $("#edit-product-price").value = product.price ?? "";
    $("#edit-product-category").value = product.category || "Outros";
    $("#edit-product-condition").value = product.condition || "Usado";
    $("#edit-product-location").value = product.location || "";
    $("#edit-product-description").value = product.description || "";
    const close = () => modal.remove();
    $("#close-product-edit").addEventListener("click", close);
    modal.addEventListener("click", e => { if (e.target === modal) close(); });
    $("#product-edit-form").addEventListener("submit", async e => {
      e.preventDefault();
      try {
        await api(`/products/${encodeURIComponent(product.id)}`, {
          method: "PUT",
          body: JSON.stringify({
            name: $("#edit-product-name").value.trim(),
            price: Number($("#edit-product-price").value),
            category: $("#edit-product-category").value,
            condition: $("#edit-product-condition").value,
            location: $("#edit-product-location").value.trim(),
            description: $("#edit-product-description").value.trim()
          })
        });
        location.reload();
      } catch (err) { setMessage($("#product-edit-message"), err.message); }
    });
  }

  async function initProducts() {
    const list = $("#products-list"); if (!list) return;
    const search = $("#product-search"), category = $("#product-category"), condition = $("#product-condition"), count = $("#product-count"), empty = $("#products-empty");
    const params = new URLSearchParams(location.search); if (params.get("busca") && search) search.value = params.get("busca");
    const detailId = params.get("produto");

    if (detailId) {
      let product;
      try { product = await api(`/products/${encodeURIComponent(detailId)}`); } catch { product = null; }
      if (product) {
        const owner = await currentUser();
        const own = owner && product.ownerId === owner.id;
        list.classList.add("product-detail-grid");
        const visual = product.image ? `<img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}">` : `<span>${escapeHTML(product.icon || "▣")}</span>`;
        list.innerHTML = `<article class="product-detail"><div class="product-detail-visual ${escapeHTML(product.tone || "purple")}">${visual}<small>${escapeHTML(product.condition)}</small></div><div class="product-detail-copy"><a class="back-link" href="produtos.html">← Voltar ao marketplace</a><span class="eyebrow">DETALHE DO PRODUTO</span><h1>${escapeHTML(product.name)}</h1><div class="detail-price">${formatBRL(product.price)}</div><div class="detail-meta"><span class="badge orange">${escapeHTML(product.condition)}</span><span>${escapeHTML(product.category)}</span><span>⌖ ${escapeHTML(product.location)}</span></div><p>${escapeHTML(product.description)}</p><div class="seller-box"><strong>Vendedor</strong><span>${escapeHTML(product.seller)}</span><small>${own ? "Este anúncio pertence à sua conta." : "Contato e compra demonstrativos pelo TIU."}</small></div><div class="product-actions">${own ? `<button class="btn btn-secondary" id="edit-my-product" type="button">Editar anúncio</button><button class="btn btn-secondary danger-button" id="delete-my-product" type="button">Excluir anúncio</button>` : `<button class="btn btn-primary" type="button" id="buy-product">Comprar agora</button><button class="btn btn-secondary" type="button" id="add-product-cart">＋ Adicionar ao carrinho</button><button class="btn btn-secondary" type="button" id="contact-product">Entrar em contato</button>`}</div><div class="form-message" id="product-action-message"></div></div></article>`;
        count.textContent = "1 produto"; empty.classList.add("hidden");
        $("#buy-product")?.addEventListener("click", () => simulatePurchase(product));
        $("#add-product-cart")?.addEventListener("click", async () => { if (await addToCart(product)) setMessage($("#product-action-message"), "Produto adicionado ao carrinho.", "success"); });
        $("#contact-product")?.addEventListener("click", () => openChatForProduct(product));
        $("#edit-my-product")?.addEventListener("click", async () => {
          const user = await currentUser();
          if (!user || product.ownerId !== user.id) return setMessage($("#product-action-message"), "Você não tem permissão para editar este anúncio.");
          renderProductEditModal(product);
        });
        $("#delete-my-product")?.addEventListener("click", async () => {
          const user = await currentUser();
          if (!user || product.ownerId !== user.id) return setMessage($("#product-action-message"), "Você não tem permissão para excluir este anúncio.");
          if (!confirm("Excluir este anúncio?")) return;
          try { await api(`/products/${encodeURIComponent(product.id)}`, { method: "DELETE" }); location.href = "dashboard.html"; }
          catch (err) { setMessage($("#product-action-message"), err.message); }
        });
        return;
      }
    }

    const all = await api("/products").catch(() => []);
    const user = await currentUser();
    const render = () => {
      const q = search.value.trim().toLowerCase(), cat = category.value.toLowerCase(), cond = condition.value.toLowerCase();
      const filtered = all.filter(p => {
        const text = `${p.name} ${p.category} ${p.seller} ${p.location} ${p.description}`.toLowerCase();
        return (!q || text.includes(q)) && (!cat || p.category.toLowerCase() === cat) && (!cond || p.condition.toLowerCase() === cond);
      });
      list.innerHTML = filtered.map(p => productCard(p, user)).join("");
      count.textContent = `${filtered.length} produto${filtered.length === 1 ? "" : "s"}`;
      empty.classList.toggle("hidden", filtered.length !== 0);
      attachAddToCart(list);
    };
    search.addEventListener("input", render); category.addEventListener("change", render); condition.addEventListener("change", render); render();
  }

  async function initChat() {
    const list = $("#chat-list"), messagesEl = $("#chat-messages"), form = $("#chat-form");
    if (!list || !messagesEl || !form) return;
    const user = await currentUser();
    if (!user) { location.href = `login.html?redirect=${encodeURIComponent(location.pathname.split("/").pop() + location.search)}`; return; }
    const params = new URLSearchParams(location.search);
    let activeId = params.get("chat");
    const requestedProduct = params.get("produto"), requestedProfessional = params.get("profissional");

    if (requestedProfessional) {
      try { const professional = await api(`/professionals/${encodeURIComponent(requestedProfessional)}`);
        const chat = await api("/chats", { method: "POST", body: JSON.stringify({ sellerId: professional.id, sellerName: professional.name, professionalId: professional.id, productId: null, productName: "Atendimento profissional" }) });
        activeId = chat.id;
      } catch { /* ignora */ }
    }
    if (requestedProduct) {
      try { const product = await api(`/products/${encodeURIComponent(requestedProduct)}`);
        if (!(product.ownerId && product.ownerId === user.id)) {
          const chat = await api("/chats", { method: "POST", body: JSON.stringify({ sellerId: getSellerId(product), sellerName: sellerDisplayName(product), productId: product.id, productName: product.name }) });
          activeId = chat.id;
        }
      } catch { /* ignora */ }
    }

    const render = async () => {
      const chats = await api("/chats").catch(() => []);
      list.innerHTML = chats.length ? chats.map(c => `<button class="chat-list-item ${c.id === activeId ? "active" : ""}" type="button" data-chat-id="${escapeHTML(c.id)}"><strong>${escapeHTML(c.seller)}</strong><span>${escapeHTML(c.product)}</span><small>${escapeHTML(c.messages.at(-1)?.text || "Nova conversa")}</small></button>`).join("") : `<div class="chat-empty-list">Nenhuma conversa iniciada.</div>`;
      $all(".chat-list-item", list).forEach(btn => btn.addEventListener("click", async () => { activeId = btn.dataset.chatId; await render(); await renderMessages(); }));
    };
    const renderMessages = async () => {
      const chats = await api("/chats").catch(() => []);
      const chat = chats.find(c => c.id === activeId);
      if (!chat) { messagesEl.innerHTML = `<div class="chat-placeholder"><strong>Selecione uma conversa</strong><span>Entre em contato com um vendedor pelo Marketplace.</span></div>`; $("#chat-title").textContent = "Conversas"; $("#chat-product").textContent = ""; return; }
      $("#chat-title").textContent = chat.seller; $("#chat-product").textContent = chat.product;
      messagesEl.innerHTML = chat.messages.length ? chat.messages.map(m => `<div class="chat-message ${m.sender === "me" ? "mine" : "theirs"}"><div>${escapeHTML(m.text)}</div><time>${escapeHTML(m.time)}</time></div>`).join("") : `<div class="chat-placeholder"><strong>Inicie a conversa</strong><span>Envie uma mensagem sobre o produto.</span></div>`;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const input = $("#chat-input"), text = input.value.trim();
      if (!text || !activeId) return;
      input.value = "";
      try { await api(`/chats/${encodeURIComponent(activeId)}/messages`, { method: "POST", body: JSON.stringify({ text }) }); }
      catch { /* ignora falha pontual */ }
      await render(); await renderMessages();
    });
    await render(); await renderMessages();
  }

  async function initProfile() {
    const target = $("#profile-detail"); if (!target) return;
    const id = new URLSearchParams(location.search).get("id") || "joao";
    const [p, categories] = await Promise.all([
      api(`/professionals/${encodeURIComponent(id)}`).catch(() => null),
      getCategories()
    ]);
    if (!p) { target.innerHTML = `<p class="muted">Profissional não encontrado.</p>`; return; }
    const serviceCategories = categories.serviceCategories || [];
    target.innerHTML = `<a class="back-link" href="profissionais.html">← Voltar para profissionais</a><div class="profile-card"><div class="profile-top"><div class="profile-avatar ${p.id === "marcos" ? "avatar-orange" : ""}">${p.hasCustomImage ? `<img src="${escapeHTML(p.image)}" alt="Ilustração de ${escapeHTML(p.name)}">` : escapeHTML(p.initials || "P")}</div><div class="profile-main"><span class="badge purple">${escapeHTML(p.profession)}</span><h1>${escapeHTML(p.name)}</h1><p class="profile-location">⌖ ${escapeHTML(p.location)} · ★ ${Number(p.rating).toFixed(1)} (${p.reviewCount} avaliações)</p><p>${escapeHTML(p.description)}</p><button class="btn btn-primary" id="contact-professional" type="button">Entrar em contato</button><div class="form-message" id="profile-message"></div></div></div><div class="profile-info-grid"><div class="info-panel"><span>Experiência</span><strong>${escapeHTML(p.experience || "Não informada")}</strong></div><div class="info-panel"><span>Avaliação</span><strong>★ ${Number(p.rating).toFixed(1)} / 5</strong></div><div class="info-panel"><span>Localização</span><strong>${escapeHTML(p.location)}</strong></div></div><div class="profile-description"><span class="eyebrow">SOBRE O PROFISSIONAL</span><h2>Serviços oferecidos</h2><div class="tag-list">${(p.services || []).map(x => `<span>${escapeHTML(x)}</span>`).join("")}</div></div><section class="profile-reviews"><div class="card-title"><h2>Avaliações e comentários</h2><p>Veja a experiência de outros clientes.</p></div><div class="review-filter-row"><label for="review-category-filter">Filtrar avaliações</label><select id="review-category-filter"><option value="">Todas as categorias</option>${serviceCategories.map(c => `<option>${escapeHTML(c)}</option>`).join("")}</select></div><div id="review-list" class="review-list"></div><form id="review-form" class="review-form"><h3>Deixe sua avaliação</h3><p class="muted">Sua opinião ajuda outras pessoas a conhecerem este profissional.</p><div class="form-field"><label for="review-stars">Nota</label><select id="review-stars" required><option value="">Selecione as estrelas</option><option value="5">★★★★★ — 5 estrelas</option><option value="4">★★★★☆ — 4 estrelas</option><option value="3">★★★☆☆ — 3 estrelas</option><option value="2">★★☆☆☆ — 2 estrelas</option><option value="1">★☆☆☆☆ — 1 estrela</option></select></div><div class="form-field"><label for="review-category">Categoria do serviço avaliado</label><select id="review-category" required><option value="">Selecione uma categoria</option>${serviceCategories.map(c => `<option>${escapeHTML(c)}</option>`).join("")}</select></div><div class="form-field"><label for="review-comment">Comentário</label><textarea id="review-comment" rows="3" maxlength="700" required placeholder="Conte como foi sua experiência..."></textarea></div><button class="btn btn-primary" type="submit">Enviar avaliação</button><div class="form-message" id="review-message" role="alert"></div></form></section></div>`;

    const renderReviews = async () => {
      const cat = $("#review-category-filter").value;
      const reviews = await api(`/reviews?professionalId=${encodeURIComponent(p.id)}${cat ? `&category=${encodeURIComponent(cat)}` : ""}`).catch(() => []);
      $("#review-list").innerHTML = reviews.length ? reviews.map(r => `<article class="review-item"><div class="review-item-head"><strong>${escapeHTML(r.authorName)}</strong><span class="rating">${"★".repeat(Number(r.stars))}${"☆".repeat(5 - Number(r.stars))}</span></div><span class="badge purple">${escapeHTML(r.category)}</span><p>${escapeHTML(r.comment)}</p><small class="muted">${new Date(r.createdAt).toLocaleDateString("pt-BR")}</small></article>`).join("") : '<p class="muted">Ainda não há avaliações nesta categoria.</p>';
    };
    $("#review-category-filter").addEventListener("change", renderReviews); renderReviews();

    $("#review-form").addEventListener("submit", async e => {
      e.preventDefault();
      const user = await currentUser();
      if (!user) { location.href = `login.html?redirect=${encodeURIComponent(`perfil-profissional.html?id=${p.id}`)}`; return; }
      const stars = Number($("#review-stars").value), category = $("#review-category").value, comment = $("#review-comment").value.trim();
      if (!stars || !category || !comment) return setMessage($("#review-message"), "Preencha a nota, a categoria e o comentário.");
      try {
        await api("/reviews", { method: "POST", body: JSON.stringify({ professionalId: p.id, stars, category, comment }) });
        setMessage($("#review-message"), "Avaliação publicada!", "success");
        $("#review-form").reset(); await renderReviews();
      } catch (err) { setMessage($("#review-message"), err.message); }
    });
    $("#contact-professional")?.addEventListener("click", () => openChatForProfessional(p));
  }

  function initForgotPassword() {
    const form = $("#forgot-password-form"); if (!form) return;
    const message = $("#forgot-message");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const email = $("#forgot-email").value.trim().toLowerCase(), password = $("#forgot-password").value, confirm = $("#forgot-password-confirm").value;
      try {
        await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email, password, confirm }) });
        setMessage(message, "Senha alterada com sucesso! Você já pode entrar com a nova senha.", "success");
        setTimeout(() => (location.href = "login.html"), 900);
      } catch (err) { setMessage(message, err.message); }
    });
  }

  function initLogin() {
    const form = $("#login-form"); if (!form) return;
    const message = $("#login-message");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const email = $("#login-email").value.trim().toLowerCase(), password = $("#login-password").value;
      try {
        await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
        const redirect = new URLSearchParams(location.search).get("redirect");
        location.href = redirect || "dashboard.html";
      } catch (err) { setMessage(message, err.message); }
    });
    $("#fill-demo")?.addEventListener("click", () => { $("#login-email").value = "demo@tiu.com"; $("#login-password").value = "123456"; setMessage(message, "Dados da conta demo preenchidos.", "success"); });
  }

  async function initSignup() {
    const form = $("#signup-form"); if (!form) return;
    const typeButtons = $all(".account-type"), typeInput = $("#signup-type"), professionalFields = $("#professional-fields"), message = $("#signup-message");
    const params = new URLSearchParams(location.search), editing = params.get("editar") === "1";
    const editingUser = editing ? await currentUser() : null;
    if (editing && !editingUser) { location.href = "login.html"; return; }
    const initialType = editingUser?.type || (params.get("tipo") === "profissional" ? "profissional" : "cliente");
    const setType = type => { typeInput.value = type; typeButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.type === type)); professionalFields.classList.toggle("hidden", type !== "profissional"); $all("#professional-fields input, #professional-fields textarea, #professional-fields select").forEach(field => (field.required = type === "profissional" && field.id !== "signup-category-placeholder")); };
    typeButtons.forEach(btn => btn.addEventListener("click", () => { if (!editing) setType(btn.dataset.type); }));
    setType(initialType);
    if (editingUser) {
      $(".auth-heading h1").textContent = "Editar meu perfil"; $(".auth-heading p").textContent = "Atualize suas informações e mantenha seu perfil profissional em dia.";
      $("#signup-name").value = editingUser.name || ""; $("#signup-location").value = editingUser.location || ""; $("#signup-email").value = editingUser.email || "";
      $("#signup-password").value = ""; $("#signup-password").placeholder = "Deixe em branco para manter a senha atual";
      $("#signup-profession").value = editingUser.profession || ""; $("#signup-area").value = editingUser.area || "";
      $("#signup-experience").value = editingUser.experience || ""; $("#signup-description").value = editingUser.description || "";
      $all("#signup-categories input").forEach(cb => (cb.checked = (editingUser.categories || []).includes(cb.value)));
      $("#signup-submit").textContent = "Salvar alterações"; typeButtons.forEach(btn => (btn.disabled = true));
    }
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const name = $("#signup-name").value.trim(), locationValue = $("#signup-location").value.trim(), email = $("#signup-email").value.trim().toLowerCase(), password = $("#signup-password").value, type = typeInput.value;
      if (!name || !locationValue || !email || (!editingUser && !password)) return setMessage(message, "Preencha todos os campos obrigatórios.");
      if (password && password.length < 6) return setMessage(message, "A senha precisa ter pelo menos 6 caracteres.");
      const categories = $all("#signup-categories input:checked").map(cb => cb.value);
      const data = { name, location: locationValue, email, categories, profession: $("#signup-profession")?.value.trim() || "", area: $("#signup-area")?.value.trim() || "", experience: $("#signup-experience")?.value.trim() || "", description: $("#signup-description")?.value.trim() || "" };
      try {
        if (editingUser) {
          if (password) data.password = password;
          await api("/auth/me", { method: "PUT", body: JSON.stringify(data) });
          setMessage(message, "Perfil atualizado com sucesso!", "success");
          setTimeout(() => (location.href = "dashboard.html"), 700);
        } else {
          await api("/auth/register", { method: "POST", body: JSON.stringify({ ...data, password, type }) });
          location.href = "dashboard.html";
        }
      } catch (err) { setMessage(message, err.message); }
    });
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) return reject();
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 1000, scale = Math.min(1, max / img.width, max / img.height), canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        img.onerror = reject; img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function initAddProduct() {
    const form = $("#product-form"); if (!form) return;
    const user = await currentUser(); if (!user) { location.href = "login.html?redirect=adicionar-produto.html"; return; }
    $("#product-seller").value = user.name; $("#product-location").value = user.location || "";
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const message = $("#product-form-message");
      const name = $("#product-name").value.trim(), price = Number($("#product-price").value), category = $("#product-category").value, condition = $("#product-condition").value, locationValue = $("#product-location").value.trim(), description = $("#product-description").value.trim();
      if (!name || !price || price < 0 || !category || !condition || !locationValue || !description) return setMessage(message, "Preencha todos os campos obrigatórios.");
      let image = ""; const file = $("#product-image").files[0];
      if (file) { try { image = await resizeImage(file); } catch { return setMessage(message, "Não foi possível processar a imagem. Tente outra foto."); } }
      try {
        const item = await api("/products", { method: "POST", body: JSON.stringify({ name, price, category, condition, location: locationValue, description, image }) });
        location.href = `produtos.html?produto=${encodeURIComponent(item.id)}`;
      } catch (err) { setMessage(message, err.message); }
    });
  }

  async function initAddService() {
    const form = $("#service-form"); if (!form) return;
    const user = await currentUser(); if (!user) { location.href = "login.html?redirect=adicionar-servico.html"; return; }
    if (user.type !== "profissional") { location.href = "adicionar-produto.html"; return; }
    $("#service-owner").value = user.name; $("#service-location").value = user.location || "";
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const message = $("#service-form-message");
      const name = $("#service-name").value.trim(), price = Number($("#service-price").value), category = $("#service-category").value, priceType = $("#service-price-type").value, locationValue = $("#service-location").value.trim(), description = $("#service-description").value.trim();
      if (!name || !price || price < 0 || !category || !locationValue || !description) return setMessage(message, "Preencha todos os campos obrigatórios.");
      try {
        await api("/services", { method: "POST", body: JSON.stringify({ name, price, category, priceType, location: locationValue, description }) });
        location.href = "dashboard.html";
      } catch (err) { setMessage(message, err.message); }
    });
  }

  async function initDashboard() {
    const user = await currentUser(); if (!user) { location.href = "login.html"; return; }
    $("#dashboard-name").textContent = user.name.split(" ")[0];
    $("#account-name").textContent = user.name;
    $("#account-location").textContent = user.location || "Não informado";
    $("#dashboard-avatar").textContent = user.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
    $("#account-type").textContent = user.type === "profissional" ? "Profissional" : "Cliente";
    const isProfessional = user.type === "profissional";
    $("#account-profession-wrap").classList.toggle("hidden", !isProfessional);
    $("#account-profession").textContent = [user.profession, user.area, ...(user.categories || [])].filter(Boolean).join(", ") || "Não informado";
    $("#client-dashboard").classList.toggle("hidden", isProfessional);
    $("#professional-dashboard").classList.toggle("hidden", !isProfessional);

    const myProducts = await api(`/products?ownerId=${encodeURIComponent(user.id)}`).catch(() => []);
    if ($("#my-products-count")) $("#my-products-count").textContent = myProducts.length;
    $("#my-products-list")?.replaceChildren(...myProducts.map(p => toNode(productCard(p, user))));
    $("#my-products-empty")?.classList.toggle("hidden", myProducts.length !== 0);

    if (isProfessional) {
      $("#summary-profession").textContent = user.profession || "Não informado";
      $("#summary-area").textContent = user.area || "Não informado";
      $("#summary-experience").textContent = user.experience || "Não informado";
      $("#summary-description").textContent = user.description || "Ainda não preenchida.";
      const myServices = await api(`/services?ownerId=${encodeURIComponent(user.id)}`).catch(() => []);
      $("#my-services-count").textContent = myServices.length;
      $("#my-professional-products-count").textContent = myProducts.length;
      $("#my-services-list")?.replaceChildren(...myServices.map(s => toNode(serviceCard(s))));
      $("#my-services-empty")?.classList.toggle("hidden", myServices.length !== 0);
      $("#professional-products-list")?.replaceChildren(...myProducts.map(p => toNode(productCard(p, user))));
      $("#professional-products-empty")?.classList.toggle("hidden", myProducts.length !== 0);
    }
    $("#dashboard-logout")?.addEventListener("click", logout); $("#nav-logout")?.addEventListener("click", logout); $("#footer-logout")?.addEventListener("click", logout);
  }

  async function initCart() {
    const list = $("#cart-items"), totalEl = $("#cart-total"), empty = $("#cart-empty"), checkout = $("#cart-checkout"); if (!list) return;
    const user = await currentUser();
    if (!user) { location.href = "login.html?redirect=carrinho.html"; return; }
    const render = async () => {
      const cart = await getCart();
      list.innerHTML = cart.map(item => `<article class="cart-item"><div class="cart-item-visual ${escapeHTML(item.tone || "purple")}">${item.image ? `<img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}">` : "▣"}</div><div class="cart-item-info"><strong>${escapeHTML(item.name)}</strong><span>Vendedor: ${escapeHTML(item.seller)}</span><div class="cart-item-controls"><button type="button" data-action="minus" data-id="${escapeHTML(item.id)}">−</button><b>${Number(item.quantity) || 1}</b><button type="button" data-action="plus" data-id="${escapeHTML(item.id)}">+</button><button type="button" class="cart-remove" data-action="remove" data-id="${escapeHTML(item.id)}">Remover</button></div></div><strong class="cart-item-price">${formatBRL(Number(item.price) * (Number(item.quantity) || 1))}</strong></article>`).join("");
      totalEl.textContent = formatBRL(cartTotal(cart)); empty.classList.toggle("hidden", cart.length !== 0); checkout.classList.toggle("hidden", cart.length === 0); updateCartBadges();
    };
    list.addEventListener("click", async e => {
      const btn = e.target.closest("button[data-action]"); if (!btn) return;
      const id = btn.dataset.id, action = btn.dataset.action;
      if (action === "remove") await api(`/cart/${encodeURIComponent(id)}`, { method: "DELETE" });
      else {
        const cart = await getCart(); const item = cart.find(x => x.id === id); if (!item) return;
        const quantity = action === "plus" ? (Number(item.quantity) || 1) + 1 : Math.max(1, (Number(item.quantity) || 1) - 1);
        await api(`/cart/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ quantity }) });
      }
      await render();
    });
    checkout.addEventListener("click", () => (location.href = "checkout.html"));
    await render();
  }

  async function initCheckout() {
    const list = $("#checkout-items"), totalEl = $("#checkout-total"), form = $("#checkout-form"); if (!list || !form) return;
    const user = await currentUser();
    if (!user) { location.href = "login.html?redirect=checkout.html"; return; }
    const cart = await getCart();
    if (!cart.length) { location.href = "carrinho.html"; return; }
    list.innerHTML = cart.map(item => `<div class="checkout-line"><span>${escapeHTML(item.name)} <small>× ${Number(item.quantity) || 1}</small></span><strong>${formatBRL(Number(item.price) * (Number(item.quantity) || 1))}</strong></div>`).join("");
    totalEl.textContent = formatBRL(cartTotal(cart));
    const pix = $("#checkout-pix"), card = $("#checkout-card");
    $all('input[name="checkout-payment"]', form).forEach(input => input.addEventListener("change", () => { const isPix = $("input[name=checkout-payment]:checked", form).value === "pix"; pix.classList.toggle("hidden", !isPix); card.classList.toggle("hidden", isPix); }));
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const method = $("input[name=checkout-payment]:checked", form).value;
      let cardData;
      if (method === "card") {
        const name = $("#checkout-card-name").value.trim(), number = $("#checkout-card-number").value.replace(/\D/g, "");
        if (!name || number.length < 12) return alert("Preencha os dados do cartão para continuar a simulação.");
        cardData = { name, number };
      }
      try {
        await api("/checkout", { method: "POST", body: JSON.stringify({ paymentMethod: method, card: cardData }) });
        form.innerHTML = `<div class="checkout-success"><div class="success-icon">✓</div><span class="eyebrow">PEDIDO REGISTRADO</span><h2>Compra simulada concluída!</h2><p>Seu pedido foi registrado no TIU (banco de dados) para fins de demonstração.</p><a class="btn btn-primary" href="produtos.html">Voltar ao Marketplace</a></div>`;
        updateCartBadges();
      } catch (err) { alert(err.message); }
    });
  }

  async function init() {
    setupTheme(); setupMenu();
    await setupAuthNav();
    const page = document.body.dataset.page;
    if (page === "home") await initHome();
    if (page === "professionals") await initProfessionals();
    if (page === "products") await initProducts();
    if (page === "profile") await initProfile();
    if (page === "login") initLogin();
    if (page === "forgot-password") initForgotPassword();
    if (page === "signup") await initSignup();
    if (page === "dashboard") await initDashboard();
    if (page === "add-product") await initAddProduct();
    if (page === "add-service") await initAddService();
    if (page === "chat") await initChat();
    if (page === "cart") await initCart();
    if (page === "checkout") await initCheckout();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
