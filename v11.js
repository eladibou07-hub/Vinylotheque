(() => {
  const SUPABASE_URL="https://yjudyoihvmfvunvkmbtu.supabase.co";
  const SUPABASE_KEY="sb_publishable_ElM2fDRqtESnArx3ymqTJA_s1XeUcpr";
  const PROFILE_KEY="vinylotheque.profile.v1";
  const COLLECTION_KEY="vinylotheque.collection.v4";
  const LAST_SYNC_KEY="vinylotheque.sync.lastSyncAt";
  const LOCAL_CHANGE_KEY="vinylotheque.sync.localChangedAt";
  const sb=window.supabase?.createClient?.(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  if(!sb){ console.error("Supabase client indisponible"); return; }

  let session=null;
  let syncing=false;
  let syncTimer=null;
  let pendingEmail="";
  let initialized=false;

  const isoNow=()=>new Date().toISOString();
  const ms=v=>v ? new Date(v).getTime()||0 : 0;
  const escHtml=v=>typeof esc==="function"?esc(v):String(v||"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]));

  function localProfile(){
    try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||"{}")||{};}catch{return {};}
  }
  function setLocalProfile(p){
    localStorage.setItem(PROFILE_KEY,JSON.stringify(p||{}));
    window.dispatchEvent(new CustomEvent("vinyl:profile-restored"));
  }
  function markSynced(at=isoNow()){
    localStorage.setItem(LAST_SYNC_KEY,at);
    localStorage.setItem(LOCAL_CHANGE_KEY,at);
    updateSyncUI("synchronized");
  }
  function setLocalCollection(rows){
    collection=Array.isArray(rows)?rows:[];
    localStorage.setItem(COLLECTION_KEY,JSON.stringify(collection));
    render();
  }
  function recordStamp(r){return Number(r?.updatedAt||r?.addedAt||0);}
  function mergeCollections(localRows,remoteRows){
    const map=new Map();
    for(const r of [...(remoteRows||[]),...(localRows||[])]){
      if(!r?.id)continue;
      const old=map.get(r.id);
      if(!old || recordStamp(r)>=recordStamp(old)) map.set(r.id,r);
    }
    return [...map.values()];
  }
  function mergeProfiles(localP,remoteP){
    const l=localP&&typeof localP==="object"?localP:{};
    const r=remoteP&&typeof remoteP==="object"?remoteP:{};
    return {...r,...Object.fromEntries(Object.entries(l).filter(([,v])=>v!==""&&v!=null))};
  }

  function ensureSyncButton(){
    const actions=document.querySelector(".header-actions");
    if(!actions || actions.querySelector("#syncAccountBtn")) return;
    const b=document.createElement("button");
    b.id="syncAccountBtn";b.type="button";b.className="icon-btn sync-account-btn";
    b.setAttribute("aria-label","Compte et synchronisation");
    b.title="Compte et synchronisation";
    b.innerHTML='<span class="sync-dot"></span><span class="sync-cloud">☁</span>';
    b.addEventListener("click",()=>openSyncDialog());
    const profile=document.querySelector("#profileBtn");
    actions.insertBefore(b,profile||actions.firstChild);
    updateSyncUI();
  }

  function ensureSyncDialog(){
    let d=document.querySelector("#syncDialog");
    if(d)return d;
    d=document.createElement("dialog");
    d.id="syncDialog";
    d.className="modal small sync-dialog";
    d.innerHTML=
      '<div class="modal-head"><div><p class="eyebrow">COMPTE VINYLOTHÈQUE</p><h2>Synchronisation</h2></div><button type="button" class="icon-btn" data-sync-close>✕</button></div>'+
      '<div id="syncLoggedOut">'+
        '<p>Retrouve la même collection sur plusieurs appareils. Aucun mot de passe à mémoriser.</p>'+
        '<label class="sync-label">Adresse e-mail<input id="syncEmail" type="email" autocomplete="email" placeholder="ton@email.fr"></label>'+
        '<button type="button" class="btn primary sync-wide" id="syncSendCode">Recevoir mon accès</button>'+
        '<div id="syncOtpArea" hidden>'+
          '<p class="hint">Saisis le code reçu par e-mail. Si ton e-mail contient un lien de connexion, tu peux aussi simplement l’ouvrir.</p>'+
          '<label class="sync-label">Code à 6 chiffres<input id="syncOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"></label>'+
          '<button type="button" class="btn primary sync-wide" id="syncVerifyCode">Me connecter</button>'+
        '</div>'+
        '<p class="hint">Le mode local continue de fonctionner même sans compte.</p>'+
      '</div>'+
      '<div id="syncLoggedIn" hidden>'+
        '<div class="sync-user"><div class="sync-avatar">@</div><div><strong id="syncUserEmail"></strong><span>Compte Vinylothèque</span></div></div>'+
        '<div class="sync-state-card"><span id="syncStateIcon">✓</span><div><strong id="syncStateTitle">Synchronisé</strong><small id="syncStateText">Ta collection est sauvegardée dans le cloud.</small></div></div>'+
        '<div class="sync-meta"><span>Dernière synchro</span><strong id="syncLastDate">—</strong></div>'+
        '<div class="sync-actions"><button type="button" class="btn primary" id="syncNow">↻ Synchroniser maintenant</button><button type="button" class="btn secondary" id="syncLogout">Se déconnecter</button></div>'+
      '</div>';
    document.body.appendChild(d);
    d.querySelector("[data-sync-close]").addEventListener("click",()=>d.close());
    d.querySelector("#syncSendCode").addEventListener("click",sendCode);
    d.querySelector("#syncVerifyCode").addEventListener("click",verifyCode);
    d.querySelector("#syncNow").addEventListener("click",()=>syncNow({manual:true}));
    d.querySelector("#syncLogout").addEventListener("click",logout);
    d.querySelector("#syncOtp").addEventListener("keydown",e=>{if(e.key==="Enter")verifyCode();});
    return d;
  }

  function openSyncDialog(){
    const d=ensureSyncDialog();
    renderAuthState();
    d.showModal();
  }

  function updateSyncUI(state){
    const b=document.querySelector("#syncAccountBtn");
    if(!b)return;
    b.classList.toggle("connected",!!session);
    b.classList.toggle("syncing",state==="syncing"||syncing);
    b.classList.toggle("error",state==="error");
    b.title=session ? "Compte connecté · synchronisation cloud" : "Activer la synchronisation";
  }

  function renderAuthState(){
    const d=ensureSyncDialog();
    const out=d.querySelector("#syncLoggedOut");
    const inside=d.querySelector("#syncLoggedIn");
    out.hidden=!!session;inside.hidden=!session;
    if(session){
      d.querySelector("#syncUserEmail").textContent=session.user?.email||"Compte connecté";
      const last=localStorage.getItem(LAST_SYNC_KEY);
      d.querySelector("#syncLastDate").textContent=last?new Date(last).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"}):"Jamais";
    }
  }

  async function sendCode(){
    const d=ensureSyncDialog();
    const email=d.querySelector("#syncEmail").value.trim().toLowerCase();
    if(!email || !email.includes("@")){toast("Saisis une adresse e-mail valide");return;}
    const btn=d.querySelector("#syncSendCode");btn.disabled=true;btn.textContent="Envoi…";
    pendingEmail=email;
    const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:true}});
    btn.disabled=false;btn.textContent="Recevoir mon accès";
    if(error){
      toast(error.message?.includes("authorized")?"Envoi e-mail non encore configuré pour cette adresse":"Impossible d’envoyer l’accès : "+error.message);
      return;
    }
    d.querySelector("#syncOtpArea").hidden=false;
    d.querySelector("#syncOtp").focus();
    toast("E-mail de connexion envoyé");
  }

  async function verifyCode(){
    const d=ensureSyncDialog();
    const email=pendingEmail||d.querySelector("#syncEmail").value.trim().toLowerCase();
    const token=d.querySelector("#syncOtp").value.replace(/\D/g,"");
    if(!email||token.length!==6){toast("Saisis le code à 6 chiffres");return;}
    const btn=d.querySelector("#syncVerifyCode");btn.disabled=true;btn.textContent="Connexion…";
    const {data,error}=await sb.auth.verifyOtp({email,token,type:"email"});
    btn.disabled=false;btn.textContent="Me connecter";
    if(error){toast("Code incorrect ou expiré");return;}
    session=data.session||session;
    renderAuthState();
    await syncNow({firstLogin:true});
    toast("Compte connecté");
  }

  async function logout(){
    await sb.auth.signOut();
    session=null;
    localStorage.removeItem(LAST_SYNC_KEY);
    renderAuthState();updateSyncUI();
    toast("Déconnecté · la collection reste sur cet appareil");
  }

  async function fetchRemote(){
    const {data,error}=await sb.from("user_collections").select("collection,profile,client_updated_at,updated_at").eq("user_id",session.user.id).maybeSingle();
    if(error)throw error;
    return data;
  }

  async function pushCloud(rows=collection,profile=localProfile()){
    const stamp=isoNow();
    const {error}=await sb.from("user_collections").upsert({
      user_id:session.user.id,
      collection:rows,
      profile,
      client_updated_at:stamp
    },{onConflict:"user_id"});
    if(error)throw error;
    markSynced(stamp);
  }

  async function syncNow({manual=false,firstLogin=false}={}){
    if(!session||syncing)return;
    syncing=true;updateSyncUI("syncing");
    try{
      const remote=await fetchRemote();
      const localRows=[...collection];
      const localP=localProfile();
      const lastSync=localStorage.getItem(LAST_SYNC_KEY);
      const localChanged=localStorage.getItem(LOCAL_CHANGE_KEY);
      if(!remote){
        await pushCloud(localRows,localP);
      }else if(firstLogin || !lastSync){
        const remoteRows=Array.isArray(remote.collection)?remote.collection:[];
        let merged;
        if(!localRows.length) merged=remoteRows;
        else if(!remoteRows.length) merged=localRows;
        else merged=mergeCollections(localRows,remoteRows);
        const profile=mergeProfiles(localP,remote.profile);
        setLocalCollection(merged);setLocalProfile(profile);
        await pushCloud(merged,profile);
      }else{
        const remoteTime=ms(remote.client_updated_at||remote.updated_at);
        const lastTime=ms(lastSync);
        const localTime=ms(localChanged);
        const localDirty=localTime>lastTime+500;
        const remoteDirty=remoteTime>lastTime+500;
        if(localDirty && remoteDirty){
          const merged=mergeCollections(localRows,Array.isArray(remote.collection)?remote.collection:[]);
          const profile=mergeProfiles(localP,remote.profile);
          setLocalCollection(merged);setLocalProfile(profile);
          await pushCloud(merged,profile);
          toast("Modifications des deux appareils fusionnées");
        }else if(localDirty){
          await pushCloud(localRows,localP);
        }else if(remoteDirty){
          setLocalCollection(remote.collection||[]);
          setLocalProfile(remote.profile||{});
          markSynced(remote.client_updated_at||remote.updated_at||isoNow());
          if(manual)toast("Collection mise à jour depuis le cloud");
        }else if(manual){
          toast("Tout est déjà synchronisé");
        }
      }
      renderAuthState();
    }catch(err){
      console.error("Sync Vinylothèque",err);
      updateSyncUI("error");
      if(manual)toast("Synchronisation impossible pour le moment");
    }finally{
      syncing=false;
      if(!document.querySelector("#syncAccountBtn")?.classList.contains("error"))updateSyncUI();
    }
  }

  function scheduleSync(){
    if(!session)return;
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>syncNow(),1200);
  }

  function enhanceProfileDialog(){
    const d=document.querySelector("#profileDialog");
    if(!d || d.querySelector("[data-v11-sync]"))return;
    const grid=d.querySelector(".profile-action-grid");
    if(!grid)return;
    const b=document.createElement("button");b.type="button";b.className="btn secondary";b.dataset.v11Sync="1";
    b.textContent="☁ Compte & synchro";
    b.addEventListener("click",()=>{d.close();openSyncDialog();});
    grid.prepend(b);
  }

  const css=document.createElement("style");
  css.textContent=`
    .sync-account-btn{position:relative}.sync-cloud{font-size:1.05rem}.sync-dot{position:absolute;right:4px;bottom:4px;width:7px;height:7px;border-radius:50%;background:#999;border:1px solid #fff}.sync-account-btn.connected .sync-dot{background:#35a65a}.sync-account-btn.syncing .sync-dot{background:#d5a526;animation:v11pulse .8s infinite}.sync-account-btn.error .sync-dot{background:#b23434}@keyframes v11pulse{50%{opacity:.3}}
    .sync-label{display:grid;gap:6px;font-weight:800;font-size:.84rem;margin-top:12px}.sync-label input{font:inherit;border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff}.sync-wide{width:100%;margin-top:12px}.sync-user{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid var(--line);border-radius:15px;background:#faf9f6}.sync-avatar{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#f4e3ad;font-weight:900}.sync-user strong,.sync-user span{display:block}.sync-user span{font-size:.75rem;color:var(--muted);margin-top:2px}.sync-state-card{display:flex;gap:12px;align-items:center;margin-top:12px;padding:13px;border:1px solid #c9dfcd;background:#f2fbf4;border-radius:15px}.sync-state-card>span{font-size:1.25rem}.sync-state-card strong,.sync-state-card small{display:block}.sync-state-card small{color:var(--muted);margin-top:3px}.sync-meta{display:flex;justify-content:space-between;gap:12px;margin:13px 0;font-size:.8rem}.sync-actions{display:grid;gap:8px}
  `;
  document.head.appendChild(css);

  window.addEventListener("vinyl:collection-changed",scheduleSync);
  window.addEventListener("vinyl:profile-changed",scheduleSync);
  window.addEventListener("focus",()=>{if(session)syncNow();});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&session)syncNow();});

  sb.auth.onAuthStateChange(async(event,newSession)=>{
    session=newSession;
    renderAuthState();updateSyncUI();
    if(session && initialized && (event==="SIGNED_IN"||event==="TOKEN_REFRESHED")) await syncNow({firstLogin:event==="SIGNED_IN"});
  });

  (async()=>{
    const {data}=await sb.auth.getSession();
    session=data.session||null;
    initialized=true;
    ensureSyncButton();ensureSyncDialog();enhanceProfileDialog();renderAuthState();updateSyncUI();
    if(session)await syncNow();
  })();

  let timer;
  new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{ensureSyncButton();enhanceProfileDialog();},80);}).observe(document.body,{childList:true,subtree:true});
})();