(function vinylV7(){
  const norm = v => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const split = v => String(v || "").split(/[,;]+/).map(s=>s.trim()).filter(Boolean);
  const coverOfRecord = r => (typeof coverOf === "function" ? coverOf(r) : (r.personalPhoto || r.coverUrl || ""));
  const storageKey = "vinylotheque.collection.v4";
  const discogsProxyUrl = window.DISCOGS_PROXY_URL || "https://yjudyoihvmfvunvkmbtu.supabase.co/functions/v1/discogs-proxy";
  let currentAlbumId = "";

  function getRecord(id){ return collection.find(r=>r.id===id); }
  function saveRich(){
    localStorage.setItem(storageKey,JSON.stringify(collection));
  }

  function ensureAlbumView(){
    let view=document.querySelector("#albumFullView");
    if(view) return view;
    view=document.createElement("section");
    view.id="albumFullView";
    view.className="album-full-view";
    view.hidden=true;
    view.innerHTML=
      '<div class="album-view-topbar">' +
        '<button type="button" class="album-back" id="albumBack">← Retour</button>' +
        '<div class="album-view-actions">' +
          '<button type="button" class="btn secondary" id="albumRandom">🎲 Autre au hasard</button>' +
          '<button type="button" class="btn primary" id="albumEdit">Modifier</button>' +
        '</div>' +
      '</div>' +
      '<div id="albumFullContent" class="album-full-content"></div>';
    document.body.appendChild(view);
    view.querySelector("#albumBack").addEventListener("click",closeAlbum);
    view.querySelector("#albumEdit").addEventListener("click",()=>{
      const r=getRecord(currentAlbumId);
      if(!r) return;
      closeAlbum();
      openRecord(r);
    });
    view.querySelector("#albumRandom").addEventListener("click",()=>openRandomAlbum());
    return view;
  }

  function closeAlbum(){
    const view=ensureAlbumView();
    view.hidden=true;
    document.body.classList.remove("album-view-open");
    currentAlbumId="";
  }

  function metaItem(label,value){
    if(!value) return "";
    return '<div class="album-meta-item"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';
  }

  function trackMarkup(tracklist){
    if(!Array.isArray(tracklist) || !tracklist.length) return '<p class="album-muted">Tracklist non disponible.</p>';
    return '<div class="track-list">' + tracklist.map(t=>{
      if(t.type_ && t.type_!=="track"){
        return '<div class="track-heading">'+esc(t.title||"")+'</div>';
      }
      return '<div class="track-row">' +
        '<span class="track-pos">'+esc(t.position||"")+'</span>' +
        '<strong>'+esc(t.title||"")+'</strong>' +
        '<span class="track-duration">'+esc(t.duration||"")+'</span>' +
      '</div>';
    }).join("") + '</div>';
  }

  function creditsMarkup(credits){
    if(!Array.isArray(credits) || !credits.length) return '<p class="album-muted">Crédits non disponibles.</p>';
    return '<div class="credit-list">' + credits.map(c=>
      '<div class="credit-row"><strong>'+esc(c.name||"")+'</strong><span>'+esc(c.role||"")+'</span></div>'
    ).join("") + '</div>';
  }

  function listenMarkup(record){
    const query=encodeURIComponent([record.artist,record.title].filter(Boolean).join(" "));
    if(!query) return "";
    const services=[
      ["Spotify","https://open.spotify.com/search/"+query],
      ["Deezer","https://www.deezer.com/search/"+query],
      ["YouTube Music","https://music.youtube.com/search?q="+query],
      ["Qobuz","https://www.qobuz.com/fr-fr/search?q="+query]
    ];
    return '<section class="album-section album-listen">' +
      '<p class="eyebrow">ÉCOUTER</p><h2>Retrouver cet album en ligne</h2>' +
      '<div class="listen-links">' +
      services.map(([name,url]) =>
        '<a class="listen-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer"><strong>'+esc(name)+'</strong><span>Ouvrir ↗</span></a>'
      ).join("") +
      '</div></section>';
  }

  function renderAlbum(record,loadingRich=false){
    const view=ensureAlbumView();
    const content=view.querySelector("#albumFullContent");
    const rich=record.richData || {};
    const image=coverOfRecord(record);
    const chips=[...split(record.genre),...split(record.style)];
    content.innerHTML=
      '<section class="album-hero-full">' +
        '<div class="album-cover-large">' +
          (image ? '<img src="'+esc(image)+'" alt="Pochette de '+esc(record.title||"")+'">' : '<div class="album-cover-placeholder">♪</div>') +
        '</div>' +
        '<div class="album-main-info">' +
          '<p class="eyebrow">FICHE VINYLE</p>' +
          '<h1>'+esc(record.title||"Sans titre")+'</h1>' +
          '<button type="button" class="album-artist-button" data-v7-artist="'+esc(record.artist||"")+'">'+esc(record.artist||"Artiste inconnu")+'</button>' +
          '<p class="album-edition">'+esc([record.year,record.format,record.country].filter(Boolean).join(" · "))+'</p>' +
          (chips.length ? '<div class="album-chips">'+chips.map(v=>'<span>'+esc(v)+'</span>').join("")+'</div>' : '') +
          (record.location ? '<div class="album-location-big">📍 <strong>'+esc(record.location)+'</strong></div>' : '') +
          (record.personalRating ? '<div class="album-personal-rating">' + "★".repeat(Number(record.personalRating)) + "☆".repeat(5-Number(record.personalRating)) + (record.personalStatus ? '<span>'+esc(record.personalStatus)+'</span>' : '') + '</div>' : (record.personalStatus ? '<div class="album-personal-rating"><span>'+esc(record.personalStatus)+'</span></div>' : '')) +
        '</div>' +
      '</section>' +
      listenMarkup(record) +
      '<section class="album-detail-grid">' +
        metaItem("Label",record.label) +
        metaItem("Référence",record.catno) +
        metaItem("Date de sortie",rich.released || record.year) +
        metaItem("Code-barres",record.barcode) +
        metaItem("Discogs ID",record.discogsId) +
        metaItem("Emplacement",record.location) +
      '</section>' +
      (record.contextNote ? '<section class="album-section album-context"><p class="eyebrow">MON HISTOIRE AVEC CE DISQUE</p><p class="album-notes">'+esc(record.contextNote)+'</p></section>' : '') +
      (record.notes ? '<section class="album-section"><p class="eyebrow">MES NOTES</p><p class="album-notes">'+esc(record.notes)+'</p></section>' : '') +
      '<section class="album-section">' +
        '<div class="album-section-title"><div><p class="eyebrow">CONTENU</p><h2>Tracklist</h2></div>' +
        (loadingRich ? '<span class="album-loading">Chargement Discogs…</span>' : '') + '</div>' +
        trackMarkup(rich.tracklist) +
      '</section>' +
      '<section class="album-section"><p class="eyebrow">ÉDITION</p><h2>Crédits</h2>'+creditsMarkup(rich.credits)+'</section>' +
      (rich.companies?.length ? '<section class="album-section"><p class="eyebrow">PRODUCTION</p><h2>Sociétés & studios</h2><div class="credit-list">' +
        rich.companies.map(c=>'<div class="credit-row"><strong>'+esc(c.name||"")+'</strong><span>'+esc(c.entity_type_name||"")+'</span></div>').join("") +
        '</div></section>' : '') +
      (record.discogsId && !record.richData && !loadingRich ? '<button type="button" class="btn secondary album-enrich" id="albumEnrich">Charger les détails Discogs</button>' : '');

    content.querySelector("#albumEnrich")?.addEventListener("click",()=>enrichFromDiscogs(record,true));
    content.querySelector("[data-v7-artist]")?.addEventListener("click",()=>{
      const artist=record.artist||"";
      closeAlbum();
      const artistEl=[...document.querySelectorAll(".artist-link")].find(el=>norm(el.dataset.artist)===norm(artist));
      if(artistEl) artistEl.click();
      else {
        window.dispatchEvent(new CustomEvent("vinyl:explore-filter",{detail:{type:"artist",value:artist}}));
        document.querySelector('[data-nav="collection"]')?.click();
      }
    });
  }

  async function enrichFromDiscogs(record,manual=false){
    if(!record?.discogsId) return;
    renderAlbum(record,true);
    try{
      const params=new URLSearchParams({action:"release",id:String(record.discogsId)});
      const res=await fetch(discogsProxyUrl+"?"+params.toString(),{headers:{Accept:"application/json"}});
      if(!res.ok) throw new Error("HTTP "+res.status);
      const d=await res.json();
      record.richData={
        released:d.released_formatted || d.released || "",
        tracklist:(d.tracklist||[]).map(t=>({
          position:t.position||"",
          title:t.title||"",
          duration:t.duration||"",
          type_:t.type_||"track"
        })),
        credits:(d.extraartists||[]).map(a=>({
          name:a.name||"",
          role:a.role||""
        })),
        companies:(d.companies||[]).map(c=>({
          name:c.name||"",
          entity_type_name:c.entity_type_name||""
        })),
        fetchedAt:Date.now()
      };
      saveRich();
      renderAlbum(record,false);
    }catch(err){
      renderAlbum(record,false);
      toast("Impossible de charger les détails Discogs");
    }
  }

  function openAlbum(record){
    if(!record) return;
    currentAlbumId=record.id;
    const view=ensureAlbumView();
    view.hidden=false;
    document.body.classList.add("album-view-open");
    renderAlbum(record,false);
    view.scrollTo({top:0});
    if(record.discogsId && !record.richData){
      enrichFromDiscogs(record,false);
    }
  }

  function openRandomAlbum(){
    if(!collection.length){
      toast("Ta collection est vide");
      return;
    }
    let pool=collection;
    if(collection.length>1 && currentAlbumId){
      pool=collection.filter(r=>r.id!==currentAlbumId);
    }
    openAlbum(pool[Math.floor(Math.random()*pool.length)]);
  }

  function enhanceDashboard(){
    const actions=document.querySelector(".dash-actions");
    if(!actions || actions.querySelector("[data-v7-random]")) return;
    const btn=document.createElement("button");
    btn.type="button";
    btn.dataset.v7Random="1";
    btn.innerHTML='<span>🎲</span><strong>Au hasard</strong><small>choisir un vinyle</small>';
    btn.addEventListener("click",openRandomAlbum);
    actions.appendChild(btn);
  }

  function recordFromCard(card){
    const id=card?.querySelector("[data-edit]")?.dataset.edit;
    return id ? getRecord(id) : null;
  }

  function currentVisibleRecords(){
    const cards=[...document.querySelectorAll("#collection .record-card")].filter(c=>!c.hidden);
    if(!cards.length) return [...collection];
    return cards.map(recordFromCard).filter(Boolean);
  }

  function ensurePdfDialog(){
    let dialog=document.querySelector("#pdfV7Dialog");
    if(dialog) return dialog;
    dialog=document.createElement("dialog");
    dialog.id="pdfV7Dialog";
    dialog.className="modal small pdf-v7-dialog";
    dialog.innerHTML=
      '<div class="modal-head"><div><p class="eyebrow">EXPORT PDF</p><h2>Choisir le format</h2></div>' +
      '<button type="button" class="icon-btn" data-pdf-close>✕</button></div>' +
      '<p class="hint">L’export reprend les vinyles actuellement affichés, donc tes filtres restent appliqués.</p>' +
      '<div class="pdf-mode-list">' +
        '<button type="button" data-pdf-mode="illustrated"><strong>Catalogue illustré</strong><span>2 fiches par ligne avec pochettes</span></button>' +
        '<button type="button" data-pdf-mode="compact"><strong>Inventaire compact</strong><span>Tableau pratique à imprimer</span></button>' +
        '<button type="button" data-pdf-mode="artist"><strong>Classé par artiste</strong><span>Artistes A → Z puis albums</span></button>' +
        '<button type="button" data-pdf-mode="location"><strong>Classé par emplacement</strong><span>Idéal pour retrouver les disques</span></button>' +
      '</div>';
    document.body.appendChild(dialog);
    dialog.querySelector("[data-pdf-close]").addEventListener("click",()=>dialog.close());
    dialog.querySelectorAll("[data-pdf-mode]").forEach(btn=>btn.addEventListener("click",()=>{
      dialog.close();
      exportPdf(btn.dataset.pdfMode);
    }));
    return dialog;
  }

  function printShell(title,subtitle,body,css){
    const win=window.open("","_blank");
    if(!win){
      toast("Autorise les fenêtres pop-up pour créer le PDF");
      return;
    }
    const doc='<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>'+
      '@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#181818;margin:0}'+
      'header{border-bottom:2px solid #d5a526;padding-bottom:6mm;margin-bottom:6mm}header h1{font-size:24px;margin:0 0 4px}.sub{font-size:10px;color:#666}'+
      '.screen-note{margin-bottom:6mm;padding:9px;background:#fff7dc;border:1px solid #d5a526;border-radius:7px;font-size:11px}.screen-note button{margin-left:8px}'+
      '@media print{.screen-note{display:none}}'+css+
      '</style></head><body><div class="screen-note">Choisis <b>Enregistrer au format PDF</b> dans l’impression.<button onclick="window.print()">Imprimer / PDF</button></div>'+
      '<header><h1>'+esc(title)+'</h1><div class="sub">'+esc(subtitle)+'</div></header>'+body+
      '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),900));<\/script></body></html>';
    win.document.open();win.document.write(doc);win.document.close();
  }

  function exportPdf(mode){
    let rows=currentVisibleRecords();
    if(!rows.length){toast("Aucun vinyle à exporter");return;}
    const date=new Date().toLocaleDateString("fr-FR");
    const subtitle=rows.length+" vinyle"+(rows.length>1?"s":"")+" · "+date;

    if(mode==="compact"){
      const body='<table><thead><tr><th>Artiste</th><th>Album</th><th>Année</th><th>Format</th><th>Label</th><th>Emplacement</th></tr></thead><tbody>'+
        rows.map(r=>'<tr><td>'+esc(r.artist||"")+'</td><td>'+esc(r.title||"")+'</td><td>'+esc(r.year||"")+'</td><td>'+esc(r.format||"")+'</td><td>'+esc(r.label||"")+'</td><td>'+esc(r.location||"")+'</td></tr>').join("")+
        '</tbody></table>';
      printShell("Vinylothèque — Inventaire",subtitle,body,'table{width:100%;border-collapse:collapse;font-size:8.5px}th,td{border-bottom:1px solid #ddd;padding:5px 4px;text-align:left;vertical-align:top}th{background:#f4e3ad;font-size:8px}');
      return;
    }

    if(mode==="artist" || mode==="location"){
      const key=mode==="artist" ? "artist" : "location";
      rows=[...rows].sort((a,b)=>String(a[key]||"Non renseigné").localeCompare(String(b[key]||"Non renseigné"),"fr") || String(a.title||"").localeCompare(String(b.title||""),"fr"));
      const groups=new Map();
      rows.forEach(r=>{
        const g=r[key]||"Non renseigné";
        if(!groups.has(g)) groups.set(g,[]);
        groups.get(g).push(r);
      });
      const body=[...groups.entries()].map(([name,items])=>
        '<section class="group"><h2>'+esc(name)+'</h2>'+items.map(r=>
          '<div class="line"><strong>'+esc(r.title||"")+'</strong><span>'+esc([r.year,r.format,r.location].filter(Boolean).join(" · "))+'</span></div>'
        ).join("")+'</section>'
      ).join("");
      printShell(mode==="artist"?"Vinylothèque — Par artiste":"Vinylothèque — Par emplacement",subtitle,body,
        '.group{break-inside:avoid;margin:0 0 5mm}.group h2{font-size:14px;margin:0 0 2mm;border-bottom:1px solid #d5a526;padding-bottom:1.5mm}.line{display:flex;justify-content:space-between;gap:8px;padding:2.5mm 0;border-bottom:1px solid #eee;font-size:9px}.line span{color:#666;text-align:right}');
      return;
    }

    const body='<main class="pdf-grid">'+rows.map(r=>{
      const image=coverOfRecord(r);
      return '<article class="pdf-card">'+
        (image?'<img src="'+esc(image)+'" alt="">':'<div class="ph">♪</div>')+
        '<div><h2>'+esc(r.title||"")+'</h2><h3>'+esc(r.artist||"")+'</h3><p>'+esc([r.year,r.format,r.country].filter(Boolean).join(" · "))+'</p>'+
        (r.label?'<p><b>Label :</b> '+esc(r.label)+'</p>':'')+
        (r.location?'<p><b>📍</b> '+esc(r.location)+'</p>':'')+
        '</div></article>';
    }).join("")+'</main>';
    printShell("Vinylothèque — Catalogue illustré",subtitle,body,
      '.pdf-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6mm}.pdf-card{display:grid;grid-template-columns:34mm 1fr;gap:4mm;border:1px solid #ddd;border-radius:4mm;padding:3mm;break-inside:avoid}.pdf-card img,.ph{width:34mm;height:34mm;object-fit:cover;border-radius:2mm;background:#eee;display:grid;place-items:center}.pdf-card h2{font-size:12px;margin:0 0 1px}.pdf-card h3{font-size:10px;margin:0 0 4px;color:#555}.pdf-card p{font-size:8px;margin:2px 0}');
  }

  function bindClicks(){
    document.addEventListener("click",e=>{
      const recent=e.target.closest("[data-home-record]");
      if(recent){
        const r=getRecord(recent.dataset.homeRecord);
        if(r){
          e.preventDefault();e.stopImmediatePropagation();
          openAlbum(r);
          return;
        }
      }

      const artistOpen=e.target.closest("[data-artist-edit]");
      if(artistOpen){
        const r=getRecord(artistOpen.dataset.artistEdit);
        if(r){
          e.preventDefault();e.stopImmediatePropagation();
          document.querySelector("#artistDialog")?.close();
          openAlbum(r);
          return;
        }
      }

      const card=e.target.closest("#collection .record-card");
      if(card && !e.target.closest("button,.artist-link,a,input,select,textarea")){
        const r=recordFromCard(card);
        if(r) openAlbum(r);
      }
    },true);

    document.querySelector("#exportPdfBtn")?.addEventListener("click",e=>{
      e.preventDefault();e.stopImmediatePropagation();
      ensurePdfDialog().showModal();
    },true);
  }

  const css=document.createElement("style");
  css.textContent=`
    body.album-view-open{overflow:hidden}
    .album-full-view{position:fixed;inset:0;z-index:120;background:var(--bg);overflow:auto;padding-bottom:40px}
    .album-view-topbar{position:sticky;top:0;z-index:4;display:flex;justify-content:space-between;gap:10px;padding:12px clamp(14px,4vw,42px);background:rgba(244,241,234,.94);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
    .album-back{border:0;background:transparent;font:inherit;font-weight:800;cursor:pointer}.album-view-actions{display:flex;gap:8px}
    .album-full-content{max-width:1080px;margin:auto;padding:26px clamp(15px,4vw,42px)}
    .album-hero-full{display:grid;grid-template-columns:minmax(250px,420px) 1fr;gap:34px;align-items:center}
    .album-cover-large{aspect-ratio:1;background:#ddd4c5;border-radius:24px;overflow:hidden;box-shadow:0 18px 55px rgba(20,18,14,.16)}
    .album-cover-large img,.album-cover-placeholder{width:100%;height:100%;object-fit:cover;display:grid;place-items:center;font-size:5rem}
    .album-main-info h1{font-size:clamp(2.2rem,6vw,4.8rem);line-height:.95;letter-spacing:-.06em;margin:0 0 10px}
    .album-artist-button{border:0;background:transparent;padding:0;font:inherit;font-size:1.25rem;font-weight:800;color:var(--muted);cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:4px}
    .album-edition{margin:12px 0;color:var(--muted)}.album-chips{display:flex;gap:6px;flex-wrap:wrap}.album-chips span{background:#fff;border:1px solid var(--line);padding:6px 9px;border-radius:999px;font-size:.75rem;font-weight:800}
    .album-location-big{display:inline-flex;margin-top:16px;padding:10px 13px;background:#fff7dc;border:1px solid #ead27d;border-radius:13px;color:#6b5718}.album-personal-rating{display:flex;align-items:center;gap:10px;margin-top:12px;font-size:1.2rem;color:#9a7a23;font-weight:900}.album-personal-rating span{font-size:.8rem;color:var(--ink);background:#fff;border:1px solid var(--line);padding:5px 8px;border-radius:999px}.album-context{background:#fffaf0;border-color:#e7cc74}
    .album-detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:30px 0}
    .album-meta-item{background:#fff;border:1px solid var(--line);border-radius:16px;padding:13px}.album-meta-item span,.album-meta-item strong{display:block}.album-meta-item span{font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.album-meta-item strong{margin-top:4px;font-size:.9rem}
    .album-section{background:#fff;border:1px solid var(--line);border-radius:20px;padding:18px;margin-top:14px}.album-section h2{margin:0 0 12px;font-size:1.25rem}.album-notes{white-space:pre-wrap;line-height:1.5}.album-muted,.album-loading{color:var(--muted);font-size:.85rem}
    .album-section-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.album-listen{background:linear-gradient(135deg,#fff,#fff8df)}.listen-links{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.listen-link{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 13px;border:1px solid var(--line);border-radius:14px;background:#fff;color:var(--ink);text-decoration:none}.listen-link strong{font-size:.9rem}.listen-link span{font-size:.72rem;color:var(--muted);white-space:nowrap}.listen-link:active{transform:scale(.985)}
    .track-list,.credit-list{display:grid}.track-row,.credit-row{display:grid;grid-template-columns:55px 1fr auto;gap:9px;padding:9px 0;border-bottom:1px solid #eee;font-size:.88rem}.track-row:last-child,.credit-row:last-child{border-bottom:0}.track-pos,.track-duration,.credit-row span{color:var(--muted)}.track-heading{font-weight:900;padding:13px 0 6px}
    .credit-row{grid-template-columns:1fr auto}.album-enrich{margin-top:14px}
    .dash-actions{grid-template-columns:repeat(4,1fr)!important}
    .record-card{cursor:pointer}
    .pdf-mode-list{display:grid;gap:9px}.pdf-mode-list button{border:1px solid var(--line);background:#fff;border-radius:15px;padding:14px;text-align:left;cursor:pointer}.pdf-mode-list strong,.pdf-mode-list span{display:block}.pdf-mode-list span{font-size:.78rem;color:var(--muted);margin-top:3px}
    @media(max-width:760px){
      .listen-links{grid-template-columns:1fr 1fr}
      .album-hero-full{grid-template-columns:1fr;gap:20px}.album-cover-large{width:min(100%,480px);margin:auto}.album-detail-grid{grid-template-columns:1fr 1fr}.dash-actions{grid-template-columns:1fr!important}.album-view-actions .btn.secondary{display:none}
    }
    @media(max-width:430px){.listen-links{grid-template-columns:1fr}.album-detail-grid{grid-template-columns:1fr}.album-full-content{padding-top:16px}.track-row{grid-template-columns:40px 1fr auto;font-size:.8rem}}
  `;
  document.head.appendChild(css);

  window.addEventListener("vinyl:open-album",e=>{const r=getRecord(e.detail?.id);if(r)openAlbum(r);});

  ensureAlbumView();
  ensurePdfDialog();
  bindClicks();
  enhanceDashboard();

  const observer=new MutationObserver(()=>enhanceDashboard());
  observer.observe(document.body,{childList:true,subtree:true});
})();