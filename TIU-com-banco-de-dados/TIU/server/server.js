"use strict";
/*
 * Servidor do TIU — Node.js puro (sem dependências externas).
 * Usa o módulo nativo node:sqlite como banco de dados (Node >= 22.5).
 * Serve os arquivos estáticos de /public e expõe a API REST em /api/*.
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { db, hashPassword, verifyPassword } = require("./db.js");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SESSION_COOKIE = "tiu_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------
function uid(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
}

function parseCookies(header = "") {
  const out = {};
  header.split(";").forEach(part => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 8_000_000) req.destroy();
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }
  return publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id));
}

function createSession(res, userId) {
  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + SESSION_DURATION_MS);
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)")
    .run(token, userId, expires.toISOString());
  res.setHeader("Set-Cookie",
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}`);
}

function destroySession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function publicUser(u) {
  if (!u) return null;
  const categories = db.prepare("SELECT category FROM user_categories WHERE user_id = ?")
    .all(u.id).map(r => r.category);
  return {
    id: u.id, name: u.name, email: u.email, type: u.type, location: u.location,
    profession: u.profession, area: u.area, experience: u.experience,
    description: u.description, categories, createdAt: u.created_at
  };
}

function professionalRating(userId, fallback) {
  const row = db.prepare("SELECT AVG(stars) AS avg, COUNT(*) AS n FROM reviews WHERE professional_id = ?").get(userId);
  if (row.n > 0) return { rating: row.avg, count: row.n };
  return { rating: fallback ?? 0, count: 0 };
}

function professionalToJSON(u) {
  const categories = db.prepare("SELECT category FROM user_categories WHERE user_id = ?").all(u.id).map(r => r.category);
  const tags = db.prepare("SELECT tag FROM professional_tags WHERE user_id = ?").all(u.id).map(r => r.tag);
  const { rating, count } = professionalRating(u.id, u.default_rating);
  const initials = (u.name || "P").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase();
  return {
    id: u.id, name: u.name, profession: u.profession || "Profissional",
    categories: [...new Set([...categories, u.profession].filter(Boolean))],
    location: u.location || "", rating, reviewCount: count,
    experience: u.experience || "", description: u.description || "",
    services: tags.length ? tags : [u.area, ...categories].filter(Boolean),
    initials, image: `assets/images/${u.id}.svg`,
    hasCustomImage: fs.existsSync(path.join(PUBLIC_DIR, "assets", "images", `${u.id}.svg`))
  };
}

function productToJSON(p) {
  return {
    id: p.id, ownerId: p.owner_id, name: p.name, price: p.price, category: p.category,
    condition: p.condition, location: p.location, seller: p.seller, description: p.description,
    image: p.image || "", icon: p.icon || "▣", tone: p.tone || "purple", createdAt: p.created_at
  };
}

function serviceToJSON(s) {
  return {
    id: s.id, ownerId: s.owner_id, ownerName: s.owner_name, name: s.name, price: s.price,
    category: s.category, priceType: s.price_type, location: s.location,
    description: s.description, createdAt: s.created_at
  };
}

function reviewToJSON(r) {
  return {
    id: r.id, professionalId: r.professional_id, authorId: r.author_id, authorName: r.author_name,
    stars: r.stars, category: r.category, comment: r.comment, createdAt: r.created_at
  };
}

function requireAuth(req, res) {
  const user = getSessionUser(req);
  if (!user) { sendJSON(res, 401, { error: "É necessário estar autenticado." }); return null; }
  return user;
}

// ---------------------------------------------------------------------------
// Simulação de resposta automática do chat
// ---------------------------------------------------------------------------
function autoReply(text) {
  const lower = text.toLowerCase();
  if (lower.includes("oi") || lower.includes("olá") || lower.includes("ola")) return "Olá! Tudo bem? Posso ajudar com informações sobre o produto.";
  if (lower.includes("disponível") || lower.includes("disponivel")) return "Sim! O produto está disponível no momento.";
  if (lower.includes("preço") || lower.includes("preco") || lower.includes("valor")) return "O preço anunciado é o valor mostrado no Marketplace.";
  if (lower.includes("entrega")) return "Podemos combinar os detalhes da entrega diretamente pela conversa.";
  if (lower.includes("onde")) return "O anúncio informa a localização aproximada. Podemos combinar os detalhes pelo chat.";
  if (lower.includes("obrigado") || lower.includes("obrigada")) return "Por nada! Se precisar de mais informações, estou por aqui.";
  return "Olá! Obrigado pela mensagem. Vou verificar essa informação para você.";
}

// ---------------------------------------------------------------------------
// Rotas da API
// ---------------------------------------------------------------------------
const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const regex = new RegExp("^" + pattern.replace(/:[^/]+/g, m => { keys.push(m.slice(1)); return "([^/]+)"; }) + "$");
  routes.push({ method, regex, keys, handler });
}

// ---- Categorias ----
route("GET", "/api/categories", (req, res) => {
  const serviceCategories = db.prepare("SELECT name FROM service_categories ORDER BY rowid").all().map(r => r.name);
  const productCategories = db.prepare("SELECT name FROM product_categories ORDER BY rowid").all().map(r => r.name);
  sendJSON(res, 200, { serviceCategories, productCategories });
});

// ---- Autenticação / contas ----
route("POST", "/api/auth/register", async (req, res, params, body) => {
  const { name, email, password, type, location, categories, profession, area, experience, description } = body;
  if (!name || !email || !password || !location || !["cliente", "profissional"].includes(type)) {
    return sendJSON(res, 400, { error: "Preencha todos os campos obrigatórios." });
  }
  if (String(password).length < 6) return sendJSON(res, 400, { error: "A senha precisa ter pelo menos 6 caracteres." });
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(String(email).toLowerCase());
  if (existing) return sendJSON(res, 409, { error: "Este e-mail já está cadastrado." });

  const id = uid("user");
  const { hash, salt } = hashPassword(password);
  db.prepare(`INSERT INTO users (id,name,email,password_hash,password_salt,type,location,profession,area,experience,description)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, name, String(email).toLowerCase(), hash, salt, type, location, profession || "", area || "", experience || "", description || "");
  (categories || []).forEach(c => db.prepare("INSERT OR IGNORE INTO user_categories (user_id, category) VALUES (?,?)").run(id, c));

  createSession(res, id);
  sendJSON(res, 201, publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id)));
});

route("PUT", "/api/auth/me", async (req, res, params, body) => {
  const user = requireAuth(req, res); if (!user) return;
  const { name, email, password, location, categories, profession, area, experience, description } = body;
  if (!name || !email || !location) return sendJSON(res, 400, { error: "Preencha todos os campos obrigatórios." });
  const duplicate = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(String(email).toLowerCase(), user.id);
  if (duplicate) return sendJSON(res, 409, { error: "Este e-mail já está cadastrado." });

  let passwordSql = "";
  const args = [name, String(email).toLowerCase(), location, profession || "", area || "", experience || "", description || ""];
  if (password) {
    if (String(password).length < 6) return sendJSON(res, 400, { error: "A senha precisa ter pelo menos 6 caracteres." });
    const { hash, salt } = hashPassword(password);
    passwordSql = ", password_hash = ?, password_salt = ?";
    args.push(hash, salt);
  }
  args.push(user.id);
  db.prepare(`UPDATE users SET name=?, email=?, location=?, profession=?, area=?, experience=?, description=?${passwordSql} WHERE id = ?`).run(...args);
  db.prepare("DELETE FROM user_categories WHERE user_id = ?").run(user.id);
  (categories || []).forEach(c => db.prepare("INSERT OR IGNORE INTO user_categories (user_id, category) VALUES (?,?)").run(user.id, c));
  sendJSON(res, 200, publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id)));
});

route("POST", "/api/auth/login", async (req, res, params, body) => {
  const { email, password } = body;
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email || "").toLowerCase());
  if (!row || !verifyPassword(password || "", row.password_hash, row.password_salt)) {
    return sendJSON(res, 401, { error: "E-mail ou senha incorretos." });
  }
  createSession(res, row.id);
  sendJSON(res, 200, publicUser(row));
});

route("POST", "/api/auth/logout", async (req, res) => {
  destroySession(req, res);
  sendJSON(res, 200, { ok: true });
});

route("GET", "/api/auth/me", async (req, res) => {
  sendJSON(res, 200, getSessionUser(req));
});

route("POST", "/api/auth/forgot-password", async (req, res, params, body) => {
  const { email, password, confirm } = body;
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email || "").toLowerCase());
  if (!row) return sendJSON(res, 404, { error: "Não encontramos uma conta com esse e-mail." });
  if (String(password || "").length < 6) return sendJSON(res, 400, { error: "A nova senha precisa ter pelo menos 6 caracteres." });
  if (password !== confirm) return sendJSON(res, 400, { error: "As senhas não coincidem." });
  const { hash, salt } = hashPassword(password);
  db.prepare("UPDATE users SET password_hash=?, password_salt=? WHERE id=?").run(hash, salt, row.id);
  sendJSON(res, 200, { ok: true });
});

// ---- Profissionais ----
route("GET", "/api/professionals", async (req, res, params, body, query) => {
  const rows = db.prepare("SELECT * FROM users WHERE type = 'profissional' ORDER BY name").all();
  let list = rows.map(professionalToJSON);
  if (query.limit) list = list.slice(0, Number(query.limit));
  sendJSON(res, 200, list);
});

route("GET", "/api/professionals/:id", async (req, res, params) => {
  const row = db.prepare("SELECT * FROM users WHERE id = ? AND type = 'profissional'").get(params.id);
  if (!row) return sendJSON(res, 404, { error: "Profissional não encontrado." });
  sendJSON(res, 200, professionalToJSON(row));
});

// ---- Produtos ----
route("GET", "/api/products", async (req, res, params, body, query) => {
  let sql = "SELECT * FROM products";
  const args = [];
  if (query.ownerId) { sql += " WHERE owner_id = ?"; args.push(query.ownerId); }
  sql += " ORDER BY created_at DESC";
  let rows = db.prepare(sql).all(...args).map(productToJSON);
  if (query.limit) rows = rows.slice(0, Number(query.limit));
  sendJSON(res, 200, rows);
});

route("GET", "/api/products/:id", async (req, res, params) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(params.id);
  if (!row) return sendJSON(res, 404, { error: "Produto não encontrado." });
  sendJSON(res, 200, productToJSON(row));
});

route("POST", "/api/products", async (req, res, params, body) => {
  const user = requireAuth(req, res); if (!user) return;
  const { name, price, category, condition, location, description, image } = body;
  if (!name || !price || Number(price) < 0 || !category || !condition || !location || !description) {
    return sendJSON(res, 400, { error: "Preencha todos os campos obrigatórios." });
  }
  const id = uid("user-product");
  db.prepare(`INSERT INTO products (id,owner_id,name,price,category,condition,location,seller,description,image,icon,tone)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, user.id, name, Number(price), category, condition, location, user.name, description, image || "", "▣", Math.random() > 0.5 ? "purple" : "orange");
  sendJSON(res, 201, productToJSON(db.prepare("SELECT * FROM products WHERE id=?").get(id)));
});

route("PUT", "/api/products/:id", async (req, res, params, body) => {
  const user = requireAuth(req, res); if (!user) return;
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(params.id);
  if (!existing) return sendJSON(res, 404, { error: "Produto não encontrado." });
  if (existing.owner_id !== user.id) return sendJSON(res, 403, { error: "Você não tem permissão para editar este anúncio." });
  const { name, price, category, condition, location, description } = body;
  if (!name || !Number.isFinite(Number(price)) || Number(price) < 0 || !location || !description) {
    return sendJSON(res, 400, { error: "Preencha todos os campos corretamente." });
  }
  db.prepare("UPDATE products SET name=?, price=?, category=?, condition=?, location=?, description=? WHERE id=?")
    .run(name, Number(price), category, condition, location, description, params.id);
  sendJSON(res, 200, productToJSON(db.prepare("SELECT * FROM products WHERE id=?").get(params.id)));
});

route("DELETE", "/api/products/:id", async (req, res, params) => {
  const user = requireAuth(req, res); if (!user) return;
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(params.id);
  if (!existing) return sendJSON(res, 404, { error: "Produto não encontrado." });
  if (existing.owner_id !== user.id) return sendJSON(res, 403, { error: "Você não tem permissão para excluir este anúncio." });
  db.prepare("DELETE FROM products WHERE id=?").run(params.id);
  sendJSON(res, 200, { ok: true });
});

// ---- Serviços ----
route("GET", "/api/services", async (req, res, params, body, query) => {
  let sql = "SELECT * FROM services";
  const args = [];
  if (query.ownerId) { sql += " WHERE owner_id = ?"; args.push(query.ownerId); }
  sql += " ORDER BY created_at DESC";
  sendJSON(res, 200, db.prepare(sql).all(...args).map(serviceToJSON));
});

route("POST", "/api/services", async (req, res, params, body) => {
  const user = requireAuth(req, res); if (!user) return;
  if (user.type !== "profissional") return sendJSON(res, 403, { error: "Apenas profissionais podem cadastrar serviços." });
  const { name, price, category, priceType, location, description } = body;
  if (!name || !price || Number(price) < 0 || !category || !location || !description) {
    return sendJSON(res, 400, { error: "Preencha todos os campos obrigatórios." });
  }
  const id = uid("user-service");
  db.prepare(`INSERT INTO services (id,owner_id,owner_name,name,price,category,price_type,location,description)
              VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, user.id, user.name, name, Number(price), category, priceType || "fixo", location, description);
  sendJSON(res, 201, serviceToJSON(db.prepare("SELECT * FROM services WHERE id=?").get(id)));
});

// ---- Avaliações ----
route("GET", "/api/reviews", async (req, res, params, body, query) => {
  let sql = "SELECT * FROM reviews";
  const args = [];
  const clauses = [];
  if (query.professionalId) { clauses.push("professional_id = ?"); args.push(query.professionalId); }
  if (query.category) { clauses.push("category = ?"); args.push(query.category); }
  if (clauses.length) sql += " WHERE " + clauses.join(" AND ");
  sql += " ORDER BY created_at DESC";
  sendJSON(res, 200, db.prepare(sql).all(...args).map(reviewToJSON));
});

route("POST", "/api/reviews", async (req, res, params, body) => {
  const user = requireAuth(req, res); if (!user) return;
  const { professionalId, stars, category, comment } = body;
  if (!professionalId || !stars || !category || !comment) return sendJSON(res, 400, { error: "Preencha a nota, a categoria e o comentário." });
  if (professionalId === user.id) return sendJSON(res, 400, { error: "Você não pode avaliar seu próprio perfil." });
  const professional = db.prepare("SELECT id FROM users WHERE id = ? AND type='profissional'").get(professionalId);
  if (!professional) return sendJSON(res, 404, { error: "Profissional não encontrado." });
  const id = uid("review");
  db.prepare(`INSERT INTO reviews (id,professional_id,author_id,author_name,stars,category,comment)
              VALUES (?,?,?,?,?,?,?)`)
    .run(id, professionalId, user.id, user.name, Number(stars), category, comment);
  sendJSON(res, 201, reviewToJSON(db.prepare("SELECT * FROM reviews WHERE id=?").get(id)));
});

// ---- Carrinho ----
function cartToJSON(userId) {
  const rows = db.prepare(`
    SELECT ci.quantity, p.* FROM cart_items ci JOIN products p ON p.id = ci.product_id
    WHERE ci.user_id = ? ORDER BY ci.created_at DESC
  `).all(userId);
  return rows.map(r => ({ ...productToJSON(r), quantity: r.quantity }));
}

route("GET", "/api/cart", async (req, res) => {
  const user = requireAuth(req, res); if (!user) return;
  sendJSON(res, 200, cartToJSON(user.id));
});

route("POST", "/api/cart", async (req, res, params, body) => {
  const user = requireAuth(req, res); if (!user) return;
  const { productId } = body;
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
  if (!product) return sendJSON(res, 404, { error: "Produto não encontrado." });
  if (product.owner_id === user.id) return sendJSON(res, 400, { error: "Você não pode comprar seu próprio anúncio." });
  const existing = db.prepare("SELECT * FROM cart_items WHERE user_id=? AND product_id=?").get(user.id, productId);
  if (existing) db.prepare("UPDATE cart_items SET quantity = quantity + 1 WHERE id=?").run(existing.id);
  else db.prepare("INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?,?,1)").run(user.id, productId);
  sendJSON(res, 200, cartToJSON(user.id));
});

route("PUT", "/api/cart/:productId", async (req, res, params, body) => {
  const user = requireAuth(req, res); if (!user) return;
  const quantity = Math.max(1, Number(body.quantity) || 1);
  db.prepare("UPDATE cart_items SET quantity=? WHERE user_id=? AND product_id=?").run(quantity, user.id, params.productId);
  sendJSON(res, 200, cartToJSON(user.id));
});

route("DELETE", "/api/cart/:productId", async (req, res, params) => {
  const user = requireAuth(req, res); if (!user) return;
  db.prepare("DELETE FROM cart_items WHERE user_id=? AND product_id=?").run(user.id, params.productId);
  sendJSON(res, 200, cartToJSON(user.id));
});

route("DELETE", "/api/cart", async (req, res) => {
  const user = requireAuth(req, res); if (!user) return;
  db.prepare("DELETE FROM cart_items WHERE user_id=?").run(user.id);
  sendJSON(res, 200, []);
});

// ---- Checkout / compras ----
route("POST", "/api/checkout", async (req, res, params, body) => {
  const user = requireAuth(req, res); if (!user) return;
  const cart = cartToJSON(user.id);
  if (!cart.length) return sendJSON(res, 400, { error: "Seu carrinho está vazio." });
  const { paymentMethod, card } = body;
  if (paymentMethod === "card") {
    const number = String(card?.number || "").replace(/\D/g, "");
    if (!card?.name || number.length < 12) return sendJSON(res, 400, { error: "Preencha os dados do cartão para continuar a simulação." });
  }
  const orderId = uid("order");
  const insert = db.prepare(`INSERT INTO purchases (id,order_id,buyer_id,buyer_name,product_id,product_name,price,quantity,seller,payment_method,status)
                              VALUES (?,?,?,?,?,?,?,?,?,?,'simulada')`);
  cart.forEach(item => insert.run(uid("purchase"), orderId, user.id, user.name, item.id, item.name, item.price * item.quantity, item.quantity, item.seller, paymentMethod));
  db.prepare("DELETE FROM cart_items WHERE user_id=?").run(user.id);
  sendJSON(res, 201, { orderId });
});

route("GET", "/api/purchases", async (req, res) => {
  const user = requireAuth(req, res); if (!user) return;
  const rows = db.prepare("SELECT * FROM purchases WHERE buyer_id=? ORDER BY created_at DESC").all(user.id);
  sendJSON(res, 200, rows.map(r => ({
    id: r.id, orderId: r.order_id, productId: r.product_id, productName: r.product_name,
    price: r.price, quantity: r.quantity, seller: r.seller, paymentMethod: r.payment_method,
    status: r.status, createdAt: r.created_at
  })));
});

// ---- Chats ----
function chatToJSON(c) {
  const messages = db.prepare("SELECT * FROM chat_messages WHERE chat_id=? ORDER BY id ASC").all(c.id)
    .map(m => ({ sender: m.sender, text: m.text, time: m.time }));
  return {
    id: c.id, userId: c.user_id, sellerId: c.seller_id, seller: c.seller_name,
    professionalId: c.professional_id, productId: c.product_id, product: c.product_name, messages
  };
}

route("GET", "/api/chats", async (req, res) => {
  const user = requireAuth(req, res); if (!user) return;
  const rows = db.prepare("SELECT * FROM chats WHERE user_id=? ORDER BY created_at DESC").all(user.id);
  sendJSON(res, 200, rows.map(chatToJSON));
});

route("POST", "/api/chats", async (req, res, params, body) => {
  const user = requireAuth(req, res); if (!user) return;
  const { sellerId, sellerName, professionalId, productId, productName } = body;
  if (!sellerId || sellerId === user.id) return sendJSON(res, 400, { error: "Não é possível iniciar essa conversa." });
  let chat = db.prepare("SELECT * FROM chats WHERE user_id=? AND seller_id=? AND (product_id IS ? OR product_id = ?)")
    .get(user.id, sellerId, productId || null, productId || null);
  if (!chat) {
    const id = uid("chat");
    db.prepare(`INSERT INTO chats (id,user_id,seller_id,seller_name,professional_id,product_id,product_name)
                VALUES (?,?,?,?,?,?,?)`)
      .run(id, user.id, sellerId, sellerName || "Vendedor", professionalId || null, productId || null, productName || "Atendimento");
    chat = db.prepare("SELECT * FROM chats WHERE id=?").get(id);
  }
  sendJSON(res, 200, chatToJSON(chat));
});

route("POST", "/api/chats/:id/messages", async (req, res, params, body) => {
  const user = requireAuth(req, res); if (!user) return;
  const chat = db.prepare("SELECT * FROM chats WHERE id=? AND user_id=?").get(params.id, user.id);
  if (!chat) return sendJSON(res, 404, { error: "Conversa não encontrada." });
  const text = String(body.text || "").trim();
  if (!text) return sendJSON(res, 400, { error: "Escreva uma mensagem." });
  const time = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  db.prepare("INSERT INTO chat_messages (chat_id, sender, text, time) VALUES (?,?,?,?)").run(chat.id, "me", text, time());
  const reply = autoReply(text);
  db.prepare("INSERT INTO chat_messages (chat_id, sender, text, time) VALUES (?,?,?,?)").run(chat.id, "seller", reply, time());
  sendJSON(res, 200, chatToJSON(chat));
});

// ---------------------------------------------------------------------------
// Servidor de arquivos estáticos
// ---------------------------------------------------------------------------
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".json": "application/json", ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function serveStatic(req, res, pathname) {
  let filePath = decodeURIComponent(pathname);
  if (filePath === "/") filePath = "/index.html";
  const resolved = path.normalize(path.join(PUBLIC_DIR, filePath));
  if (!resolved.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end("Proibido"); }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (err2, fallback) => {
        if (err2) { res.writeHead(404); return res.end("Não encontrado"); }
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fallback);
      });
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Servidor HTTP principal
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());

  if (pathname.startsWith("/api/")) {
    try {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const match = pathname.match(r.regex);
        if (!match) continue;
        const params = {};
        r.keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]); });
        const body = ["POST", "PUT", "PATCH"].includes(req.method) ? await readBody(req) : {};
        await r.handler(req, res, params, body, query);
        return;
      }
      sendJSON(res, 404, { error: "Rota não encontrada." });
    } catch (err) {
      console.error(err);
      sendJSON(res, 500, { error: "Erro interno do servidor." });
    }
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`\n  TIU rodando em http://localhost:${PORT}\n  Banco de dados: server/../data/tiu.sqlite\n`);
});
