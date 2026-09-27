"use strict";

const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "tiu.sqlite");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");

const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema);

// ---------- helpers de senha ----------
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { hash, salt };
}
function verifyPassword(password, hash, salt) {
  const attempt = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(attempt, "hex"), Buffer.from(hash, "hex"));
}

// ---------- seed inicial (somente na primeira execução) ----------
function count(table) {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
}

function seed() {
  if (count("service_categories") === 0) {
    const insertCat = db.prepare("INSERT INTO service_categories (name) VALUES (?)");
    [
      "Encanador", "Eletricista", "Diarista", "Montador de móveis",
      "Técnico de informática", "Mecânico", "Pintor(a)", "Pedreiro(a)",
      "Jardineiro(a)", "Designer", "Fotógrafo(a)", "Professor(a) particular",
      "Manicure / Cabeleireiro(a)", "Outra profissão"
    ].forEach(name => insertCat.run(name));
  }

  if (count("product_categories") === 0) {
    const insertCat = db.prepare("INSERT INTO product_categories (name) VALUES (?)");
    ["Celulares", "Notebooks", "Ferramentas", "Câmeras", "Consoles", "Móveis", "Vintage", "Outros"]
      .forEach(name => insertCat.run(name));
  }

  if (count("users") === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (id,name,email,password_hash,password_salt,type,location,profession,area,experience,description,default_rating)
      VALUES (@id,@name,@email,@hash,@salt,@type,@location,@profession,@area,@experience,@description,@rating)
    `);
    const insertCategory = db.prepare("INSERT OR IGNORE INTO user_categories (user_id, category) VALUES (?,?)");
    const insertTag = db.prepare("INSERT OR IGNORE INTO professional_tags (user_id, tag) VALUES (?,?)");

    const professionals = [
      { id: "joao", name: "João Ferreira", profession: "Encanador", location: "Santos, SP", rating: 4.9, experience: "18 anos", description: "Manutenção hidráulica residencial, instalação e pequenos reparos.", tags: ["Instalação hidráulica", "Vazamentos", "Torneiras e registros"] },
      { id: "ana", name: "Ana Souza", profession: "Diarista", location: "Santos, SP", rating: 4.8, experience: "10 anos", description: "Limpeza residencial com organização, atenção aos detalhes e pontualidade.", tags: ["Limpeza residencial", "Organização", "Limpeza pós-obra"] },
      { id: "marcos", name: "Marcos Lima", profession: "Eletricista", location: "Praia Grande, SP", rating: 5.0, experience: "13 anos", description: "Instalações e manutenção elétrica para casas e pequenos comércios.", tags: ["Instalações", "Manutenção", "Iluminação"] },
      { id: "juliana", name: "Juliana Oliveira", profession: "Pintora", location: "São Vicente, SP", rating: 4.7, experience: "8 anos", description: "Pintura interna e externa, preparação de superfícies e acabamento.", tags: ["Pintura interna", "Pintura externa", "Texturas"] },
      { id: "felipe", name: "Felipe Rodrigues", profession: "Montador de móveis", location: "Santos, SP", rating: 4.9, experience: "12 anos", description: "Montagem, desmontagem e ajustes de móveis residenciais e comerciais.", tags: ["Montagem", "Desmontagem", "Ajustes"] },
      { id: "bruno", name: "Bruno Martins", profession: "Técnico de informática", location: "Santos, SP", rating: 4.8, experience: "7 anos", description: "Manutenção de computadores, formatação e configuração de redes domésticas.", tags: ["Manutenção", "Formatação", "Redes"] },
      { id: "ricardo", name: "Ricardo Alves", profession: "Mecânico", location: "Cubatão, SP", rating: 4.9, experience: "15 anos", description: "Manutenção preventiva e pequenos reparos automotivos.", tags: ["Revisão", "Freios", "Diagnóstico"] }
    ];

    for (const p of professionals) {
      const { hash, salt } = hashPassword("123456");
      insertUser.run({
        id: p.id, name: p.name, email: `${p.id}@tiu.com`, hash, salt,
        type: "profissional", location: p.location, profession: p.profession,
        area: p.profession, experience: p.experience, description: p.description, rating: p.rating
      });
      insertCategory.run(p.id, p.profession);
      p.tags.forEach(tag => insertTag.run(p.id, tag));
    }

    const { hash, salt } = hashPassword("123456");
    insertUser.run({
      id: "demo-user", name: "Usuário Demo", email: "demo@tiu.com", hash, salt,
      type: "cliente", location: "Santos, SP", profession: "", area: "", description: "", rating: null
    });
  }

  if (count("products") === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (id,owner_id,name,price,category,condition,location,seller,description,image,icon,tone)
      VALUES (@id,NULL,@name,@price,@category,@condition,@location,@seller,@description,@image,@icon,@tone)
    `);
    [
      { id: "notebook", name: "Notebook Pro 14", price: 2899.90, condition: "Seminovo", category: "Notebooks", location: "Santos, SP", seller: "Lucas Mendes", icon: "▣", tone: "purple", image: "assets/images/notebook.svg", description: "Notebook em ótimo estado para estudos, trabalho e tarefas do dia a dia." },
      { id: "camera", name: "Câmera Digital Retro", price: 780, condition: "Vintage", category: "Câmeras", location: "São Vicente, SP", seller: "Marina Costa", icon: "◉", tone: "orange", image: "assets/images/camera.svg", description: "Câmera compacta com estética retrô, ideal para quem gosta de fotografia." },
      { id: "furadeira", name: "Furadeira Elétrica", price: 219.90, condition: "Usado", category: "Ferramentas", location: "Santos, SP", seller: "Oficina do Paulo", icon: "⚒", tone: "purple", image: "assets/images/furadeira.svg", description: "Furadeira funcional para pequenos reparos e projetos domésticos." },
      { id: "console", name: "Console Classic", price: 649.90, condition: "Restaurado", category: "Consoles", location: "Praia Grande, SP", seller: "RetroLab", icon: "▤", tone: "orange", image: "assets/images/console.svg", description: "Console clássico restaurado e revisado para uso." },
      { id: "celular", name: "Smartphone One", price: 1199, condition: "Usado", category: "Celulares", location: "Santos, SP", seller: "Diego Rocha", icon: "▯", tone: "purple", image: "assets/images/celular.svg", description: "Smartphone usado em bom estado, com carregador." },
      { id: "mesa", name: "Mesa de Madeira", price: 420, condition: "Restaurado", category: "Móveis", location: "Santos, SP", seller: "Ateliê Madeira", icon: "▤", tone: "orange", image: "assets/images/mesa.svg", description: "Mesa de madeira restaurada com acabamento renovado." },
      { id: "ferramentas", name: "Kit de Ferramentas 46 peças", price: 179.90, condition: "Novo", category: "Ferramentas", location: "Santos, SP", seller: "Casa do Ferramenteiro", icon: "⚙", tone: "purple", image: "assets/images/ferramentas.svg", description: "Kit novo para manutenção e pequenos projetos." },
      { id: "camera2", name: "Câmera Instantânea", price: 399.90, condition: "Seminovo", category: "Câmeras", location: "Santos, SP", seller: "Bia Fotografia", icon: "◎", tone: "orange", image: "assets/images/camera2.svg", description: "Câmera instantânea seminova, pronta para fotografar." }
    ].forEach(p => insertProduct.run(p));
  }
}

seed();

module.exports = { db, hashPassword, verifyPassword };
