const STORAGE_KEY = "vinylotheque.collection.v4";
const TOKEN_KEY = "vinylotheque.discogs.token";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let collection = loadCollection();
let pendingPhoto = null;
let deferredInstallPrompt = null;
let scannerStream = null;
let scannerLoop = null;
let discogsSearchState = { query:"", isBarcode:false, page:1, pages:1, total:0, loading:false };

function uid(){ return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function esc(v=""){ return String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove("show"),2600); }
function loadCollection(){ try { const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); return Array.isArray(v)?v:[]; } catch { return []; } }
function saveCollection(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(collection)); render(); }
function normalize(s){ return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(); }
function coverOf(r){ return r.personalPhoto || r.coverUrl || ""; }

function render(){
  const q = normalize($("#filterText").value);
  const currentGenre = $("#filterGenre").value;
  const sort = $("#sortBy").value;

  const splitTax = v => String(v||"").split(/[,;]+/).map(s=>s.trim()).filter(Boolean);
  const genres = [...new Map(collection.flatMap(r=>splitTax(r.genre)).map(v=>[normalize(v),v])).values()].sort((a,b)=>a.localeCompare(b,"fr"));
  $("#filterGenre").innerHTML = `<option value="">Tous les genres</option>` + genres.map(g=>`<option ${g===currentGenre?"selected":""}>${esc(g)}</option>`).join("");

  let rows = collection.filter(r=>{
    const hay = normalize([r.artist,r.title,r.label,r.catno,r.barcode,r.country,r.genre,r.style,r.year,r.format,r.location,r.personalStatus,r.contextNote].join(" "));
    const genreOk = !currentGenre || splitTax(r.genre).some(g=>normalize(g)===normalize(currentGenre));
    return (!q || hay.includes(q)) && genreOk;
  });

  rows.sort((a,b)=>{
    if(sort==="artist-asc") return String(a.artist||"").localeCompare(String(b.artist||""),"fr");
    if(sort==="title-asc") return String(a.title||"").localeCompare(String(b.title||""),"fr");
    if(sort==="genre-asc") return String(a.genre||"").localeCompare(String(b.genre||""),"fr");
    if(sort==="style-asc") return String(a.style||"").localeCompare(String(b.style||""),"fr");
    if(sort==="rating-desc") return Number(b.personalRating||0)-Number(a.personalRating||0) || String(a.artist||"").localeCompare(String(b.artist||""),"fr");
    if(sort==="year-desc") return Number(b.year||0)-Number(a.year||0);
    if(sort==="year-asc") return Number(a.year||9999)-Number(b.year||9999);
    return Number(b.addedAt||0)-Number(a.addedAt||0);
  });

  $("#collection").innerHTML = rows.map(r=>{
    const cover = coverOf(r);
    const meta = [r.year, r.format, r.country].filter(Boolean).join(" · ");
    const label = [r.label,r.catno].filter(Boolean).join(" — ");
    return `<article class="record-card">
      <div class="cover">
        ${cover ? `<img src="${esc(cover)}" alt="Pochette de ${esc(r.title)}" loading="lazy">` : `<div class="placeholder"><div class="mini-record"></div></div>`}
        ${r.personalPhoto ? `<span class="badge">photo perso</span>` : r.discogsId ? `<span class="badge">Discogs</span>` : ""}
      </div>
      <div class="record-body">
        <h3>${esc(r.title||"Sans titre")}</h3>
        <div class="artist">${esc(r.artist||"Artiste inconnu")}</div>
        <div class="meta">${esc(meta)}${meta&&label?"<br>":""}${esc(label)}</div>
        <div class="card-actions">
          <button data-edit="${esc(r.id)}">Modifier</button>
          <button class="delete" data-delete="${esc(r.id)}">Supprimer</button>
        </div>
      </div>
    </article>`;
  }).join("");

  $("#emptyState").hidden = collection.length>0 || q || currentGenre;
  $("#collection").hidden = rows.length===0;
  updateStats();
}

