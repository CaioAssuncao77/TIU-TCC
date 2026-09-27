-- Banco de dados do TIU (SQLite)
-- Substitui o antigo armazenamento em localStorage por um banco real,
-- persistido em arquivo (server/../data/tiu.sqlite).

PRAGMA foreign_keys = ON;

-- Contas (clientes e profissionais)
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  password_salt  TEXT NOT NULL,
  type           TEXT NOT NULL CHECK(type IN ('cliente','profissional')),
  location       TEXT DEFAULT '',
  profession     TEXT DEFAULT '',
  area           TEXT DEFAULT '',
  experience     TEXT DEFAULT '',
  description    TEXT DEFAULT '',
  default_rating REAL DEFAULT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Categorias que um profissional atende (n:n)
CREATE TABLE IF NOT EXISTS user_categories (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  PRIMARY KEY (user_id, category)
);

-- Tags/serviços de destaque exibidos no perfil do profissional
CREATE TABLE IF NOT EXISTS professional_tags (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (user_id, tag)
);

-- Sessões de login (equivalente ao antigo tiu_session)
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Categorias de serviço (usadas em cadastro de profissional e avaliações)
CREATE TABLE IF NOT EXISTS service_categories (
  name TEXT PRIMARY KEY
);

-- Categorias de produto (Marketplace)
CREATE TABLE IF NOT EXISTS product_categories (
  name TEXT PRIMARY KEY
);

-- Produtos do Marketplace (do sistema e publicados por usuários)
CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  price       REAL NOT NULL,
  category    TEXT NOT NULL,
  condition   TEXT NOT NULL,
  location    TEXT NOT NULL,
  seller      TEXT NOT NULL,
  description TEXT NOT NULL,
  image       TEXT DEFAULT '',
  icon        TEXT DEFAULT '▣',
  tone        TEXT DEFAULT 'purple',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Serviços cadastrados por profissionais (com preço)
CREATE TABLE IF NOT EXISTS services (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_name  TEXT NOT NULL,
  name        TEXT NOT NULL,
  price       REAL NOT NULL,
  category    TEXT NOT NULL,
  price_type  TEXT DEFAULT 'fixo',
  location    TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Avaliações de profissionais
CREATE TABLE IF NOT EXISTS reviews (
  id              TEXT PRIMARY KEY,
  professional_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name     TEXT NOT NULL,
  stars           INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
  category        TEXT NOT NULL,
  comment         TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Carrinho de compras (persistido por usuário)
CREATE TABLE IF NOT EXISTS cart_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, product_id)
);

-- Compras simuladas (histórico de pedidos)
CREATE TABLE IF NOT EXISTS purchases (
  id             TEXT PRIMARY KEY,
  order_id       TEXT NOT NULL,
  buyer_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_name     TEXT NOT NULL,
  product_id     TEXT,
  product_name   TEXT NOT NULL,
  price          REAL NOT NULL,
  quantity       INTEGER NOT NULL DEFAULT 1,
  seller         TEXT,
  payment_method TEXT,
  status         TEXT DEFAULT 'simulada',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Conversas (chat comprador/vendedor ou cliente/profissional)
CREATE TABLE IF NOT EXISTS chats (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id       TEXT NOT NULL,
  seller_name     TEXT NOT NULL,
  professional_id TEXT,
  product_id      TEXT,
  product_name    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, seller_id, product_id)
);

-- Mensagens de cada conversa
CREATE TABLE IF NOT EXISTS chat_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id    TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender     TEXT NOT NULL CHECK(sender IN ('me','seller')),
  text       TEXT NOT NULL,
  time       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_owner ON products(owner_id);
CREATE INDEX IF NOT EXISTS idx_services_owner ON services(owner_id);
CREATE INDEX IF NOT EXISTS idx_reviews_professional ON reviews(professional_id);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id);
