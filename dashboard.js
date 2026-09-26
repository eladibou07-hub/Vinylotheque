(() => {
  const norm = v => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const split = v => String(v || "").split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  const uniq = arr => [...new Map(arr.filter(Boolean).map(v => [norm(v), v])).values()];
  let currentView = "home";

  const topValue = values => {
    const counts = new Map();
    values.filter(Boolean).forEach(v => {
      const k = norm(v);
      const old = counts.get(k) || {name:v,count:0};
      old.count++;
      counts.set(k, old);
    });
    return [...counts.values()].sort((a,b) => b.count-a.count || a.name.localeCompare(b.name,"fr"))[0] || null;
  };

  const decade = y => {
    const n = Number(y);
    return n > 1800 && n < 2200 ? Math.floor(n/10)*10 + "s" : "";
  };

  const cover = r => typeof coverOf === "function" ? coverOf(r) : (r.personalPhoto || r.coverUrl || "");

  function coversMarkup(records, limit=4){
    const rows = records.filter(Boolean).slice(0,limit);
    if (!rows.length) return '<div class="dash-cover-empty">♪</div>';
    return rows.map(r => {
      const src = cover(r);
      return src
        ? '<img src="' + esc(src) + '" alt="" loading="lazy">'
        : '<div class="dash-cover-empty">♪</div>';
    }).join("");
  }

  function ensureDashboard(){
    const shell = document.querySelector(".shell");
    if (!shell) return null;
    let dash = document.querySelector("#dashboardHome");
    if (!dash) {
      dash = document.createElement("section");
      dash.id = "dashboardHome";
      dash.className = "dashboard-home";
      shell.prepend(dash);
    }

    let collectionHeader = document.querySelector("#collectionHeader");
    if (!collectionHeader) {
      collectionHeader = document.createElement("section");
      collectionHeader.id = "collectionHeader";
      collectionHeader.className = "collection-header";
      collectionHeader.innerHTML =
        '<div><p class="eyebrow">MA COLLECTION</p><h2>Mes vinyles</h2></div>' +
        '<button type="button" class="btn secondary" id="collectionHomeBtn">← Accueil</button>';
      const toolbar = document.querySelector(".toolbar");
      toolbar?.insertAdjacentElement("beforebegin", collectionHeader);
      collectionHeader.querySelector("#collectionHomeBtn")?.addEventListener("click", () => setView("home"));
    }

    document.querySelector(".hero")?.classList.add("legacy-hero-hidden");
    document.querySelector(".stats")?.classList.add("legacy-stats-hidden");
    ensureBottomNav();
    return dash;
  }

  function ensureBottomNav(){
    let nav = document.querySelector("#appBottomNav");
    if (nav) return nav;
    nav = document.createElement("nav");
    nav.id = "appBottomNav";
    nav.className = "app-bottom-nav";
    nav.setAttribute("aria-label","Navigation principale");
    nav.innerHTML =
      '<button type="button" data-nav="home"><span>⌂</span><b>Accueil</b></button>' +
      '<button type="button" data-nav="collection"><span>▦</span><b>Collection</b></button>' +
      '<button type="button" data-nav="add" class="nav-add"><span>＋</span><b>Ajouter</b></button>' +
      '<button type="button" data-nav="search"><span>⌕</span><b>Recherche</b></button>';
    document.body.appendChild(nav);

    nav.addEventListener("click", e => {
      const btn = e.target.closest("[data-nav]");
      if (!btn) return;
      const action = btn.dataset.nav;
      if (action === "home") setView("home");
      if (action === "collection") setView("collection");
      if (action === "add") {
        if (typeof openRecord === "function") openRecord();
      }
      if (action === "search") document.querySelector("#discogsBtn")?.click();
    });
    return nav;
  }

  function recentRecords(){
    return [...collection].sort((a,b) => Number(b.addedAt||0)-Number(a.addedAt||0));
  }

  function renderHome(){
    const dash = ensureDashboard();
    if (!dash) return;

    const recent = recentRecords();
    const latest = recent[0];
    const artistCount = new Set(collection.map(r => norm(r.artist)).filter(Boolean)).size;
    const locations = uniq(collection.map(r => r.location));
    const topStyle = topValue(collection.flatMap(r => split(r.style)));
    const topCountry = topValue(collection.map(r => r.country));
    const topDecade = topValue(collection.map(r => decade(r.year)));

    const artistPreview = recent.filter(r => r.artist).slice(0,4);
    const stylePreview = topStyle
      ? recent.filter(r => split(r.style).some(s => norm(s) === norm(topStyle.name))).slice(0,4)
      : recent.slice(0,4);
    const decadePreview = topDecade
      ? recent.filter(r => decade(r.year) === topDecade.name).slice(0,4)
      : recent.slice(0,4);
    const locationPreview = locations.length
      ? recent.filter(r => r.location).slice(0,4)
      : recent.slice(0,4);

    dash.innerHTML =
      '<section class="dash-hero">' +
        '<img class="dash-logo" src="icons/icon.svg?v=6.1" alt="">' +
        '<div class="dash-hero-copy">' +
          '<p class="eyebrow">VINYLOTHÈQUE</p>' +
          '<h2>Ma collection</h2>' +
          '<p class="dash-summary"><strong>' + collection.length + '</strong> vinyle' + (collection.length>1?"s":"") +
          ' · <strong>' + artistCount + '</strong> artiste' + (artistCount>1?"s":"") + '</p>' +
          (latest ? '<p class="dash-last">Dernier ajout : <b>' + esc(latest.artist || "") + ' — ' + esc(latest.title || "") + '</b></p>' : '<p class="dash-last">Ta collection est prête à démarrer.</p>') +
        '</div>' +
      '</section>' +

      '<section class="dash-actions" aria-label="Actions rapides">' +
        '<button type="button" data-dash-action="add"><span>＋</span><strong>Ajouter</strong><small>manuellement</small></button>' +
        '<button type="button" data-dash-action="scan"><span>▦</span><strong>Scanner</strong><small>un code-barres</small></button>' +
        '<button type="button" data-dash-action="discogs"><span>⌕</span><strong>Discogs</strong><small>rechercher une édition</small></button>' +
      '</section>' +

      '<section class="dash-section">' +
        '<div class="dash-section-head"><div><p class="eyebrow">EXPLORER</p><h3>Ma collection</h3></div></div>' +
        '<div class="dash-explorer">' +
          explorerCard("artists","Artistes", artistCount + " artiste" + (artistCount>1?"s":""), artistPreview) +
          explorerCard("styles","Styles", topStyle ? "Le + présent : " + topStyle.name : "Par genre musical", stylePreview) +
          explorerCard("decades","Décennies", topDecade ? "Le + présent : " + topDecade.name : "Par période", decadePreview) +
          explorerCard("locations","Emplacements", locations.length + " emplacement" + (locations.length>1?"s":""), locationPreview) +
        '</div>' +
      '</section>' +

      '<section class="dash-section">' +
        '<div class="dash-section-head"><div><p class="eyebrow">DERNIERS AJOUTS</p><h3>Récemment dans la collection</h3></div>' +
        '<button type="button" class="dash-link" data-dash-action="collection">Tout voir</button></div>' +
        '<div class="dash-recent">' +
          (recent.length ? recent.slice(0,8).map(r => recentCard(r)).join("") : '<p class="hint">Ajoute ton premier vinyle pour le voir apparaître ici.</p>') +
        '</div>' +
      '</section>' +

      '<section class="dash-section">' +
        '<div class="dash-section-head"><div><p class="eyebrow">EN CHIFFRES</p><h3>Ma collection</h3></div></div>' +
        '<div class="dash-stats">' +
          statCard(collection.length,"Vinyles") +
          statCard(artistCount,"Artistes") +
          statCard(topStyle?.name || "—","Style principal") +
          statCard(topDecade?.name || "—","Décennie principale") +
          statCard(topCountry?.name || "—","Pays principal") +
          statCard(locations.length,"Emplacements") +
        '</div>' +
      '</section>' +

      '<button type="button" class="btn primary dash-all" data-dash-action="collection">Voir toute la collection</button>';

    dash.querySelectorAll("[data-dash-action]").forEach(btn => btn.addEventListener("click", () => {
      const action = btn.dataset.dashAction;
      if (action === "add" && typeof openRecord === "function") openRecord();
      if (action === "scan") document.querySelector("#scanBtn")?.click();
      if (action === "discogs") document.querySelector("#discogsBtn")?.click();
      if (action === "collection") setView("collection");
    }));

    dash.querySelectorAll("[data-explore]").forEach(btn => btn.addEventListener("click", () => explore(btn.dataset.explore)));
    dash.querySelectorAll("[data-home-record]").forEach(btn => btn.addEventListener("click", () => {
      const r = collection.find(x => x.id === btn.dataset.homeRecord);
      if (r && typeof openRecord === "function") openRecord(r);
    }));
  }

  function explorerCard(key,title,subtitle,records){
    return '<button type="button" class="dash-explore-card" data-explore="' + key + '">' +
      '<div class="dash-mini-covers">' + coversMarkup(records) + '</div>' +
      '<div><strong>' + esc(title) + '</strong><small>' + esc(subtitle) + '</small></div>' +
      '<span class="dash-arrow">›</span>' +
    '</button>';
  }

  function recentCard(r){
    const src = cover(r);
    return '<button type="button" class="dash-recent-card" data-home-record="' + esc(r.id) + '">' +
      (src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : '<div class="dash-recent-empty">♪</div>') +
      '<strong>' + esc(r.title || "Sans titre") + '</strong>' +
      '<span>' + esc(r.artist || "Artiste inconnu") + '</span>' +
    '</button>';
  }

  function statCard(value,label){
    return '<article><strong>' + esc(value) + '</strong><span>' + esc(label) + '</span></article>';
  }

  function openAdvanced(){
    const panel = document.querySelector("#advancedPanel");
    if (panel) panel.hidden = false;
    document.querySelector("#advancedWrap")?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function explore(type){
    setView("collection");
    setTimeout(() => {
      if (type === "artists") {
        const sort = document.querySelector("#sortBy");
        if (sort) {
          sort.value = "artist-asc";
          sort.dispatchEvent(new Event("change",{bubbles:true}));
        }
        document.querySelector("#collection")?.scrollIntoView({behavior:"smooth",block:"start"});
      }
      if (type === "styles") {
        document.querySelector("#styleBrowser")?.scrollIntoView({behavior:"smooth",block:"start"});
      }
      if (type === "decades") {
        openAdvanced();
        document.querySelector("#filterDecade")?.focus();
      }
      if (type === "locations") {
        openAdvanced();
        document.querySelector("#filterLocationAdv")?.focus();
      }
    },80);
  }

  function setCollectionVisibility(show){
    const selectors = [
      "#collectionHeader",".toolbar","#advancedWrap","#styleBrowser",
      "#emptyState","#collection"
    ];
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.classList.toggle("dashboard-hidden", !show);
    });
    const footer = document.querySelector("footer");
    if (footer) footer.classList.toggle("dashboard-hidden", !show);
  }

  function setView(view){
    currentView = view === "collection" ? "collection" : "home";
    const dash = ensureDashboard();
    if (dash) dash.classList.toggle("dashboard-hidden", currentView !== "home");
    setCollectionVisibility(currentView === "collection");

    document.body.dataset.appView = currentView;
    document.querySelectorAll("#appBottomNav [data-nav]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.nav === currentView);
    });

    if (currentView === "home") {
      renderHome();
      window.scrollTo({top:0,behavior:"smooth"});
    } else {
      if (typeof render === "function") render();
      window.scrollTo({top:0,behavior:"smooth"});
    }
  }

  const css = document.createElement("style");
  css.textContent = `
    body{padding-bottom:86px}
    .legacy-hero-hidden,.legacy-stats-hidden{display:none!important}
    .dashboard-hidden{display:none!important}
    .dashboard-home{display:grid;gap:30px}
    .dash-hero{display:grid;grid-template-columns:108px 1fr;gap:22px;align-items:center;background:linear-gradient(135deg,#fff8dc,#f3df9e);border:1px solid #e2c56a;border-radius:28px;padding:22px;box-shadow:0 12px 35px rgba(84,57,10,.08)}
    .dash-logo{width:108px;height:108px;border-radius:25px;box-shadow:0 10px 25px rgba(80,52,5,.18)}
    .dash-hero h2{font-size:clamp(2rem,7vw,4.4rem);line-height:.95;letter-spacing:-.06em;margin:0 0 10px}
    .dash-summary{margin:0 0 5px;color:#514522}.dash-last{margin:0;color:#75652f;font-size:.88rem}
    .dash-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .dash-actions button{border:1px solid var(--line);background:var(--card);border-radius:20px;padding:17px;text-align:left;cursor:pointer;display:grid;grid-template-columns:auto 1fr;column-gap:10px;align-items:center}
    .dash-actions button>span{grid-row:1/3;font-size:1.6rem;width:42px;height:42px;border-radius:50%;background:#f4e3ad;display:grid;place-items:center}
    .dash-actions strong{font-size:.98rem}.dash-actions small{color:var(--muted);font-size:.73rem}
    .dash-section{display:grid;gap:12px}
    .dash-section-head{display:flex;align-items:end;justify-content:space-between;gap:15px}
    .dash-section-head h3{margin:0;font-size:1.35rem;letter-spacing:-.035em}
    .dash-link{border:0;background:transparent;text-decoration:underline;color:var(--muted);cursor:pointer;font-weight:700}
    .dash-explorer{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    .dash-explore-card{position:relative;border:1px solid var(--line);background:var(--card);border-radius:20px;padding:10px;text-align:left;cursor:pointer;overflow:hidden}
    .dash-mini-covers{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:10px}
    .dash-mini-covers img,.dash-cover-empty{width:100%;aspect-ratio:1;object-fit:cover;border-radius:9px;background:#ded8cd;display:grid;place-items:center}
    .dash-explore-card strong,.dash-explore-card small{display:block}.dash-explore-card small{color:var(--muted);font-size:.72rem;margin-top:3px;padding-right:16px}
    .dash-arrow{position:absolute;right:10px;bottom:9px;font-size:1.35rem;color:#9a7a23}
    .dash-recent{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(145px,190px);gap:11px;overflow-x:auto;padding:2px 2px 10px;scroll-snap-type:x proximity}
    .dash-recent-card{border:0;background:transparent;padding:0;text-align:left;cursor:pointer;scroll-snap-align:start}
    .dash-recent-card img,.dash-recent-empty{width:100%;aspect-ratio:1;object-fit:cover;border-radius:16px;background:#ded8cd;display:grid;place-items:center;font-size:2rem}
    .dash-recent-card strong,.dash-recent-card span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dash-recent-card strong{font-size:.84rem;margin-top:7px}.dash-recent-card span{font-size:.73rem;color:var(--muted);margin-top:2px}
    .dash-stats{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}
    .dash-stats article{background:var(--card);border:1px solid var(--line);border-radius:17px;padding:14px;min-width:0}
    .dash-stats strong{display:block;font-size:1.22rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dash-stats span{display:block;color:var(--muted);font-size:.72rem;margin-top:3px}
    .dash-all{justify-self:center;min-width:240px}
    .collection-header{display:flex;justify-content:space-between;align-items:end;gap:15px;margin-bottom:8px}
    .collection-header h2{font-size:clamp(2rem,6vw,3.6rem);letter-spacing:-.055em;margin:0}
    .app-bottom-nav{position:fixed;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:80;width:min(520px,calc(100% - 22px));display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:7px;background:rgba(20,20,18,.94);backdrop-filter:blur(16px);border-radius:22px;box-shadow:0 16px 40px rgba(0,0,0,.24)}
    .app-bottom-nav button{border:0;background:transparent;color:#cfcac0;border-radius:16px;padding:7px 4px;display:grid;gap:2px;place-items:center;cursor:pointer;font:inherit}
    .app-bottom-nav button span{font-size:1.18rem}.app-bottom-nav button b{font-size:.67rem}
    .app-bottom-nav button.active{background:#f4e3ad;color:#18130a}
    .app-bottom-nav .nav-add{color:#f1cb58}
    @media(max-width:800px){
      .dash-explorer{grid-template-columns:1fr 1fr}
      .dash-stats{grid-template-columns:1fr 1fr 1fr}
    }
    @media(max-width:560px){
      .shell{padding-top:18px;padding-bottom:105px}
      .dash-hero{grid-template-columns:76px 1fr;padding:16px;border-radius:22px;gap:14px}
      .dash-logo{width:76px;height:76px;border-radius:18px}
      .dash-hero h2{font-size:2.35rem}.dash-last{font-size:.76rem}
      .dash-actions{grid-template-columns:1fr}
      .dash-actions button{padding:13px 15px}
      .dash-explorer{grid-template-columns:1fr 1fr;gap:9px}
      .dash-stats{grid-template-columns:1fr 1fr}
      .collection-header{align-items:flex-start}
      .collection-header .btn{padding:10px 13px}
      footer{padding-bottom:105px}
    }
  `;
  document.head.appendChild(css);

  ensureDashboard();
  renderHome();

  const collectionEl = document.querySelector("#collection");
  if (collectionEl) {
    let refreshTimer;
    new MutationObserver(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (currentView === "home") renderHome();
      },80);
    }).observe(collectionEl,{childList:true});
  }

  setView("home");
})();