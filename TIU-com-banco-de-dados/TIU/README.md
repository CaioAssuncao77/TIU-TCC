# TIU — agora com banco de dados de verdade

Esta versão substitui o armazenamento em `localStorage` por um **banco de
dados relacional real (SQLite)**, acessado por uma **API própria em
Node.js**. O front-end (HTML/CSS/JS) continua o mesmo visualmente — só a
camada de dados mudou, e agora tudo o que acontece no site (contas,
avaliações, categorias, produtos, serviços, carrinho, compras e chat) fica
gravado em `data/tiu.sqlite`, persistindo entre sessões e navegadores.

## Por que SQLite e não MySQL/Postgres?

O SQLite é um banco de dados relacional completo (SQL, tabelas, chaves
estrangeiras, índices) que fica guardado em um único arquivo, sem precisar
instalar/configurar um servidor de banco separado — ideal para um TCC que
precisa rodar em qualquer computador com o mínimo de setup. Se você
preferir, o `server/schema.sql` pode ser adaptado para MySQL/Postgres
trocando `AUTOINCREMENT` por `AUTO_INCREMENT`/`SERIAL` e ajustando alguns
tipos.

O acesso ao banco usa o módulo **nativo** `node:sqlite` do Node.js (não é
uma biblioteca externa), então **não é preciso rodar `npm install`**.

## Como executar

Pré-requisito: **Node.js 22.5 ou mais recente** (`node -v` para conferir).

```bash
cd TIU
node server/server.js
```

Acesse **http://localhost:3000** no navegador. Não abra mais o `index.html`
diretamente pelo navegador (arquivo local) — o site agora precisa do
servidor rodando para falar com o banco de dados.

Na primeira execução, o servidor cria automaticamente o arquivo
`data/tiu.sqlite` e o popula com os dados de demonstração (profissionais,
produtos, categorias e a conta de teste).

### Conta de demonstração
- E-mail: `demo@tiu.com`
- Senha: `123456`

(as contas dos profissionais de exemplo também existem: `joao@tiu.com`,
`ana@tiu.com`, `marcos@tiu.com`, etc., todas com a senha `123456`)

## Estrutura do projeto

```text
TIU/
├── package.json
├── data/
│   └── tiu.sqlite            ← banco de dados (criado automaticamente)
├── server/
│   ├── server.js             ← servidor HTTP + API REST (Node puro)
│   ├── db.js                 ← conexão, criação do schema e seed inicial
│   └── schema.sql            ← definição de todas as tabelas
└── public/                   ← front-end (HTML, CSS, JS, imagens)
    ├── index.html, login.html, cadastro.html, produtos.html, ...
    ├── css/style.css
    ├── js/app.js              ← agora conversa com a API via fetch()
    └── assets/images/
```

## Modelo do banco de dados

| Tabela | Para quê serve |
|---|---|
| `users` | Contas de clientes e profissionais (nome, e-mail, senha com hash+salt, tipo, localização, dados profissionais) |
| `user_categories` | Categorias de serviço que cada profissional atende (n:n) |
| `professional_tags` | Tags/serviços de destaque exibidos no perfil |
| `sessions` | Sessões de login ativas (cookie httpOnly) |
| `service_categories` / `product_categories` | Listas de categorias usadas em formulários e filtros |
| `products` | Anúncios do Marketplace (do sistema e publicados por usuários) |
| `services` | Serviços com preço cadastrados por profissionais |
| `reviews` | Avaliações (nota, categoria, comentário) feitas por clientes sobre profissionais |
| `cart_items` | Carrinho de compras persistente por usuário |
| `purchases` | Histórico de compras simuladas |
| `chats` / `chat_messages` | Conversas entre clientes e vendedores/profissionais |

Veja o SQL completo, com todas as colunas, tipos e chaves estrangeiras, em
[`server/schema.sql`](server/schema.sql).

### Segurança das senhas
As senhas nunca são salvas em texto puro: usamos `crypto.scrypt` (nativo do
Node.js) com um salt aleatório por usuário, e a verificação de login usa
comparação em tempo constante (`timingSafeEqual`).

## API REST (resumo)

Todas as rotas ficam em `/api/...` e trocam JSON. Rotas que alteram dados do
usuário exigem estar autenticado (cookie de sessão, enviado automaticamente
pelo navegador).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/categories` | Categorias de serviço e de produto |
| POST | `/api/auth/register` | Criar conta (cliente ou profissional) |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Usuário logado (ou `null`) |
| PUT | `/api/auth/me` | Editar meu perfil |
| POST | `/api/auth/forgot-password` | Redefinir senha (simulação) |
| GET | `/api/professionals` | Listar profissionais (com média de avaliações) |
| GET | `/api/professionals/:id` | Perfil de um profissional |
| GET/POST | `/api/products` | Listar / publicar produtos |
| GET/PUT/DELETE | `/api/products/:id` | Ver / editar / excluir um produto |
| GET/POST | `/api/services` | Listar / publicar serviços |
| GET/POST | `/api/reviews` | Listar / publicar avaliações |
| GET/POST | `/api/cart` | Ver / adicionar item ao carrinho |
| PUT/DELETE | `/api/cart/:productId` | Alterar quantidade / remover item |
| POST | `/api/checkout` | Finalizar compra simulada |
| GET | `/api/purchases` | Meu histórico de compras |
| GET/POST | `/api/chats` | Listar conversas / abrir conversa |
| POST | `/api/chats/:id/messages` | Enviar mensagem (com resposta automática simulada) |

## O que mudou em relação à versão anterior

- Tudo que ficava em `localStorage` (`tiu_users`, `tiu_session`,
  `tiu_user_products`, `tiu_reviews`, `tiu_cart`, `tiu_purchases`,
  `tiu_chats`, etc.) agora fica em tabelas do banco `tiu.sqlite`.
- `js/app.js` foi reescrito para usar `fetch()` contra a API em vez de ler
  e escrever diretamente no `localStorage`.
- O layout, os textos e o comportamento visual das páginas **não foram
  alterados** — só a camada de dados.
- O tema claro/escuro continua salvo no `localStorage`, por ser apenas uma
  preferência do navegador (não é um requisito de dado do sistema).

## Observação acadêmica

Este projeto é uma demonstração para fins de TCC. A simulação de
pagamento (PIX/cartão) não processa nenhuma transação real, e os dados
ficam apenas no arquivo local `data/tiu.sqlite` da máquina onde o servidor
é executado.