function updateStats(){
  $("#statTotal").textContent = collection.length;
  $("#statArtists").textContent = new Set(collection.map(r=>normalize(r.artist)).filter(Boolean)).size;
  $("#statCountries").textContent = new Set(collection.map(r=>normalize(r.country)).filter(Boolean)).size;
  const years = collection.map(r=>Number(r.year)).filter(y=>y>1800&&y<2200).sort((a,b)=>a-b);
  $("#statYears").textContent = years.length ? (years[0]===years.at(-1)?years[0]:`${years[0]}–${years.at(-1)}`) : "—";
}

function openRecord(record=null){
  $("#recordForm").reset();
  pendingPhoto = null;
  $("#photoPreviewWrap").hidden = true;
  $("#recordDialogTitle").textContent = record ? "Modifier le vinyle" : "Ajouter un vinyle";
  const r = record || {};
  for(const key of ["recordId","artist","title","year","format","genre","style","label","country","location","personalRating","personalStatus","catno","barcode","discogsId","coverUrl","contextNote","notes"]){
    const el=$("#"+key);
    if(el) el.value = key==="recordId" ? (r.id||"") : (r[key]||"");
  }
  if(r.personalPhoto){
    pendingPhoto = r.personalPhoto;
    $("#photoPreview").src = r.personalPhoto;
    $("#photoPreviewWrap").hidden = false;
  }
  $("#recordDialog").showModal();
}

function closeRecord(){ $("#recordDialog").close(); }

async function resizeImage(file){
  const data = await new Promise((resolve,reject)=>{ const fr=new FileReader(); fr.onload=()=>resolve(fr.result); fr.onerror=reject; fr.readAsDataURL(file); });
  const img = await new Promise((resolve,reject)=>{ const i=new Image(); i.onload=()=>resolve(i); i.onerror=reject; i.src=data; });
  const max = 900;
  const scale = Math.min(1, max/Math.max(img.width,img.height));
  const c=document.createElement("canvas"); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  return c.toDataURL("image/jpeg",.84);
}

$("#personalPhoto").addEventListener("change", async e=>{
  const f=e.target.files?.[0]; if(!f) return;
  pendingPhoto = await resizeImage(f);
  $("#photoPreview").src = pendingPhoto;
  $("#photoPreviewWrap").hidden = false;
});
$("#removePhotoBtn").addEventListener("click",()=>{ pendingPhoto=null; $("#photoPreviewWrap").hidden=true; $("#personalPhoto").value=""; });

$("#recordForm").addEventListener("submit", e=>{
  e.preventDefault();
  const id=$("#recordId").value || uid();
  const old=collection.find(x=>x.id===id);
  const r={
    id,
    artist:$("#artist").value.trim(),
    title:$("#title").value.trim(),
    year:$("#year").value.trim(),
    format:$("#format").value.trim(),
    genre:$("#genre").value.trim(),
    style:$("#style").value.trim(),
    label:$("#label").value.trim(),
    country:$("#country").value.trim(),
    location:$("#location")?.value.trim() || "",
    personalRating:$("#personalRating")?.value || "",
    personalStatus:$("#personalStatus")?.value || "",
    catno:$("#catno").value.trim(),
    barcode:$("#barcode").value.trim(),
    discogsId:$("#discogsId").value.trim(),
    coverUrl:$("#coverUrl").value.trim(),
    personalPhoto:pendingPhoto,
    contextNote:$("#contextNote")?.value.trim() || "",
    notes:$("#notes").value.trim(),
    richData:old?.richData || null,
    addedAt: old?.addedAt || Date.now(),
    updatedAt: Date.now()
  };
  if(!r.artist||!r.title) return;
  const idx=collection.findIndex(x=>x.id===id);
  if(idx>=0) collection[idx]=r; else collection.push(r);
  saveCollection(); closeRecord(); toast(idx>=0?"Vinyle modifié":"Vinyle ajouté");
});

