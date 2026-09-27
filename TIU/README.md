# TIU — nova versão para o TCC

Versão reconstruída do TIU baseada na proposta e identidade do projeto original.

## Tecnologias
- HTML5
- CSS3
- JavaScript puro
- localStorage

Não há Node.js, npm, React, Vite, TypeScript ou backend.

## Como executar
Abra `index.html` diretamente no navegador.

## Fluxos principais
- Home → Profissionais → Perfil profissional
- Home → Marketplace → Produto
- Home → Cadastro → Cliente/Profissional → Login → Dashboard
- Cliente → Dashboard → Tornar-se profissional

## Autenticação
A autenticação é uma simulação acadêmica. Usuários e sessão são armazenados no `localStorage` do navegador.

Conta de demonstração:
- E-mail: `demo@tiu.com`
- Senha: `123456`

**Não utilize esta autenticação em produção**, pois `localStorage` não oferece armazenamento seguro de credenciais.

## Estrutura
```text
TIU/
├── index.html
├── login.html
├── cadastro.html
├── dashboard.html
├── profissionais.html
├── produtos.html
├── perfil-profissional.html
├── css/
│   └── style.css
├── js/
│   └── app.js
└── assets/
    └── images/
```

## Novidades desta versão
- Header reconhece a sessão e mostra o nome do usuário, Dashboard e Sair.
- Clientes também podem publicar produtos no Marketplace.
- Novo fluxo `adicionar-produto.html` com foto opcional, preço, condição, categoria e descrição.
- Anúncios próprios aparecem no Dashboard em “Meus anúncios”.
- Página de detalhe permite contato demonstrativo e exclusão do próprio anúncio.
- Dados dos anúncios ficam em `localStorage` para a demonstração do TCC.

## Imagens

A versão atual inclui ilustrações SVG locais em `assets/images/` para profissionais e produtos demonstrativos. Isso evita depender de imagens externas e permite abrir o projeto offline.

Anúncios criados pelo usuário continuam aceitando uma imagem própria, processada e armazenada no navegador para a demonstração.
