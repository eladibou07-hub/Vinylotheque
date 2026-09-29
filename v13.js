(() => {
  const SHARE_ENDPOINT="https://yjudyoihvmfvunvkmbtu.supabase.co/functions/v1/collection-share";
  const SUPABASE_URL="https://yjudyoihvmfvunvkmbtu.supabase.co";
  const SUPABASE_KEY="sb_publishable_ElM2fDRqtESnArx3ymqTJA_s1XeUcpr";
  const COLLECTION_KEY="vinylotheque.collection.v4";
  const PROFILE_KEY="vinylotheque.profile.v1";
  const SHARE_ID_KEY="vinylotheque.share.id";
  const sb=window.supabase?.createClient?.(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  let autoTimer=null;

  function readJson(key,fallback){
    try{const v=JSON.parse(localStorage.getItem(key)||"");return v??fallback;}catch{return fallback;}
  }
  function getCollection(){const v=readJson(COLLECTION_KEY,[]);return Array.isArray(v)?v:[];}
  function getProfile(){const v=readJson(PROFILE_KEY,{});return v&&typeof v==="object"?v:{};}
  function shareUrl(id){
    const u=new URL("./share.html",location.href);
    u.search="";
    u.hash="";
    u.searchParams.set("id",id);
    return u.href;
  }
  function setMessage(text,type){
    const el=document.querySelector("#shareMessage");
    if(!el)return;
    el.textContent=text||"";
    el.dataset.type=type||"";
  }
  function renderLink(id){
    const area=document.querySelector("#shareLinkArea");
    const input=document.querySelector("#shareLink");
    if(!area||!input)return;
    area.hidden=!id;
    input.value=id?shareUrl(id):"";
  }
  async function sessionOrNull(){
    if(!sb)return null;
    const r=await sb.auth.getSession();
    return r?.data?.session||null;
  }
  async function publish(opts){
    const silent=!!opts?.silent;
    const session=await sessionOrNull();
    if(!session){
      if(!silent){
        setMessage("Connecte-toi au compte Vinylothèque pour créer un lien public.","warn");
        const b=document.querySelector("#shareLoginBtn");if(b)b.hidden=false;
      }
      return null;
    }
    if(!silent)setMessage("Création de la page en lecture seule…","");
    const res=await fetch(SHARE_ENDPOINT,{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},
      body:JSON.stringify({collection:getCollection(),profile:getProfile()})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.share_id){
      if(!silent)setMessage(data.error||"Impossible de créer le partage.","error");
      return null;
    }
    localStorage.setItem(SHARE_ID_KEY,data.share_id);
    renderLink(data.share_id);
    const b=document.querySelector("#shareLoginBtn");if(b)b.hidden=true;
    if(!silent)setMessage("Lien prêt. La page est en lecture seule.","ok");
    return data.share_id;
  }
  async function revoke(){
    const session=await sessionOrNull();
    if(!session){setMessage("Connexion requise pour désactiver le lien.","warn");return;}
    if(!confirm("Désactiver le lien public ?"))return;
    setMessage("Désactivation du lien…","");
    const res=await fetch(SHARE_ENDPOINT,{method:"DELETE",headers:{"Authorization":"Bearer "+session.access_token}});
    const data=await res.json().catch(()=>({}));
    if(!res.ok){setMessage(data.error||"Impossible de désactiver le lien.","error");return;}
    localStorage.removeItem(SHARE_ID_KEY);
    renderLink("");
    setMessage("Lien désactivé.","ok");
  }
  async function copyLink(){
    const input=document.querySelector("#shareLink");
    if(!input?.value)return;
    try{await navigator.clipboard.writeText(input.value);}
    catch{input.select();document.execCommand("copy");}
    setMessage("Lien copié.","ok");
  }
  async function nativeShare(){
    const input=document.querySelector("#shareLink");
    if(!input?.value)return;
    const p=getProfile();
    if(navigator.share){
      try{await navigator.share({title:p.collectionName||"Ma Vinylothèque",text:"Découvre ma collection de vinyles en lecture seule.",url:input.value});}catch{}
    }else await copyLink();
  }
  function ensureDialog(){
    let d=document.querySelector("#shareDialog");
    if(d)return d;
    d=document.createElement("dialog");
    d.id="shareDialog";
    d.className="modal small share-dialog";
    d.innerHTML=
      '<div class="modal-head"><div><p class="eyebrow">PARTAGE</p><h2>Collection en lecture seule</h2></div><button type="button" class="icon-btn" data-share-close>✕</button></div>'+
      '<p>Crée une page publique que tes amis peuvent consulter sans compte. Ils ne peuvent rien modifier.</p>'+
      '<div class="share-privacy"><strong>🔒 Reste privé</strong><span>Notes personnelles, emplacement, code-barres, e-mail et données de compte.</span></div>'+
      '<p id="shareMessage" class="hint"></p>'+
      '<button type="button" class="btn primary share-wide" id="sharePublishBtn">↗ Créer / actualiser le lien</button>'+
      '<button type="button" class="btn secondary share-wide" id="shareLoginBtn" hidden>☁ Se connecter au compte</button>'+
      '<div id="shareLinkArea" hidden>'+
        '<label class="share-label">Lien public<input id="shareLink" type="text" readonly></label>'+
        '<div class="share-actions"><button type="button" class="btn primary" id="shareNativeBtn">Partager</button><button type="button" class="btn secondary" id="shareCopyBtn">Copier</button></div>'+
        '<button type="button" class="share-revoke" id="shareRevokeBtn">Désactiver ce lien</button>'+
      '</div>';
    document.body.appendChild(d);
    d.querySelector("[data-share-close]").addEventListener("click",()=>d.close());
    d.querySelector("#sharePublishBtn").addEventListener("click",()=>publish({silent:false}));
    d.querySelector("#shareCopyBtn").addEventListener("click",copyLink);
    d.querySelector("#shareNativeBtn").addEventListener("click",nativeShare);
    d.querySelector("#shareRevokeBtn").addEventListener("click",revoke);
    d.querySelector("#shareLoginBtn").addEventListener("click",()=>{d.close();document.querySelector("#syncAccountBtn")?.click();});
    const existing=localStorage.getItem(SHARE_ID_KEY)||"";
    renderLink(existing);
    if(existing)setMessage("Ton dernier lien est disponible. Actualise-le après des changements.","ok");
    return d;
  }
  function ensureButton(){
    const actions=document.querySelector(".header-actions");
    if(!actions||actions.querySelector("#shareCollectionBtn"))return;
    const b=document.createElement("button");
    b.id="shareCollectionBtn";b.type="button";b.className="icon-btn";
    b.title="Partager ma collection";b.setAttribute("aria-label","Partager ma collection");b.textContent="↗";
    b.addEventListener("click",()=>ensureDialog().showModal());
    const settings=document.querySelector("#settingsBtn");
    actions.insertBefore(b,settings||null);
  }
  function scheduleAutoPublish(){
    if(!localStorage.getItem(SHARE_ID_KEY))return;
    clearTimeout(autoTimer);
    autoTimer=setTimeout(()=>publish({silent:true}),1800);
  }

  const css=document.createElement("style");
  css.textContent=".share-dialog .share-wide{width:100%;margin-top:9px}.share-privacy{display:grid;gap:4px;margin:12px 0;padding:12px;border:1px solid var(--line);border-radius:14px;background:#fff9e9}.share-privacy span{font-size:.78rem;color:var(--muted);line-height:1.4}.share-label{display:grid;gap:6px;margin-top:14px;font-size:.78rem;font-weight:800}.share-label input{width:100%;font:inherit;padding:11px;border:1px solid var(--line);border-radius:12px;background:#fff}.share-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.share-revoke{width:100%;margin-top:12px;border:0;background:transparent;color:#9b2c2c;text-decoration:underline;cursor:pointer}#shareMessage[data-type=ok]{color:#277043}#shareMessage[data-type=error]{color:#a42c2c}#shareMessage[data-type=warn]{color:#8a6200}";
  document.head.appendChild(css);

  ensureButton();
  ensureDialog();
  window.addEventListener("vinyl:collection-changed",scheduleAutoPublish);
  window.addEventListener("vinyl:profile-changed",scheduleAutoPublish);
})();