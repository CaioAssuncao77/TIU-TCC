/* TIU — JavaScript puro
   Autenticação, anúncios e dados são demonstrativos e ficam no localStorage.
   NÃO use este mecanismo para produção.
*/
(() => {
  "use strict";

  const STORAGE_USERS = "tiu_users";
  const STORAGE_SESSION = "tiu_session";
  const STORAGE_PRODUCTS = "tiu_user_products";
  const STORAGE_SERVICES = "tiu_user_services";

  const professionals = [
    { id:"joao", name:"João Ferreira", profession:"Encanador", location:"Santos, SP", rating:4.9, experience:"18 anos", description:"Manutenção hidráulica residencial, instalação e pequenos reparos.", services:["Instalação hidráulica","Vazamentos","Torneiras e registros"], initials:"JF", image:"assets/images/joao.svg" },
    { id:"ana", name:"Ana Souza", profession:"Diarista", location:"Santos, SP", rating:4.8, experience:"10 anos", description:"Limpeza residencial com organização, atenção aos detalhes e pontualidade.", services:["Limpeza residencial","Organização","Limpeza pós-obra"], initials:"AS", image:"assets/images/ana.svg" },
    { id:"marcos", name:"Marcos Lima", profession:"Eletricista", location:"Praia Grande, SP", rating:5.0, experience:"13 anos", description:"Instalações e manutenção elétrica para casas e pequenos comércios.", services:["Instalações","Manutenção","Iluminação"], initials:"ML", image:"assets/images/marcos.svg" },
    { id:"juliana", name:"Juliana Oliveira", profession:"Pintora", location:"São Vicente, SP", rating:4.7, experience:"8 anos", description:"Pintura interna e externa, preparação de superfícies e acabamento.", services:["Pintura interna","Pintura externa","Texturas"], initials:"JO", image:"assets/images/juliana.svg" },
    { id:"felipe", name:"Felipe Rodrigues", profession:"Montador de móveis", location:"Santos, SP", rating:4.9, experience:"12 anos", description:"Montagem, desmontagem e ajustes de móveis residenciais e comerciais.", services:["Montagem","Desmontagem","Ajustes"], initials:"FR", image:"assets/images/felipe.svg" },
    { id:"bruno", name:"Bruno Martins", profession:"Técnico de informática", location:"Santos, SP", rating:4.8, experience:"7 anos", description:"Manutenção de computadores, formatação e configuração de redes domésticas.", services:["Manutenção","Formatação","Redes"], initials:"BM", image:"assets/images/bruno.svg" },
    { id:"ricardo", name:"Ricardo Alves", profession:"Mecânico", location:"Cubatão, SP", rating:4.9, experience:"15 anos", description:"Manutenção preventiva e pequenos reparos automotivos.", services:["Revisão","Freios","Diagnóstico"], initials:"RA", image:"assets/images/ricardo.svg" }
  ];

  const products = [
    { id:"notebook", name:"Notebook Pro 14", price:2899.90, condition:"Seminovo", category:"Notebooks", location:"Santos, SP", seller:"Lucas Mendes", icon:"▣", tone:"purple", image:"assets/images/notebook.svg", description:"Notebook em ótimo estado para estudos, trabalho e tarefas do dia a dia." },
    { id:"camera", name:"Câmera Digital Retro", price:780, condition:"Vintage", category:"Câmeras", location:"São Vicente, SP", seller:"Marina Costa", icon:"◉", tone:"orange", image:"assets/images/camera.svg", description:"Câmera compacta com estética retrô, ideal para quem gosta de fotografia." },
    { id:"furadeira", name:"Furadeira Elétrica", price:219.90, condition:"Usado", category:"Ferramentas", location:"Santos, SP", seller:"Oficina do Paulo", icon:"⚒", tone:"purple", image:"assets/images/furadeira.svg", description:"Furadeira funcional para pequenos reparos e projetos domésticos." },
    { id:"console", name:"Console Classic", price:649.90, condition:"Restaurado", category:"Consoles", location:"Praia Grande, SP", seller:"RetroLab", icon:"▤", tone:"orange", image:"assets/images/console.svg", description:"Console clássico restaurado e revisado para uso." },
    { id:"celular", name:"Smartphone One", price:1199, condition:"Usado", category:"Celulares", location:"Santos, SP", seller:"Diego Rocha", icon:"▯", tone:"purple", image:"assets/images/celular.svg", description:"Smartphone usado em bom estado, com carregador." },
    { id:"mesa", name:"Mesa de Madeira", price:420, condition:"Restaurado", category:"Móveis", location:"Santos, SP", seller:"Ateliê Madeira", icon:"▤", tone:"orange", image:"assets/images/mesa.svg", description:"Mesa de madeira restaurada com acabamento renovado." },
    { id:"ferramentas", name:"Kit de Ferramentas 46 peças", price:179.90, condition:"Novo", category:"Ferramentas", location:"Santos, SP", seller:"Casa do Ferramenteiro", icon:"⚙", tone:"purple", image:"assets/images/ferramentas.svg", description:"Kit novo para manutenção e pequenos projetos." },
    { id:"camera2", name:"Câmera Instantânea", price:399.90, condition:"Seminovo", category:"Câmeras", location:"Santos, SP", seller:"Bia Fotografia", icon:"◎", tone:"orange", image:"assets/images/camera2.svg", description:"Câmera instantânea seminova, pronta para fotografar." }
  ];

  function $(selector, scope = document) { return scope.querySelector(selector); }
  function $all(selector, scope = document) { return [...scope.querySelectorAll(selector)]; }
  function escapeHTML(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char])); }
  function formatBRL(value) { return Number(value).toLocaleString("pt-BR", { style:"currency", currency:"BRL" }); }
  function getUsers() { try { return JSON.parse(localStorage.getItem(STORAGE_USERS)) || []; } catch { return []; } }
  function saveUsers(users) { localStorage.setItem(STORAGE_USERS, JSON.stringify(users)); }
  function getSession() { try { return JSON.parse(localStorage.getItem(STORAGE_SESSION)); } catch { return null; } }
  function setSession(user) { localStorage.setItem(STORAGE_SESSION, JSON.stringify({ id:user.id })); }
  function clearSession() { localStorage.removeItem(STORAGE_SESSION); }
  function currentUser() { const session = getSession(); return session ? getUsers().find(user => user.id === session.id) || null : null; }
  function getUserProducts() { try { return JSON.parse(localStorage.getItem(STORAGE_PRODUCTS)) || []; } catch { return []; } }
  function saveUserProducts(items) { localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(items)); }
  function getAllProducts() { return [...getUserProducts(), ...products]; }
  function getUserServices() { try { return JSON.parse(localStorage.getItem(STORAGE_SERVICES)) || []; } catch { return []; } }
  function saveUserServices(items) { localStorage.setItem(STORAGE_SERVICES, JSON.stringify(items)); }

  function seedDemoUser() {
    const users = getUsers();
    if (!users.some(u => u.email === "demo@tiu.com")) {
      users.push({ id:"demo-user", name:"Usuário Demo", email:"demo@tiu.com", password:"123456", type:"cliente", location:"Santos, SP", createdAt:new Date().toISOString() });
      saveUsers(users);
    }
  }

  function setupMenu() {
    const toggle = $(".menu-toggle");
    const nav = $("#main-nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => { const open = nav.classList.toggle("open"); toggle.setAttribute("aria-expanded", String(open)); });
    $all(".main-nav a, .main-nav button", nav).forEach(link => link.addEventListener("click", () => { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }));
  }

  function setupAuthNav() {
    const nav = $("#main-nav");
    if (!nav) return;
    const user = currentUser();
    const login = $(".nav-login", nav);
    const signup = $(".nav-signup", nav);
    const divider = $(".nav-divider", nav);
    const existingAccount = $(".nav-account", nav);
    const existingLogout = $(".nav-logout", nav);
    if (user) {
      if (login) login.remove();
      if (signup) signup.remove();
      if (divider) divider.remove();
      if (existingAccount) existingAccount.remove();
      if (existingLogout) existingLogout.remove();
      const account = document.createElement("a");
      account.className = "nav-account";
      account.href = "dashboard.html";
      account.setAttribute("aria-label", `Abrir painel de ${user.name}`);
      const initials = user.name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(name => name[0])
        .join("")
        .toUpperCase();
      account.innerHTML = `<span class="nav-account-avatar" aria-hidden="true">${escapeHTML(initials || "U")}</span><span class="nav-account-name">${escapeHTML(user.name)}</span>`;
      nav.appendChild(account);
      const logout = document.createElement("button");
      logout.className = "nav-logout";
      logout.type = "button";
      logout.textContent = "Sair";
      logout.addEventListener("click", () => { clearSession(); window.location.href = "index.html"; });
      nav.appendChild(logout);
    }
  }

  function professionalCard(p) {
    const avatar = p.image ? `<img src="${escapeHTML(p.image)}" alt="Ilustração de ${escapeHTML(p.name)}">` : escapeHTML(p.initials);
    return `<article class="professional-card"><div class="avatar ${p.id === "marcos" ? "avatar-orange" : ""}">${avatar}</div><div class="card-body"><div class="card-topline"><span class="badge purple">${escapeHTML(p.profession)}</span><span class="rating">★ ${Number(p.rating).toFixed(1)}</span></div><h3>${escapeHTML(p.name)}</h3><p class="location">⌖ ${escapeHTML(p.location)}</p><p>${escapeHTML(p.description)}</p><div class="card-footer"><span class="muted">${escapeHTML(p.experience)} de experiência</span><a class="text-link" href="perfil-profissional.html?id=${encodeURIComponent(p.id)}">Ver perfil →</a></div></div></article>`;
  }

  function serviceCard(s) {
    return `<article class="service-card"><div class="service-card-icon">⚒</div><div class="service-card-body"><div class="card-topline"><span class="badge purple">${escapeHTML(s.category || "Serviço")}</span><span class="muted">${escapeHTML(s.location || "")}</span></div><h3>${escapeHTML(s.name)}</h3><strong class="price">${formatBRL(s.price)}${s.priceType === "a partir" ? " +" : ""}</strong><p>${escapeHTML(s.description)}</p><div class="card-footer"><span class="muted">${escapeHTML(s.ownerName || "Você")}</span><span class="text-link">Meu serviço ✓</span></div></div></article>`;
  }

  function productCard(p) {
    const visual = p.image ? `<img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}">` : `<span>${escapeHTML(p.icon || "▣")}</span>`;
    return `<article class="product-card"><a class="product-visual ${escapeHTML(p.tone || "purple")}" href="produtos.html?produto=${encodeURIComponent(p.id)}">${visual}<small>${escapeHTML(p.condition)}</small></a><div class="product-body"><div class="card-topline"><span class="badge orange">${escapeHTML(p.category)}</span><span class="muted">${escapeHTML(p.location)}</span></div><h3>${escapeHTML(p.name)}</h3><strong class="price">${formatBRL(p.price)}</strong><p>${escapeHTML(p.description)}</p><div class="card-footer"><span class="muted">Vendedor: ${escapeHTML(p.seller)}</span><a class="text-link" href="produtos.html?produto=${encodeURIComponent(p.id)}">Ver produto →</a></div></div></article>`;
  }

  function initHome() {
    $("#home-professionals")?.replaceChildren(...professionals.slice(0,4).map(p => { const t=document.createElement("template"); t.innerHTML=professionalCard(p); return t.content.firstElementChild; }));
    $("#home-products")?.replaceChildren(...getAllProducts().slice(0,4).map(p => { const t=document.createElement("template"); t.innerHTML=productCard(p); return t.content.firstElementChild; }));
    const form = $("#home-search");
    form?.addEventListener("submit", event => { event.preventDefault(); const query=$("#home-search-input").value.trim(); if(!query) return location.href="profissionais.html"; const found=professionals.some(p=>`${p.name} ${p.profession}`.toLowerCase().includes(query.toLowerCase())); location.href=`${found?"profissionais.html":"produtos.html"}?busca=${encodeURIComponent(query)}`; });
  }

  function initProfessionals() {
    const list=$("#professionals-list"); if(!list) return;
    const search=$("#professional-search"), category=$("#professional-category"), count=$("#professional-count"), empty=$("#professionals-empty");
    const params=new URLSearchParams(location.search); if(params.get("busca")) search.value=params.get("busca");
    const render=()=>{ const q=search.value.trim().toLowerCase(), cat=category.value.toLowerCase(); const filtered=professionals.filter(p=>{const text=`${p.name} ${p.profession} ${p.location} ${p.description}`.toLowerCase(); return (!q||text.includes(q))&&(!cat||p.profession.toLowerCase()===cat);}); list.innerHTML=filtered.map(professionalCard).join(""); count.textContent=`${filtered.length} profissional${filtered.length===1?"":"is"}`; empty.classList.toggle("hidden",filtered.length!==0); };
    search.addEventListener("input",render); category.addEventListener("change",render); render();
  }

  function initProducts() {
    const list=$("#products-list"); if(!list) return;
    const search=$("#product-search"), category=$("#product-category"), condition=$("#product-condition"), count=$("#product-count"), empty=$("#products-empty");
    const params=new URLSearchParams(location.search); if(params.get("busca")) search.value=params.get("busca");
    const detailId=params.get("produto");
    const all=getAllProducts();
    if(detailId){
      const product=all.find(p=>p.id===detailId);
      if(product){
        list.classList.add("product-detail-grid");
        const visual=product.image?`<img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}">`:`<span>${escapeHTML(product.icon||"▣")}</span>`;
        const owner=currentUser();
        const own=owner && product.ownerId===owner.id;
        list.innerHTML=`<article class="product-detail"><div class="product-detail-visual ${escapeHTML(product.tone||"purple")}">${visual}<small>${escapeHTML(product.condition)}</small></div><div class="product-detail-copy"><a class="back-link" href="produtos.html">← Voltar ao marketplace</a><span class="eyebrow">DETALHE DO PRODUTO</span><h1>${escapeHTML(product.name)}</h1><div class="detail-price">${formatBRL(product.price)}</div><div class="detail-meta"><span class="badge orange">${escapeHTML(product.condition)}</span><span>${escapeHTML(product.category)}</span><span>⌖ ${escapeHTML(product.location)}</span></div><p>${escapeHTML(product.description)}</p><div class="seller-box"><strong>Vendedor</strong><span>${escapeHTML(product.seller)}</span><small>${own?"Este anúncio pertence à sua conta.":"Contato demonstrativo pelo TIU."}</small></div>${own?`<button class="btn btn-secondary" id="delete-my-product" type="button">Excluir anúncio</button>`:`<button class="btn btn-primary" type="button" id="contact-product">Entrar em contato</button>`}<div class="form-message" id="product-contact-message"></div></div></article>`;
        count.textContent="1 produto"; empty.classList.add("hidden");
        $("#contact-product")?.addEventListener("click",()=>{const m=$("#product-contact-message");m.textContent="Contato simulado! Em uma versão real, aqui seria iniciado o fluxo de mensagem.";m.className="form-message success";});
        $("#delete-my-product")?.addEventListener("click",()=>{const items=getUserProducts().filter(item=>item.id!==product.id);saveUserProducts(items);location.href="dashboard.html";});
        return;
      }
    }
    const render=()=>{const q=search.value.trim().toLowerCase(),cat=category.value.toLowerCase(),cond=condition.value.toLowerCase();const filtered=getAllProducts().filter(p=>{const text=`${p.name} ${p.category} ${p.seller} ${p.location} ${p.description}`.toLowerCase();return(!q||text.includes(q))&&(!cat||p.category.toLowerCase()===cat)&&(!cond||p.condition.toLowerCase()===cond);});list.innerHTML=filtered.map(productCard).join("");count.textContent=`${filtered.length} produto${filtered.length===1?"":"s"}`;empty.classList.toggle("hidden",filtered.length!==0);};
    search.addEventListener("input",render); category.addEventListener("change",render); condition.addEventListener("change",render); render();
  }

  function initProfile() {
    const target=$("#profile-detail"); if(!target) return;
    const id=new URLSearchParams(location.search).get("id")||"joao"; const p=professionals.find(item=>item.id===id)||professionals[0];
    target.innerHTML=`<a class="back-link" href="profissionais.html">← Voltar para profissionais</a><div class="profile-card"><div class="profile-top"><div class="profile-avatar ${p.id==="marcos"?"avatar-orange":""}">${p.image?`<img src="${escapeHTML(p.image)}" alt="Ilustração de ${escapeHTML(p.name)}">`:escapeHTML(p.initials)}</div><div class="profile-main"><span class="badge purple">${escapeHTML(p.profession)}</span><h1>${escapeHTML(p.name)}</h1><p class="profile-location">⌖ ${escapeHTML(p.location)} · ★ ${Number(p.rating).toFixed(1)}</p><p>${escapeHTML(p.description)}</p><button class="btn btn-primary" id="contact-professional" type="button">Entrar em contato</button><div class="form-message" id="profile-message"></div></div></div><div class="profile-info-grid"><div class="info-panel"><span>Experiência</span><strong>${escapeHTML(p.experience)}</strong></div><div class="info-panel"><span>Avaliação</span><strong>★ ${Number(p.rating).toFixed(1)} / 5</strong></div><div class="info-panel"><span>Localização</span><strong>${escapeHTML(p.location)}</strong></div></div><div class="profile-description"><span class="eyebrow">SOBRE O PROFISSIONAL</span><h2>Serviços oferecidos</h2><div class="tag-list">${p.services.map(s=>`<span>${escapeHTML(s)}</span>`).join("")}</div></div></div>`;
    $("#contact-professional")?.addEventListener("click",()=>{const m=$("#profile-message");m.textContent="Contato simulado! Para o TCC, esta ação representa o início de uma conversa com o profissional.";m.className="form-message success";});
  }

  function setMessage(element,text,type="error"){if(!element)return;element.textContent=text;element.className=`form-message ${type}`;}

  function initForgotPassword(){
    const form=$("#forgot-password-form"); if(!form)return;
    const message=$("#forgot-message");
    form.addEventListener("submit",event=>{
      event.preventDefault();
      const email=$("#forgot-email").value.trim().toLowerCase();
      const password=$("#forgot-password").value;
      const confirm=$("#forgot-password-confirm").value;
      const users=getUsers();
      const index=users.findIndex(u=>u.email.toLowerCase()===email);
      if(index<0)return setMessage(message,"Não encontramos uma conta com esse e-mail.");
      if(password.length<6)return setMessage(message,"A nova senha precisa ter pelo menos 6 caracteres.");
      if(password!==confirm)return setMessage(message,"As senhas não coincidem.");
      users[index].password=password; saveUsers(users);
      setMessage(message,"Senha alterada com sucesso! Você já pode entrar com a nova senha.","success");
      setTimeout(()=>location.href="login.html",900);
    });
  }

  function initLogin(){seedDemoUser();const form=$("#login-form");if(!form)return;const message=$("#login-message");form.addEventListener("submit",event=>{event.preventDefault();const email=$("#login-email").value.trim().toLowerCase(),password=$("#login-password").value,user=getUsers().find(u=>u.email.toLowerCase()===email&&u.password===password);if(!user)return setMessage(message,"E-mail ou senha incorretos.");setSession(user);location.href="dashboard.html";});$("#fill-demo")?.addEventListener("click",()=>{$("#login-email").value="demo@tiu.com";$("#login-password").value="123456";setMessage(message,"Dados da conta demo preenchidos.","success");});}

  function initSignup(){
    const form=$("#signup-form");if(!form)return;
    const typeButtons=$all(".account-type"),typeInput=$("#signup-type"),professionalFields=$("#professional-fields"),message=$("#signup-message"),params=new URLSearchParams(location.search),editing=params.get("editar")==="1",editingUser=editing?currentUser():null,initialType=editingUser?.type|| (params.get("tipo")==="profissional"?"profissional":"cliente");
    if(editing&&!editingUser){location.href="login.html";return;}
    const setType=type=>{typeInput.value=type;typeButtons.forEach(btn=>btn.classList.toggle("active",btn.dataset.type===type));professionalFields.classList.toggle("hidden",type!=="profissional");$all("#professional-fields input, #professional-fields textarea").forEach(field=>field.required=type==="profissional");};
    typeButtons.forEach(btn=>btn.addEventListener("click",()=>{if(!editing)setType(btn.dataset.type);}));
    setType(initialType);
    if(editingUser){
      $(".auth-heading h1").textContent="Editar meu perfil";$(".auth-heading p").textContent="Atualize suas informações e mantenha seu perfil profissional em dia.";$("#signup-name").value=editingUser.name||"";$("#signup-location").value=editingUser.location||"";$("#signup-email").value=editingUser.email||"";$("#signup-password").value=editingUser.password||"";$("#signup-profession").value=editingUser.profession||"";$("#signup-area").value=editingUser.area||"";$("#signup-experience").value=editingUser.experience||"";$("#signup-description").value=editingUser.description||"";$("#signup-submit").textContent="Salvar alterações";typeButtons.forEach(btn=>btn.disabled=true);}
    form.addEventListener("submit",event=>{
      event.preventDefault();
      const name=$("#signup-name").value.trim(),locationValue=$("#signup-location").value.trim(),email=$("#signup-email").value.trim().toLowerCase(),password=$("#signup-password").value,type=typeInput.value;
      if(!name||!locationValue||!email||!password)return setMessage(message,"Preencha todos os campos obrigatórios.");
      if(password.length<6)return setMessage(message,"A senha precisa ter pelo menos 6 caracteres.");
      const users=getUsers();
      const duplicate=users.some(u=>u.email.toLowerCase()===email&&(!editingUser||u.id!==editingUser.id));
      if(duplicate)return setMessage(message,"Este e-mail já está cadastrado.");
      const data={name,location:locationValue,email,password,type,profession:$("#signup-profession")?.value.trim()||"",area:$("#signup-area")?.value.trim()||"",experience:$("#signup-experience")?.value.trim()||"",description:$("#signup-description")?.value.trim()||""};
      if(editingUser){const index=users.findIndex(u=>u.id===editingUser.id);users[index]={...users[index],...data};saveUsers(users);setMessage(message,"Perfil atualizado com sucesso!","success");setTimeout(()=>location.href="dashboard.html",700);}
      else {const user={id:`user-${Date.now()}`,...data,createdAt:new Date().toISOString()};users.push(user);saveUsers(users);setSession(user);location.href="dashboard.html";}
    });
  }

  function initAddProduct(){
    const form=$("#product-form"); if(!form)return;
    const user=currentUser(); if(!user){location.href="login.html?redirect=adicionar-produto.html";return;}
    $("#product-seller").value=user.name; $("#product-location").value=user.location||"";
    form.addEventListener("submit",async event=>{
      event.preventDefault();
      const message=$("#product-form-message");
      const name=$("#product-name").value.trim(), price=Number($("#product-price").value), category=$("#product-category").value, condition=$("#product-condition").value, locationValue=$("#product-location").value.trim(), description=$("#product-description").value.trim();
      if(!name||!price||price<0||!category||!condition||!locationValue||!description)return setMessage(message,"Preencha todos os campos obrigatórios.");
      let image=""; const file=$("#product-image").files[0];
      if(file){ try { image=await resizeImage(file); } catch { return setMessage(message,"Não foi possível processar a imagem. Tente outra foto."); } }
      const item={id:`user-product-${Date.now()}`,ownerId:user.id,name,price,category,condition,location:locationValue,seller:user.name,description,image,icon:"▣",tone:Math.random()>0.5?"purple":"orange",createdAt:new Date().toISOString()};
      try { const items=getUserProducts(); items.unshift(item); saveUserProducts(items); location.href=`produtos.html?produto=${encodeURIComponent(item.id)}`; } catch { setMessage(message,"Não foi possível salvar o anúncio. A imagem pode ser grande demais."); }
    });
  }

  function initAddService(){
    const form=$("#service-form"); if(!form)return;
    const user=currentUser(); if(!user){location.href="login.html?redirect=adicionar-servico.html";return;}
    if(user.type!=="profissional"){location.href="adicionar-produto.html";return;}
    $("#service-owner").value=user.name; $("#service-location").value=user.location||"";
    form.addEventListener("submit",event=>{
      event.preventDefault();
      const message=$("#service-form-message");
      const name=$("#service-name").value.trim(), price=Number($("#service-price").value), category=$("#service-category").value, priceType=$("#service-price-type").value, locationValue=$("#service-location").value.trim(), description=$("#service-description").value.trim();
      if(!name||!price||price<0||!category||!locationValue||!description)return setMessage(message,"Preencha todos os campos obrigatórios.");
      const item={id:`user-service-${Date.now()}`,ownerId:user.id,ownerName:user.name,name,price,category,priceType,location:locationValue,description,createdAt:new Date().toISOString()};
      try { const items=getUserServices(); items.unshift(item); saveUserServices(items); location.href="dashboard.html"; } catch { setMessage(message,"Não foi possível salvar o serviço."); }
    });
  }

  function resizeImage(file){return new Promise((resolve,reject)=>{if(!file.type.startsWith("image/"))return reject();const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onload=()=>{const max=1000,scale=Math.min(1,max/img.width,max/img.height),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.78));};img.onerror=reject;img.src=reader.result;};reader.readAsDataURL(file);});}

  function initDashboard(){
    const user=currentUser(); if(!user){location.href="login.html";return;}
    $("#dashboard-name").textContent=user.name.split(" ")[0];
    $("#account-name").textContent=user.name;
    $("#account-location").textContent=user.location||"Não informado";
    $("#dashboard-avatar").textContent=user.name.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase();
    $("#account-type").textContent=user.type==="profissional"?"Profissional":"Cliente";
    const isProfessional=user.type==="profissional";
    $("#account-profession-wrap").classList.toggle("hidden",!isProfessional);
    $("#account-profession").textContent=user.profession||user.area||"Não informado";
    $("#client-dashboard").classList.toggle("hidden",isProfessional);
    $("#professional-dashboard").classList.toggle("hidden",!isProfessional);
    const myProducts=getUserProducts().filter(p=>p.ownerId===user.id);
    if($("#my-products-count")) $("#my-products-count").textContent=myProducts.length;
    $("#my-products-list")?.replaceChildren(...(myProducts.length?myProducts.map(p=>{const t=document.createElement("template");t.innerHTML=productCard(p);return t.content.firstElementChild;}):[]));
    $("#my-products-empty")?.classList.toggle("hidden",myProducts.length!==0);
    if(isProfessional){
      $("#summary-profession").textContent=user.profession||"Não informado";
      $("#summary-area").textContent=user.area||"Não informado";
      $("#summary-experience").textContent=user.experience||"Não informado";
      $("#summary-description").textContent=user.description||"Ainda não preenchida.";
      const myServices=getUserServices().filter(s=>s.ownerId===user.id);
      $("#my-services-count").textContent=myServices.length;
      $("#my-professional-products-count").textContent=myProducts.length;
      $("#my-services-list")?.replaceChildren(...myServices.map(s=>{const t=document.createElement("template");t.innerHTML=serviceCard(s);return t.content.firstElementChild;}));
      $("#my-services-empty")?.classList.toggle("hidden",myServices.length!==0);
      $("#professional-products-list")?.replaceChildren(...myProducts.map(p=>{const t=document.createElement("template");t.innerHTML=productCard(p);return t.content.firstElementChild;}));
      $("#professional-products-empty")?.classList.toggle("hidden",myProducts.length!==0);
    }
    const logout=()=>{clearSession();location.href="index.html";};
    $("#dashboard-logout")?.addEventListener("click",logout);$("#nav-logout")?.addEventListener("click",logout);$("#footer-logout")?.addEventListener("click",logout);
  }

  function init(){setupAuthNav();setupMenu();const page=document.body.dataset.page;if(page==="home")initHome();if(page==="professionals")initProfessionals();if(page==="products")initProducts();if(page==="profile")initProfile();if(page==="login")initLogin();if(page==="forgot-password")initForgotPassword();if(page==="signup")initSignup();if(page==="dashboard")initDashboard();if(page==="add-product")initAddProduct();if(page==="add-service")initAddService();}
  document.addEventListener("DOMContentLoaded",init);
})();
