(() => {
  const PROFILE_KEY="vinylotheque.profile.v1";
  const LAST_BACKUP_KEY="vinylotheque.lastBackupAt";
  const APP_VERSION="10.0";

  function readProfile(){
    try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||"null");}catch{return null;}
  }
  function saveProfile(profile){
    localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));
    refreshProfileUI();
  }
  function ensureProfile(){
    let p=readProfile();
    if(p)return p;
    return {
      id:(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(16).slice(2)),
      displayName:"",
      collectionName:"Ma collection",
      mode:"local",
      syncProvider:null,
      createdAt:Date.now(),
      schemaVersion:1
    };
  }
  function fmtDate(ts){
    if(!ts)return "Jamais";
    try{return new Date(Number(ts)).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});}catch{return "—";}
  }

  function ensureHeaderButtons(){
    const actions=document.querySelector(".header-actions");
    if(!actions)return;
    if(!actions.querySelector("#profileBtn")){
      const b=document.createElement("button");
      b.id="profileBtn";b.type="button";b.className="icon-btn";b.setAttribute("aria-label","Profil");b.textContent="👤";
      b.addEventListener("click",()=>openProfile());
      actions.insertBefore(b,document.querySelector("#settingsBtn"));
    }
    if(!actions.querySelector("#aboutBtn")){
      const b=document.createElement("button");
      b.id="aboutBtn";b.type="button";b.className="icon-btn";b.setAttribute("aria-label","À propos");b.textContent="ⓘ";
      b.addEventListener("click",()=>ensureAboutDialog().showModal());
      actions.appendChild(b);
    }
  }

  function ensureWelcomeDialog(){
    let d=document.querySelector("#welcomeDialog");
    if(d)return d;
    d=document.createElement("dialog");
    d.id="welcomeDialog";
    d.className="modal welcome-dialog";
    d.innerHTML=
      '<div class="welcome-brand"><img src="icons/icon.svg?v=10.0" alt=""><div><p class="eyebrow">BIENVENUE</p><h2>Ta Vinylothèque</h2></div></div>'+
      '<p class="welcome-intro">Crée ta collection de vinyles sur cet appareil. Aucun compte n’est obligatoire.</p>'+
      '<div class="welcome-grid">'+
        '<label>Ton prénom ou pseudo<input id="welcomeName" autocomplete="name" placeholder="Ex. Alex"></label>'+
        '<label>Nom de la collection<input id="welcomeCollection" value="Ma collection" placeholder="Ma collection"></label>'+
      '</div>'+
      '<div class="welcome-mode"><strong>✓ Mode local</strong><span>Tes vinyles restent dans ce navigateur. Tu peux les sauvegarder et les restaurer avec un fichier JSON.</span></div>'+
      '<div class="welcome-mode disabled"><strong>☁ Synchronisation cloud</strong><span>Prévue pour une prochaine étape. Elle restera facultative.</span></div>'+
      '<div class="welcome-actions">'+
        '<button type="button" class="btn secondary" id="welcomeLocal">Commencer sans Discogs</button>'+
        '<button type="button" class="btn primary" id="welcomeDiscogs">Commencer + configurer Discogs</button>'+
      '</div>'+
      '<p class="hint">Le jeton Discogs, si tu en ajoutes un, reste lui aussi uniquement sur cet appareil et n’est jamais inclus dans les sauvegardes.</p>';
    document.body.appendChild(d);

    const finish=withDiscogs=>{
      const p=ensureProfile();
      p.displayName=d.querySelector("#welcomeName").value.trim();
      p.collectionName=d.querySelector("#welcomeCollection").value.trim()||"Ma collection";
      p.mode="local";
      p.onboardedAt=Date.now();
      saveProfile(p);
      d.close();
      if(withDiscogs){
        const settings=document.querySelector("#settingsDialog");
        if(settings)settings.showModal();
      }else{
        toast("Bienvenue dans Vinylothèque");
      }
    };
    d.querySelector("#welcomeLocal").addEventListener("click",()=>finish(false));
    d.querySelector("#welcomeDiscogs").addEventListener("click",()=>finish(true));
    return d;
  }

  function ensureProfileDialog(){
    let d=document.querySelector("#profileDialog");
    if(d)return d;
    d=document.createElement("dialog");
    d.id="profileDialog";
    d.className="modal small profile-dialog";
    d.innerHTML=
      '<div class="modal-head"><div><p class="eyebrow">PROFIL LOCAL</p><h2>Ma Vinylothèque</h2></div><button type="button" class="icon-btn" data-profile-close>✕</button></div>'+
      '<div class="profile-avatar" id="profileAvatar">V</div>'+
      '<label>Prénom ou pseudo<input id="profileName" placeholder="Ex. Alex"></label>'+
      '<label>Nom de la collection<input id="profileCollection" placeholder="Ma collection"></label>'+
      '<div class="profile-storage"><strong>📱 Sur cet appareil</strong><span>Aucun compte ni serveur distant n’est utilisé actuellement.</span></div>'+
      '<div class="profile-backup-status"><span>Dernière sauvegarde</span><strong id="profileBackupDate">Jamais</strong></div>'+
      '<div class="profile-action-grid">'+
        '<button type="button" class="btn primary" id="profileBackup">💾 Sauvegarder</button>'+
        '<button type="button" class="btn secondary" id="profileRestore">↥ Restaurer</button>'+
        '<button type="button" class="btn secondary" id="profileDiscogs">Discogs</button>'+
        '<button type="button" class="btn secondary" id="profileAbout">À propos</button>'+
      '</div>'+
      '<div class="modal-actions"><button type="button" class="btn primary" id="profileSave">Enregistrer le profil</button></div>';
    document.body.appendChild(d);
    d.querySelector("[data-profile-close]").addEventListener("click",()=>d.close());
    d.querySelector("#profileSave").addEventListener("click",()=>{
      const p=ensureProfile();
      p.displayName=d.querySelector("#profileName").value.trim();
      p.collectionName=d.querySelector("#profileCollection").value.trim()||"Ma collection";
      p.mode="local";p.updatedAt=Date.now();
      saveProfile(p);d.close();toast("Profil enregistré");
    });
    d.querySelector("#profileBackup").addEventListener("click",()=>document.querySelector("#exportJsonBtn")?.click());
    d.querySelector("#profileRestore").addEventListener("click",()=>document.querySelector("#importJsonBtn")?.click());
    d.querySelector("#profileDiscogs").addEventListener("click",()=>{
      d.close();document.querySelector("#settingsBtn")?.click();
    });
    d.querySelector("#profileAbout").addEventListener("click",()=>{
      d.close();ensureAboutDialog().showModal();
    });
    return d;
  }

  function openProfile(){
    const d=ensureProfileDialog();
    const p=readProfile()||ensureProfile();
    d.querySelector("#profileName").value=p.displayName||"";
    d.querySelector("#profileCollection").value=p.collectionName||"Ma collection";
    d.querySelector("#profileBackupDate").textContent=fmtDate(localStorage.getItem(LAST_BACKUP_KEY));
    const initial=(p.displayName||p.collectionName||"V").trim().charAt(0).toUpperCase()||"V";
    d.querySelector("#profileAvatar").textContent=initial;
    d.showModal();
  }

  function ensureAboutDialog(){
    let d=document.querySelector("#aboutV10Dialog");
    if(d)return d;
    d=document.createElement("dialog");
    d.id="aboutV10Dialog";
    d.className="modal about-dialog";
    d.innerHTML=
      '<div class="modal-head"><div><p class="eyebrow">VINYLOTHÈQUE</p><h2>À propos & confidentialité</h2></div><button type="button" class="icon-btn" data-about-close>✕</button></div>'+
      '<div class="about-sections">'+
        '<section><h3>🔒 Tes données</h3><p>La collection, le profil et les préférences sont enregistrés localement dans ce navigateur. Elles ne sont pas envoyées vers un compte Vinylothèque ou une base de données distante.</p></section>'+
        '<section><h3>💾 Sauvegarde</h3><p>Utilise régulièrement la sauvegarde JSON. Effacer les données du site ou réinitialiser le navigateur peut supprimer la collection locale.</p></section>'+
        '<section><h3>🎵 Discogs</h3><p>La recherche d’éditions peut utiliser l’API Discogs. Ton jeton personnel reste dans ce navigateur et n’est pas inclus dans les sauvegardes.</p><p class="discogs-credit">Certaines données sont fournies par Discogs. Vinylothèque n’est ni affiliée, ni sponsorisée, ni approuvée par Discogs.</p></section>'+
        '<section><h3>☁ Synchronisation</h3><p>La structure du profil est prête pour une future synchronisation facultative entre plusieurs appareils. Cette fonction n’est pas encore activée.</p></section>'+
      '</div>'+
      '<p class="about-version">Version '+APP_VERSION+'</p>';
    document.body.appendChild(d);
    d.querySelector("[data-about-close]").addEventListener("click",()=>d.close());
    return d;
  }

  function ensureDashboardBackup(){
    const dash=document.querySelector("#dashboardHome");
    if(!dash)return;
    let card=dash.querySelector("#v10BackupCard");
    if(!card){
      card=document.createElement("section");
      card.id="v10BackupCard";
      card.className="v10-backup-card";
      const all=dash.querySelector(".dash-all");
      if(all)all.before(card);else dash.appendChild(card);
      card.addEventListener("click",e=>{
        if(e.target.closest("[data-v10-backup]"))document.querySelector("#exportJsonBtn")?.click();
        if(e.target.closest("[data-v10-profile]"))openProfile();
      });
    }
    const p=readProfile();
    const date=fmtDate(localStorage.getItem(LAST_BACKUP_KEY));
    const markup=
      '<div><p class="eyebrow">MON ESPACE</p><h3>'+(p?.displayName?esc(p.displayName)+" · ":"")+
      esc(p?.collectionName||"Ma collection")+'</h3><p>Dernière sauvegarde : <strong>'+esc(date)+'</strong></p></div>'+
      '<div class="v10-backup-actions"><button type="button" class="btn secondary" data-v10-profile>Profil</button><button type="button" class="btn primary" data-v10-backup>💾 Sauvegarder</button></div>';
    if(card.innerHTML!==markup) card.innerHTML=markup;
  }

  function refreshProfileUI(){
    const p=readProfile();
    const btn=document.querySelector("#profileBtn");
    if(btn && p?.displayName)btn.title="Profil de "+p.displayName;
    ensureDashboardBackup();
  }

  function bindBackupTracking(){
    const exportBtn=document.querySelector("#exportJsonBtn");
    if(exportBtn && !exportBtn.dataset.v10Bound){
      exportBtn.dataset.v10Bound="1";
      exportBtn.addEventListener("click",()=>{
        localStorage.setItem(LAST_BACKUP_KEY,String(Date.now()));
        setTimeout(()=>{refreshProfileUI();const d=document.querySelector("#profileDialog");if(d?.open)d.querySelector("#profileBackupDate").textContent=fmtDate(localStorage.getItem(LAST_BACKUP_KEY));},50);
      });
    }
  }

  function maybeWelcome(){
    if(readProfile())return;
    if(Array.isArray(collection) && collection.length>0)return;
    setTimeout(()=>ensureWelcomeDialog().showModal(),350);
  }

  const css=document.createElement("style");
  css.textContent=`
    .welcome-dialog{max-width:680px}.welcome-brand{display:flex;align-items:center;gap:15px}.welcome-brand img{width:76px;height:76px;border-radius:20px}.welcome-brand h2{margin:0;font-size:2rem}.welcome-intro{font-size:1.05rem;line-height:1.5}.welcome-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.welcome-grid label,.profile-dialog>label{display:grid;gap:6px;font-weight:800;font-size:.84rem}.welcome-grid input,.profile-dialog input{font:inherit;border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff}.welcome-mode{display:grid;gap:4px;margin-top:12px;padding:13px;border:1px solid #d7c36f;background:#fff8dd;border-radius:14px}.welcome-mode span{font-size:.8rem;color:var(--muted)}.welcome-mode.disabled{opacity:.58;background:#f3f1ed;border-color:var(--line)}.welcome-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
    .profile-avatar{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:#f4e3ad;color:#2b220b;font-size:1.7rem;font-weight:900;margin:0 auto 14px}.profile-dialog>label{margin-top:10px}.profile-storage{display:grid;gap:3px;margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#faf9f6}.profile-storage span{font-size:.78rem;color:var(--muted)}.profile-backup-status{display:flex;justify-content:space-between;gap:10px;margin:14px 0;padding:10px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:.82rem}.profile-action-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .about-dialog{max-width:720px}.about-sections{display:grid;gap:10px}.about-sections section{padding:14px;background:#fff;border:1px solid var(--line);border-radius:15px}.about-sections h3{margin:0 0 6px}.about-sections p{margin:5px 0;line-height:1.5;color:#514d45}.discogs-credit{font-size:.82rem}.about-version{text-align:right;color:var(--muted);font-size:.75rem}
    .v10-backup-card{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(135deg,#fff,#fff8df)}.v10-backup-card h3{margin:0;font-size:1.12rem}.v10-backup-card p:last-child{margin:5px 0 0;color:var(--muted);font-size:.78rem}.v10-backup-actions{display:flex;gap:8px;flex:0 0 auto}
    @media(max-width:600px){.welcome-grid{grid-template-columns:1fr}.welcome-actions{display:grid}.v10-backup-card{align-items:flex-start;flex-direction:column}.v10-backup-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}.profile-action-grid{grid-template-columns:1fr}.header-actions{gap:4px}}
  `;
  document.head.appendChild(css);

  window.addEventListener("vinyl:profile-restored",()=>{refreshProfileUI();toast("Profil local restauré");});

  ensureHeaderButtons();
  ensureProfileDialog();
  ensureAboutDialog();
  bindBackupTracking();
  refreshProfileUI();
  maybeWelcome();

  let timer;
  new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{ensureHeaderButtons();ensureDashboardBackup();bindBackupTracking();},80);
  }).observe(document.body,{childList:true,subtree:true});
})();