$("#collection").addEventListener("click", e=>{
  const edit=e.target.closest("[data-edit]"); const del=e.target.closest("[data-delete]");
  if(edit){ const r=collection.find(x=>x.id===edit.dataset.edit); if(r) openRecord(r); }
  if(del){ const r=collection.find(x=>x.id===del.dataset.delete); if(r && confirm(`Supprimer « ${r.artist} — ${r.title} » ?`)){ collection=collection.filter(x=>x.id!==r.id); saveCollection(); toast("Vinyle supprimé"); } }
});

function needToken(){
  const token=localStorage.getItem(TOKEN_KEY)||"";
  if(!token){ $("#discogsToken").value=""; $("#settingsDialog").showModal(); toast("Ajoute d’abord ton jeton Discogs"); return null; }
  return token;
}
function discogsHeaders(token){ return {Authorization:`Discogs token=${token}`,Accept:"application/vnd.discogs.v2.discogs+json"}; }

async function searchDiscogs(query, isBarcode=false, page=1, append=false){
  const token=needToken(); if(!token) return;
  const q=String(query||"").trim(); if(!q) return;
  if(discogsSearchState.loading) return;
  discogsSearchState.loading=true;

  $("#discogsDialog").showModal();
  $("#discogsQuery").value=q;
  if(!append) $("#discogsResults").innerHTML="";
  $("#discogsLoading").hidden=false;
  $("#discogsHint").textContent=isBarcode?`Recherche du code-barres ${q}…`:"Recherche des éditions correspondantes…";
  try{
    const params = new URLSearchParams({type:"release",per_page:"100",page:String(page)});
    if(isBarcode || /^\d{8,14}$/.test(q)) params.set("barcode",q); else params.set("q",q);
    const res=await fetch(`https://api.discogs.com/database/search?${params}`,{headers:discogsHeaders(token)});
    if(!res.ok) throw new Error(`Discogs HTTP ${res.status}`);
    const data=await res.json();
    const pagination=data.pagination||{};
    discogsSearchState={
      query:q,
      isBarcode,
      page:Number(pagination.page||page),
      pages:Number(pagination.pages||1),
      total:Number(pagination.items||0),
      loading:false
    };
    renderDiscogsResults(data.results||[], append);
  }catch(err){
    discogsSearchState.loading=false;
    $("#discogsResults").innerHTML=`<p class="hint">Impossible de joindre Discogs. Vérifie le jeton et la connexion Internet.<br><small>${esc(err.message)}</small></p>`;
  }finally{ $("#discogsLoading").hidden=true; }
}
function renderDiscogsResults(results, append=false){
  const state=discogsSearchState;
  const shownBefore = append ? $("#discogsResults").querySelectorAll(".result").length : 0;
  const shown = shownBefore + results.length;
  $("#discogsHint").textContent = results.length || append
    ? `${shown} résultat(s) affiché(s)${state.total ? ` sur ${state.total}` : ""}. Choisis la bonne édition.`
    : "Aucune édition trouvée.";

  const html=results.map(r=>`
    <article class="result">
      ${r.cover_image ? `<img src="${esc(r.cover_image)}" alt="">` : `<div class="result-cover"></div>`}
      <div>
        <h3>${esc(r.title||"")}</h3>
        <p>${esc([r.year,(r.format||[]).join(", "),r.country].filter(Boolean).join(" · "))}</p>
        <p>${esc([r.label?.[0],r.catno].filter(Boolean).join(" — "))}</p>
      </div>
      <button class="btn secondary" data-discogs-id="${esc(r.id)}">Choisir</button>
    </article>`).join("");

  if(append) $("#discogsResults").insertAdjacentHTML("beforeend",html);
  else $("#discogsResults").innerHTML=html;

  $("#discogsResults").querySelector(".discogs-more")?.remove();
  if(state.page < state.pages){
    const more=document.createElement("button");
    more.type="button";
    more.className="btn secondary discogs-more";
    more.textContent=`Afficher plus (${Math.min(100, Math.max(0,state.total-shown))} suivants)`;
    more.addEventListener("click",()=>{
      more.disabled=true;
      more.textContent="Chargement…";
      searchDiscogs(state.query,state.isBarcode,state.page+1,true);
    });
    $("#discogsResults").appendChild(more);
  }
}
$("#discogsResults").addEventListener("click",async e=>{
  const b=e.target.closest("[data-discogs-id]"); if(!b) return;
  const token=needToken(); if(!token) return;
  b.disabled=true; b.textContent="Chargement…";
  try{
    const res=await fetch(`https://api.discogs.com/releases/${b.dataset.discogsId}`,{headers:discogsHeaders(token)});
    if(!res.ok) throw new Error(`Discogs HTTP ${res.status}`);
    const d=await res.json();
    const fmt=(d.formats||[]).map(f=>[f.name,...(f.descriptions||[])].filter(Boolean).join(" ")).join(" / ");
    const genres=[...(d.genres||[])].filter((v,i,a)=>a.indexOf(v)===i).join(", ");
    const styles=[...(d.styles||[])].filter((v,i,a)=>a.indexOf(v)===i).join(", ");
    const labels=(d.labels||[]).map(x=>x.name).filter(Boolean);
    const catnos=(d.labels||[]).map(x=>x.catno).filter(Boolean);
    const barcode=(d.identifiers||[]).find(x=>normalize(x.type).includes("barcode"))?.value || "";
    const primary=(d.images||[]).find(x=>x.type==="primary") || (d.images||[])[0];
    const draft={
      id:"",
      artist:d.artists_sort || (d.artists||[]).map(a=>a.name).join(", "),
      title:d.title||"",
      year:d.year||"",
      format:fmt,
      genre:genres,
      style:styles,
      label:[...new Set(labels)].join(", "),
      country:d.country||"",
      location:"",
      personalRating:"",
      personalStatus:"",
      catno:[...new Set(catnos)].join(", "),
      barcode,
      discogsId:d.id||"",
      coverUrl:primary?.uri || d.thumb || "",
      contextNote:"",
      notes:""
    };
    $("#discogsDialog").close(); openRecord(draft);
  }catch(err){ toast("Impossible de charger cette édition"); b.disabled=false; b.textContent="Choisir"; }
});

