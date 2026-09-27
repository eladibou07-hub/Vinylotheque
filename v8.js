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

  async function identifyCover(file,dialog){
    const status=dialog.querySelector("#coverScanStatus");
    const queryBox=dialog.querySelector("#coverScanQuery");
    const searchBtn=dialog.querySelector("#coverScanSearch");
    searchBtn.disabled=true;
    queryBox.value="";
    status.textContent="Chargement de la reconnaissance…";
    let worker=null;
    let timer=null;
    try{
      if(!window.Tesseract?.createWorker)throw new Error("Module OCR indisponible");
      const timeout=new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(new Error("OCR trop long à démarrer")),30000);
      });
      const job=(async()=>{
        worker=await Tesseract.createWorker("eng",1,{
          logger:m=>{
            if(m.status==="loading tesseract core") status.textContent="Chargement du moteur OCR…";
            else if(m.status==="initializing tesseract") status.textContent="Initialisation de la reconnaissance…";
            else if(m.status==="loading language traineddata") status.textContent="Chargement du dictionnaire…";
            else if(m.status==="recognizing text" && Number.isFinite(m.progress)){
              status.textContent="Lecture de la pochette… "+Math.round(m.progress*100)+" %";
            }
          }
        });
        await worker.setParameters({tessedit_pageseg_mode:Tesseract.PSM?.SPARSE_TEXT || "11"});
        return await worker.recognize(file,{rotateAuto:true});
      })();
      const result=await Promise.race([job,timeout]);
      clearTimeout(timer);
      const raw=result?.data?.text||"";
      const query=cleanCoverQuery(raw);
      if(query.length<3){
        status.textContent="Je n’ai pas reconnu assez de texte. Essaie une photo plus droite, sans reflet, ou saisis l’artiste / le titre ci-dessous.";
        queryBox.value=raw.replace(/\s+/g," ").trim().slice(0,180);
        searchBtn.disabled=!queryBox.value.trim();
        return;
      }
      queryBox.value=query;
      searchBtn.disabled=false;
      status.textContent="Texte reconnu : "+query;
    }catch(err){
      clearTimeout(timer);
      console.error("Cover OCR",err);
      status.textContent="La lecture automatique n’a pas abouti. Saisis quelques mots (artiste + titre) puis appuie sur Rechercher.";
      searchBtn.disabled=!queryBox.value.trim();
    }finally{
      try{await worker?.terminate();}catch{}
    }
  }

  function ensureCoverScan(){
    let dialog=document.querySelector("#coverScanDialog");
    if(dialog)return dialog;

    let cameraStream=null;
    let analyzing=false;

    const stopCamera=()=>{
      cameraStream?.getTracks?.().forEach(t=>t.stop());
      cameraStream=null;
      const video=dialog?.querySelector("#coverLiveVideo");
      if(video)video.srcObject=null;
    };

    const showPreviewBlob=blob=>{
      const preview=dialog.querySelector("#coverScanPreview");
      const img=preview.querySelector("img");
      const old=img.dataset.objectUrl;
      if(old)URL.revokeObjectURL(old);
      const url=URL.createObjectURL(blob);
      img.src=url;
      img.dataset.objectUrl=url;
      preview.hidden=false;
    };

    const analyzeBlob=async blob=>{
      if(!blob||analyzing)return;
      analyzing=true;
      const captureBtn=dialog.querySelector("#coverCaptureBtn");
      const startBtn=dialog.querySelector("#coverCameraStart");
      if(captureBtn)captureBtn.disabled=true;
      if(startBtn)startBtn.disabled=true;
      showPreviewBlob(blob);
      stopCamera();
      try{
        await identifyCover(blob,dialog);
      }finally{
        analyzing=false;
        if(captureBtn)captureBtn.disabled=false;
        if(startBtn)startBtn.disabled=false;
      }
    };

    const startCamera=async()=>{
      const status=dialog.querySelector("#coverScanStatus");
      const video=dialog.querySelector("#coverLiveVideo");
      const stage=dialog.querySelector("#coverCameraStage");
      const captureBtn=dialog.querySelector("#coverCaptureBtn");
      stopCamera();
      status.textContent="Ouverture de la caméra…";
      try{
        if(!navigator.mediaDevices?.getUserMedia)throw new Error("Caméra navigateur indisponible");
        cameraStream=await navigator.mediaDevices.getUserMedia({
          video:{
            facingMode:{ideal:"environment"},
            width:{ideal:1920},
            height:{ideal:1080}
          },
          audio:false
        });
        video.srcObject=cameraStream;
        await video.play();
        stage.hidden=false;
        captureBtn.hidden=false;
        status.textContent="Cadre la pochette bien de face, puis appuie sur Capturer.";
      }catch(err){
        console.error("Cover camera",err);
        stopCamera();
        stage.hidden=true;
        captureBtn.hidden=true;
        status.textContent="La caméra intégrée n’est pas disponible. Utilise « Choisir une photo » ci-dessous.";
      }
    };

    const captureFrame=async()=>{
      const video=dialog.querySelector("#coverLiveVideo");
      const status=dialog.querySelector("#coverScanStatus");
      if(!cameraStream||!video.videoWidth||!video.videoHeight){
        status.textContent="La caméra n’est pas encore prête.";
        return;
      }
      status.textContent="Capture de la pochette…";
      const canvas=document.createElement("canvas");
      const max=1800;
      const scale=Math.min(1,max/Math.max(video.videoWidth,video.videoHeight));
      canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
      canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
      const ctx=canvas.getContext("2d");
      ctx.drawImage(video,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",0.9));
      if(!blob){
        status.textContent="Impossible de capturer l’image. Essaie avec « Choisir une photo ».";
        return;
      }
      await analyzeBlob(blob);
    };

    dialog=document.createElement("dialog");
    dialog.id="coverScanDialog";
    dialog.className="modal small cover-scan-dialog";
    dialog.innerHTML=
      '<div class="modal-head"><div><p class="eyebrow">PHOTO</p><h2>Identifier une pochette</h2></div><button type="button" class="icon-btn" data-cover-close>✕</button></div>'+
      '<p>La caméra s’ouvre directement dans Vinylothèque : tu ne quittes plus l’application.</p>'+
      '<button type="button" class="btn primary cover-camera-start" id="coverCameraStart">📷 Ouvrir la caméra</button>'+
      '<div id="coverCameraStage" class="cover-camera-stage" hidden><video id="coverLiveVideo" autoplay playsinline muted></video><div class="cover-camera-guide"></div></div>'+
      '<button type="button" class="btn primary cover-capture-btn" id="coverCaptureBtn" hidden>● Capturer la pochette</button>'+
      '<div class="cover-photo-fallback"><span>ou</span><button type="button" class="btn secondary" id="coverChoosePhoto">🖼 Choisir une photo</button></div>'+
      '<input id="coverScanInput" type="file" accept="image/*" hidden>'+
      '<div id="coverScanPreview" class="cover-scan-preview" hidden><img alt="Pochette capturée"></div>'+
      '<p id="coverScanStatus" class="hint">Ouvre la caméra puis cadre la pochette.</p>'+
      '<label class="cover-query-label">Texte reconnu / recherche<input id="coverScanQuery" type="text" placeholder="Artiste et titre"></label>'+
      '<button type="button" class="btn secondary cover-search-btn" id="coverScanSearch" disabled>Rechercher avec ce texte</button>'+
      '<p class="hint cover-privacy">La photo reste sur ton appareil pour la reconnaissance du texte.</p>';
    document.body.appendChild(dialog);

    const input=dialog.querySelector("#coverScanInput");
    const queryBox=dialog.querySelector("#coverScanQuery");

    dialog.querySelector("[data-cover-close]").addEventListener("click",()=>{
      stopCamera();
      dialog.close();
    });
    dialog.addEventListener("close",stopCamera);
    dialog.querySelector("#coverCameraStart").addEventListener("click",startCamera);
    dialog.querySelector("#coverCaptureBtn").addEventListener("click",captureFrame);
    dialog.querySelector("#coverChoosePhoto").addEventListener("click",()=>input.click());
    dialog.querySelector("#coverScanSearch").addEventListener("click",()=>{
      const q=queryBox.value.trim();if(!q)return;
      stopCamera();dialog.close();searchDiscogs(q);
    });
    queryBox.addEventListener("input",()=>{
      dialog.querySelector("#coverScanSearch").disabled=!queryBox.value.trim();
    });
    queryBox.addEventListener("keydown",e=>{
      if(e.key==="Enter" && queryBox.value.trim()){
        e.preventDefault();stopCamera();dialog.close();searchDiscogs(queryBox.value.trim());
      }
    });
    input.addEventListener("change",async e=>{
      const file=e.target.files?.[0];
      input.value="";
      if(!file)return;
      await analyzeBlob(file);
    });

    dialog.openCoverCamera=()=>{
      dialog.querySelector("#coverScanStatus").textContent="Ouverture de la caméra…";
      startCamera();
    };
    return dialog;
  }

  function addCoverScanButton(){
    const dialog=document.querySelector("#discogsDialog");
    if(!dialog || dialog.querySelector("[data-v8-cover-scan]"))return;
    const btn=document.createElement("button");
    btn.type="button";btn.className="btn secondary";btn.dataset.v8CoverScan="1";btn.textContent="📷 Identifier une pochette";
    const hint=dialog.querySelector("#discogsHint");
    hint?.insertAdjacentElement("afterend",btn);
    btn.addEventListener("click",()=>{const d=ensureCoverScan();d.showModal();setTimeout(()=>d.openCoverCamera?.(),80);});
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
    .cover-camera-start{width:100%}.cover-camera-stage{position:relative;margin-top:12px;border-radius:16px;overflow:hidden;background:#111;aspect-ratio:3/4}.cover-camera-stage video{width:100%;height:100%;object-fit:cover;display:block}.cover-camera-guide{position:absolute;inset:8%;border:2px solid rgba(255,255,255,.8);border-radius:10px;box-shadow:0 0 0 999px rgba(0,0,0,.15);pointer-events:none}.cover-capture-btn{width:100%;margin-top:10px}.cover-photo-fallback{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:10px}.cover-photo-fallback span{font-size:.72rem;color:var(--muted);text-transform:uppercase}.cover-scan-preview{margin-top:14px}.cover-scan-preview img{display:block;width:min(100%,320px);aspect-ratio:1;object-fit:cover;border-radius:16px;margin-bottom:8px}.cover-scan-preview p{color:var(--muted);font-size:.82rem}.cover-query-label{display:grid;gap:6px;margin-top:12px;font-size:.8rem;font-weight:800}.cover-query-label input{font:inherit;border:1px solid var(--line);border-radius:12px;padding:11px 12px;background:#fff}.cover-search-btn{width:100%;margin-top:9px}.cover-privacy{margin-top:10px;font-size:.72rem!important}
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