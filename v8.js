(() => {
  const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const getRecord=id=>collection.find(r=>r.id===id);
  const cover=r=>(typeof coverOf==="function"?coverOf(r):(r.personalPhoto||r.coverUrl||""));

  function addVoiceSearch(){
    const search=document.querySelector(".search");
    if(!search || search.querySelector("#voiceSearchBtn")) return;
    const btn=document.createElement("button");
    btn.type="button";
    btn.id="voiceSearchBtn";
    btn.className="voice-search-btn";
    btn.setAttribute("aria-label","Recherche vocale");
    btn.title="Recherche vocale";
    btn.textContent="🎙️";
    search.appendChild(btn);

    btn.addEventListener("click",()=>{
      const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!SR){toast("Recherche vocale non disponible dans ce navigateur");return;}
      const rec=new SR();
      rec.lang="fr-FR";
      rec.interimResults=false;
      rec.maxAlternatives=1;
      btn.classList.add("listening");
      btn.textContent="●";
      rec.onresult=e=>applyVoiceQuery(e.results?.[0]?.[0]?.transcript||"");
      rec.onerror=()=>toast("Je n’ai pas compris. Réessaie.");
      rec.onend=()=>{btn.classList.remove("listening");btn.textContent="🎙️";};
      try{rec.start();}catch{toast("Le micro est déjà actif");}
    });
  }

  function applyVoiceQuery(text){
    const raw=String(text||"").trim();
    if(!raw)return;
    let work=norm(raw);
    let decadeValue="";
    const dm=work.match(/annees?\s+(\d{2}|\d{4})/);
    if(dm){
      let n=Number(dm[1]);
      if(n<100)n=n>=30?1900+n:2000+n;
      decadeValue=Math.floor(n/10)*10+"s";
      work=work.replace(dm[0]," ").trim();
    }

    const genreSelect=document.querySelector("#filterGenre");
    let genre="";
    if(genreSelect){
      [...genreSelect.options].slice(1).forEach(o=>{
        if(!genre && norm(work).includes(norm(o.value))){
          genre=o.value;
          work=work.replace(norm(o.value)," ").replace(/\s+/g," ").trim();
        }
      });
      if(genre){
        genreSelect.value=genre;
        genreSelect.dispatchEvent(new Event("change",{bubbles:true}));
      }
    }

    if(decadeValue){
      const advanced=document.querySelector("#advancedPanel");
      if(advanced) advanced.hidden=false;
      const dec=document.querySelector("#filterDecade");
      if(dec && [...dec.options].some(o=>o.value===decadeValue)){
        dec.value=decadeValue;
        dec.dispatchEvent(new Event("change",{bubbles:true}));
      }
    }

    const input=document.querySelector("#filterText");
    if(input){
      input.value=work;
      input.dispatchEvent(new Event("input",{bubbles:true}));
    }
    document.querySelector('[data-nav="collection"]')?.click();
    toast("Recherche vocale : "+raw);
  }

  function addPersonalBadges(){
    document.querySelectorAll("#collection .record-card").forEach(card=>{
      const id=card.querySelector("[data-edit]")?.dataset.edit;
      const r=getRecord(id);
      if(!r)return;
      const stars=r.personalRating ? "★".repeat(Number(r.personalRating))+"☆".repeat(5-Number(r.personalRating)) : "";
      const html=(stars?'<span class="personal-stars">'+stars+'</span>':'')+
        (r.personalStatus?'<span class="personal-status">'+esc(r.personalStatus)+'</span>':'');
      let box=card.querySelector(".personal-card-rating");
      if(!r.personalRating && !r.personalStatus){ box?.remove(); return; }
      if(!box){
        box=document.createElement("div");
        box.className="personal-card-rating";
        card.querySelector(".card-actions")?.before(box);
      }
      if(box.innerHTML!==html)box.innerHTML=html;
    });
  }

  function ensureWall(){
    let wall=document.querySelector("#coverWallView");
    if(wall)return wall;
    wall=document.createElement("section");
    wall.id="coverWallView";
    wall.className="cover-wall-view";
    wall.hidden=true;
    wall.innerHTML=
      '<div class="cover-wall-top"><button type="button" class="album-back" id="wallBack">← Retour</button>'+
      '<div><p class="eyebrow">GALERIE</p><h2>Mur de pochettes</h2></div>'+
      '<div class="wall-size"><button data-wall-cols="3">3</button><button data-wall-cols="4" class="active">4</button><button data-wall-cols="5">5</button></div></div>'+
      '<div id="coverWallGrid" class="cover-wall-grid cols-4"></div>';
    document.body.appendChild(wall);
    wall.querySelector("#wallBack").addEventListener("click",closeWall);
    wall.querySelectorAll("[data-wall-cols]").forEach(btn=>btn.addEventListener("click",()=>{
      wall.querySelectorAll("[data-wall-cols]").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const grid=wall.querySelector("#coverWallGrid");
      grid.className="cover-wall-grid cols-"+btn.dataset.wallCols;
    }));
    wall.querySelector("#coverWallGrid").addEventListener("click",e=>{
      const item=e.target.closest("[data-wall-id]");
      if(!item)return;
      closeWall();
      window.dispatchEvent(new CustomEvent("vinyl:open-album",{detail:{id:item.dataset.wallId}}));
    });
    return wall;
  }

  function openWall(){
    const wall=ensureWall();
    const rows=[...collection].sort((a,b)=>String(a.artist||"").localeCompare(String(b.artist||""),"fr")||String(a.title||"").localeCompare(String(b.title||""),"fr"));
    wall.querySelector("#coverWallGrid").innerHTML=rows.map(r=>{
      const src=cover(r);
      return '<button type="button" class="wall-cover" data-wall-id="'+esc(r.id)+'" title="'+esc((r.artist||"")+" — "+(r.title||""))+'">'+
        (src?'<img src="'+esc(src)+'" alt="'+esc(r.title||"")+'" loading="lazy">':'<div class="wall-empty">♪</div>')+
        (r.personalRating?'<span class="wall-rating">'+esc(r.personalRating)+'★</span>':'')+
      '</button>';
    }).join("");
    wall.hidden=false;
    document.body.classList.add("wall-open");
    wall.scrollTo({top:0});
  }
  function closeWall(){
    const wall=ensureWall();
    wall.hidden=true;
    document.body.classList.remove("wall-open");
  }

  function addWallButtons(){
    const dashActions=document.querySelector(".dash-actions");
    if(dashActions && !dashActions.querySelector("[data-v8-wall]")){
      const b=document.createElement("button");
      b.type="button";b.dataset.v8Wall="1";
      b.innerHTML='<span>▦</span><strong>Mur</strong><small>toutes les pochettes</small>';
      b.addEventListener("click",openWall);
      dashActions.appendChild(b);
    }
    const header=document.querySelector("#collectionHeader");
    if(header && !header.querySelector("[data-v8-wall]")){
      const b=document.createElement("button");
      b.type="button";b.className="btn secondary";b.dataset.v8Wall="1";b.textContent="▦ Mur";
      b.addEventListener("click",openWall);
      header.appendChild(b);
    }
  }

  function cleanCoverQuery(text){
    const junk=/^(records?|stereo|mono|side|face|lp|vinyl|compact|disc|digital|remaster(ed)?|copyright|all rights reserved)$/i;
    const lines=String(text||"").split(/\n+/).map(s=>s
      .replace(/[|_~^<>={}\[\]\\]/g," ")
      .replace(/[^\p{L}\p{N}&'’+\- .]/gu," ")
      .replace(/\s+/g," ")
      .trim()
    ).filter(Boolean);
    const scored=lines.map((line,index)=>{
      const letters=(line.match(/\p{L}/gu)||[]).length;
      const words=line.split(/\s+/).filter(Boolean);
      const alphaRatio=letters/Math.max(1,line.length);
      let score=letters*2 + Math.min(words.length,6)*5 - index;
      if(alphaRatio<0.45)score-=20;
      if(words.length>10)score-=12;
      if(junk.test(line))score-=30;
      return {line,score};
    }).filter(x=>x.line.length>=2 && x.score>5)
      .sort((a,b)=>b.score-a.score);
    const picked=[];
    for(const x of scored){
      const key=x.line.toLowerCase();
      if(picked.some(y=>y.toLowerCase()===key))continue;
      picked.push(x.line);
      if(picked.length>=3)break;
    }
    return picked.join(" ").slice(0,180);
  }

  async function prepareCoverForOcr(file){
    const bitmap=await createImageBitmap(file);
    const max=1600;
    const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
    const w=Math.max(1,Math.round(bitmap.width*scale));
    const h=Math.max(1,Math.round(bitmap.height*scale));
    const canvas=document.createElement("canvas");
    canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(bitmap,0,0,w,h);
    bitmap.close?.();
    const image=ctx.getImageData(0,0,w,h);
    const p=image.data;
    for(let i=0;i<p.length;i+=4){
      const gray=.299*p[i]+.587*p[i+1]+.114*p[i+2];
      const boosted=Math.max(0,Math.min(255,(gray-128)*1.35+128));
      p[i]=p[i+1]=p[i+2]=boosted;
    }
    ctx.putImageData(image,0,0);
    return canvas;
  }

  async function identifyCover(file,dialog){
    const status=dialog.querySelector("#coverScanStatus");
    const queryBox=dialog.querySelector("#coverScanQuery");
    const searchBtn=dialog.querySelector("#coverScanSearch");
    searchBtn.disabled=true;
    queryBox.value="";
    status.textContent="Préparation de l’image…";
    try{
      if(!window.Tesseract)throw new Error("Le module de reconnaissance n’a pas pu être chargé.");
      const canvas=await prepareCoverForOcr(file);
      status.textContent="Lecture du texte de la pochette…";
      const worker=await Tesseract.createWorker("eng+fra",1,{
        logger:m=>{
          if(m.status==="recognizing text" && Number.isFinite(m.progress)){
            status.textContent="Lecture de la pochette… "+Math.round(m.progress*100)+" %";
          }
        }
      });
      await worker.setParameters({
        tessedit_pageseg_mode:"11",
        preserve_interword_spaces:"1"
      });
      const result=await worker.recognize(canvas);
      await worker.terminate();
      const raw=result?.data?.text||"";
      const query=cleanCoverQuery(raw);
      if(query.length<3){
        status.textContent="Je n’ai pas reconnu assez de texte. Essaie une photo plus droite, sans reflet, ou saisis quelques mots ci-dessous.";
        queryBox.value=raw.replace(/\s+/g," ").trim().slice(0,180);
        searchBtn.disabled=!queryBox.value.trim();
        return;
      }
      queryBox.value=query;
      searchBtn.disabled=false;
      status.textContent="Texte reconnu : recherche Discogs en cours…";
      setTimeout(()=>{
        if(!dialog.open)return;
        dialog.close();
        searchDiscogs(query);
      },450);
    }catch(err){
      console.error("Cover OCR",err);
      status.textContent="Identification impossible. Tu peux saisir l’artiste ou le titre manuellement.";
      searchBtn.disabled=!queryBox.value.trim();
    }
  }

  function ensureCoverScan(){
    let dialog=document.querySelector("#coverScanDialog");
    if(dialog)return dialog;
    dialog=document.createElement("dialog");
    dialog.id="coverScanDialog";
    dialog.className="modal small cover-scan-dialog";
    dialog.innerHTML=
      '<div class="modal-head"><div><p class="eyebrow">PHOTO</p><h2>Identifier une pochette</h2></div><button type="button" class="icon-btn" data-cover-close>✕</button></div>'+
      '<p>Photographie la pochette bien de face. Vinylothèque lit le texte directement sur ton appareil puis cherche l’édition dans Discogs.</p>'+
      '<input id="coverScanInput" type="file" accept="image/*" capture="environment" hidden>'+
      '<button type="button" class="btn primary" id="coverScanTake">📷 Prendre une photo</button>'+
      '<div id="coverScanPreview" class="cover-scan-preview" hidden><img alt="Pochette photographiée"></div>'+
      '<p id="coverScanStatus" class="hint">Aucune image sélectionnée.</p>'+
      '<label class="cover-query-label">Texte reconnu / recherche<input id="coverScanQuery" type="text" placeholder="Artiste et titre"></label>'+
      '<button type="button" class="btn secondary cover-search-btn" id="coverScanSearch" disabled>Rechercher avec ce texte</button>'+
      '<p class="hint cover-privacy">La photo n’est pas envoyée à un service de reconnaissance : l’analyse se fait dans le navigateur.</p>';
    document.body.appendChild(dialog);
    const input=dialog.querySelector("#coverScanInput");
    const preview=dialog.querySelector("#coverScanPreview");
    const queryBox=dialog.querySelector("#coverScanQuery");
    dialog.querySelector("[data-cover-close]").addEventListener("click",()=>dialog.close());
    dialog.querySelector("#coverScanTake").addEventListener("click",()=>input.click());
    dialog.querySelector("#coverScanSearch").addEventListener("click",()=>{
      const q=queryBox.value.trim();if(!q)return;
      dialog.close();searchDiscogs(q);
    });
    queryBox.addEventListener("input",()=>{dialog.querySelector("#coverScanSearch").disabled=!queryBox.value.trim();});
    queryBox.addEventListener("keydown",e=>{
      if(e.key==="Enter" && queryBox.value.trim()){
        e.preventDefault();dialog.close();searchDiscogs(queryBox.value.trim());
      }
    });
    input.addEventListener("change",async e=>{
      const file=e.target.files?.[0];if(!file)return;
      const old=preview.querySelector("img").dataset.objectUrl;
      if(old)URL.revokeObjectURL(old);
      const url=URL.createObjectURL(file);
      const img=preview.querySelector("img");
      img.src=url;img.dataset.objectUrl=url;preview.hidden=false;
      await identifyCover(file,dialog);
      input.value="";
    });
    return dialog;
  }

  function addCoverScanButton(){
    const dialog=document.querySelector("#discogsDialog");
    if(!dialog || dialog.querySelector("[data-v8-cover-scan]"))return;
    const btn=document.createElement("button");
    btn.type="button";btn.className="btn secondary";btn.dataset.v8CoverScan="1";btn.textContent="📷 Identifier une pochette";
    const hint=dialog.querySelector("#discogsHint");
    hint?.insertAdjacentElement("afterend",btn);
    btn.addEventListener("click",()=>ensureCoverScan().showModal());
  }

  function styleFormSelects(){
    document.querySelectorAll("#recordForm select").forEach(el=>el.classList.add("v8-form-select"));
  }

  const css=document.createElement("style");
  css.textContent=`
    .v8-form-select{width:100%;font:inherit;background:#fff;color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:12px 13px;margin-top:6px}
    .voice-search-btn{flex:0 0 auto;width:38px;height:38px;border:0;border-radius:50%;background:#f4e3ad;cursor:pointer;font-size:1rem}.voice-search-btn.listening{background:#b23434;color:#fff;animation:v8pulse 1s infinite}@keyframes v8pulse{50%{transform:scale(.9);opacity:.75}}
    .personal-card-rating{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:9px}.personal-stars{color:#9a7a23;font-weight:900;letter-spacing:.02em}.personal-status{font-size:.68rem;font-weight:800;background:#fff7dc;border:1px solid #ead27d;border-radius:999px;padding:4px 7px}
    body.wall-open{overflow:hidden}.cover-wall-view{position:fixed;inset:0;z-index:125;background:#151515;color:#fff;overflow:auto;padding-bottom:30px}.cover-wall-top{position:sticky;top:0;z-index:3;display:grid;grid-template-columns:auto 1fr auto;gap:15px;align-items:center;padding:12px clamp(12px,4vw,36px);background:rgba(21,21,21,.94);backdrop-filter:blur(14px);border-bottom:1px solid #333}.cover-wall-top h2{margin:0;font-size:1.35rem}.cover-wall-top .eyebrow{color:#a9a39b}.cover-wall-top .album-back{color:#fff}.wall-size{display:flex;gap:4px}.wall-size button{width:34px;height:34px;border:1px solid #555;background:#292929;color:#ddd;border-radius:9px;cursor:pointer}.wall-size button.active{background:#f4e3ad;color:#18130a;border-color:#f4e3ad}
    .cover-wall-grid{--cols:6;display:grid;grid-template-columns:repeat(var(--cols),1fr);gap:4px;padding:4px}.cover-wall-grid.cols-3{--cols:5}.cover-wall-grid.cols-4{--cols:7}.cover-wall-grid.cols-5{--cols:9}.wall-cover{position:relative;aspect-ratio:1;border:0;padding:0;background:#292929;cursor:pointer;overflow:hidden}.wall-cover img,.wall-empty{width:100%;height:100%;object-fit:cover;display:grid;place-items:center;font-size:2rem}.wall-cover:active{transform:scale(.97)}.wall-rating{position:absolute;right:4px;bottom:4px;background:rgba(0,0,0,.75);color:#f4d570;border-radius:999px;padding:3px 5px;font-size:.62rem;font-weight:900}
    .cover-scan-preview{margin-top:14px}.cover-scan-preview img{display:block;width:min(100%,320px);aspect-ratio:1;object-fit:cover;border-radius:16px;margin-bottom:8px}.cover-scan-preview p{color:var(--muted);font-size:.82rem}.cover-query-label{display:grid;gap:6px;margin-top:12px;font-size:.8rem;font-weight:800}.cover-query-label input{font:inherit;border:1px solid var(--line);border-radius:12px;padding:11px 12px;background:#fff}.cover-search-btn{width:100%;margin-top:9px}.cover-privacy{margin-top:10px;font-size:.72rem!important}
    .dash-actions{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))!important}
    @media(max-width:700px){.cover-wall-grid.cols-3{--cols:3}.cover-wall-grid.cols-4{--cols:4}.cover-wall-grid.cols-5{--cols:5}.cover-wall-top{grid-template-columns:auto 1fr}.wall-size{grid-column:1/-1;justify-content:center}.dash-actions{grid-template-columns:1fr!important}}
  `;
  document.head.appendChild(css);

  addVoiceSearch();
  ensureWall();
  ensureCoverScan();
  addCoverScanButton();
  addWallButtons();
  styleFormSelects();
  addPersonalBadges();

  let timer;
  new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{
      addVoiceSearch();addWallButtons();addCoverScanButton();styleFormSelects();addPersonalBadges();
    },60);
  }).observe(document.body,{childList:true,subtree:true});
})();