$("#doDiscogsSearch").addEventListener("click",()=>searchDiscogs($("#discogsQuery").value));
$("#discogsQuery").addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); searchDiscogs(e.target.value); } });

async function startScanner(){
  const token=needToken(); if(!token) return;
  $("#scannerDialog").showModal();
  $("#scannerStatus").textContent="Activation de la caméra…";
  if(!("BarcodeDetector" in window)){
    $("#scannerStatus").textContent="Le scan automatique n’est pas disponible dans ce navigateur. Saisis le code-barres ci-dessous.";
    return;
  }
  try{
    const supported=await BarcodeDetector.getSupportedFormats();
    const wanted=["ean_13","ean_8","upc_a","upc_e"].filter(x=>supported.includes(x));
    const detector=new BarcodeDetector({formats:wanted.length?wanted:undefined});
    scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
    $("#scannerVideo").srcObject=scannerStream;
    $("#scannerStatus").textContent="Place le code-barres au centre de l’image.";
    let last=0;
    const scan=async ts=>{
      if(!scannerStream) return;
      if(ts-last>350){
        last=ts;
        try{
          const codes=await detector.detect($("#scannerVideo"));
          if(codes[0]?.rawValue){
            const code=codes[0].rawValue.replace(/\s/g,"");
            stopScanner();
            $("#scannerDialog").close();
            toast(`Code détecté : ${code}`);
            searchDiscogs(code,true);
            return;
          }
        }catch{}
      }
      scannerLoop=requestAnimationFrame(scan);
    };
    scannerLoop=requestAnimationFrame(scan);
  }catch(err){
    $("#scannerStatus").textContent="Impossible d’utiliser la caméra. Autorise son accès ou saisis le code-barres manuellement.";
  }
}
function stopScanner(){
  if(scannerLoop) cancelAnimationFrame(scannerLoop); scannerLoop=null;
  if(scannerStream){ scannerStream.getTracks().forEach(t=>t.stop()); scannerStream=null; }
  $("#scannerVideo").srcObject=null;
}
$("#closeScanner").addEventListener("click",()=>{stopScanner();$("#scannerDialog").close();});
$("#scannerDialog").addEventListener("close",stopScanner);
$("#manualBarcodeBtn").addEventListener("click",()=>{ const v=$("#manualBarcode").value.trim(); if(v){stopScanner();$("#scannerDialog").close();searchDiscogs(v,true);} });

function downloadBlob(blob,name){
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1200);
}
$("#exportJsonBtn").addEventListener("click",()=>{
  const payload={app:"Vinylothèque",version:5,exportedAt:new Date().toISOString(),collection};
  downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),`vinylotheque-sauvegarde-${new Date().toISOString().slice(0,10)}.json`);
});
$("#importJsonBtn").addEventListener("click",()=>$("#importFile").click());
$("#importFile").addEventListener("change",async e=>{
  const f=e.target.files?.[0]; if(!f) return;
  try{
    const data=JSON.parse(await f.text()); const rows=Array.isArray(data)?data:data.collection;
    if(!Array.isArray(rows)) throw new Error("Format invalide");
    if(confirm(`Restaurer ${rows.length} vinyle(s) et remplacer la collection actuelle ?`)){ collection=rows; saveCollection(); toast("Sauvegarde restaurée"); }
  }catch{ alert("Ce fichier n’est pas une sauvegarde Vinylothèque valide."); }
  e.target.value="";
});
$("#exportCsvBtn").addEventListener("click",()=>{
  const cols=["Artiste","Album","Année","Format","Genre","Style","Label","Pays","Emplacement","Note personnelle","Classement personnel","Référence","Code-barres","Discogs ID","Contexte","Notes"];
  const keys=["artist","title","year","format","genre","style","label","country","location","personalRating","personalStatus","catno","barcode","discogsId","contextNote","notes"];
  const cell=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const csv="\ufeff"+[cols.map(cell).join(";"),...collection.map(r=>keys.map(k=>cell(r[k])).join(";"))].join("\r\n");
  downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),`vinylotheque-${new Date().toISOString().slice(0,10)}.csv`);
});

$("#settingsBtn").addEventListener("click",()=>{ $("#discogsToken").value=localStorage.getItem(TOKEN_KEY)||""; $("#settingsDialog").showModal(); });
$("#saveTokenBtn").addEventListener("click",()=>{ const v=$("#discogsToken").value.trim(); if(v) localStorage.setItem(TOKEN_KEY,v); else localStorage.removeItem(TOKEN_KEY); $("#settingsDialog").close(); toast(v?"Jeton Discogs enregistré":"Jeton effacé"); });
$("#clearTokenBtn").addEventListener("click",()=>{ localStorage.removeItem(TOKEN_KEY); $("#discogsToken").value=""; toast("Jeton effacé"); });

$("#addBtn").addEventListener("click",()=>openRecord());
$("#discogsBtn").addEventListener("click",()=>{ if(needToken()) $("#discogsDialog").showModal(); });
$("#emptyDiscogsBtn").addEventListener("click",()=>{ if(needToken()) $("#discogsDialog").showModal(); });
$("#scanBtn").addEventListener("click",startScanner);
$("#filterText").addEventListener("input",render);
$("#filterGenre").addEventListener("change",render);
$("#sortBy").addEventListener("change",render);
$$(".closeDialog").forEach(b=>b.addEventListener("click",closeRecord));
$$(".closeDiscogs").forEach(b=>b.addEventListener("click",()=>$("#discogsDialog").close()));
$$(".closeSettings").forEach(b=>b.addEventListener("click",()=>$("#settingsDialog").close()));

window.addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); deferredInstallPrompt=e; $("#installBtn").hidden=false; });
$("#installBtn").addEventListener("click",async()=>{ if(!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt=null; $("#installBtn").hidden=true; });

if("serviceWorker" in navigator && location.protocol!=="file:") window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));

render();
