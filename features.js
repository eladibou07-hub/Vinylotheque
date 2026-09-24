(() => {
  const splitTax = v => String(v || "").split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  const norm = v => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const uniq = arr => [...new Map(arr.filter(Boolean).map(v => [norm(v), v])).values()];
  const knownGenres = new Set([
    "blues","brass & military","children's","classical","electronic",
    "folk, world, & country","funk / soul","hip hop","jazz","latin",
    "non-music","pop","reggae","rock","stage & screen"
  ]);
  let activeStyle = "";

  function migrateLegacyTaxonomy(){
    let changed = false;
    collection.forEach(r => {
      if (r.style || !r.genre) return;
      const parts = splitTax(r.genre);
      if (parts.length < 2) return;
      const genres = parts.filter(v => knownGenres.has(norm(v)));
      const styles = parts.filter(v => !knownGenres.has(norm(v)));
      if (genres.length && styles.length) {
        r.genre = uniq(genres).join(", ");
        r.style = uniq(styles).join(", ");
        changed = true;
      }
    });
    if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
    return changed;
  }

  function decadeOf(year){
    const y = Number(year);
    return y > 1800 && y < 2200 ? String(Math.floor(y / 10) * 10) : "";
  }

  function ensureAdvancedUI(){
    const toolbar = document.querySelector(".toolbar");
    if (!toolbar) return null;
    let wrap = document.querySelector("#advancedWrap");
    if (wrap) return wrap;

    wrap = document.createElement("section");
    wrap.id = "advancedWrap";
    wrap.className = "advanced-wrap";
    wrap.innerHTML =
      '<div class="advanced-toggle-row">' +
        '<button type="button" id="toggleAdvanced" class="btn secondary">Filtres avancés</button>' +
        '<span id="advancedCount" class="advanced-count" hidden></span>' +
      '</div>' +
      '<div id="advancedPanel" class="advanced-panel" hidden>' +
        '<select id="filterDecade" aria-label="Filtrer par décennie"><option value="">Toutes les décennies</option></select>' +
        '<select id="filterCountryAdv" aria-label="Filtrer par pays"><option value="">Tous les pays</option></select>' +
        '<select id="filterLabelAdv" aria-label="Filtrer par label"><option value="">Tous les labels</option></select>' +
        '<select id="filterFormatAdv" aria-label="Filtrer par format"><option value="">Tous les formats</option></select>' +
        '<select id="filterLocationAdv" aria-label="Filtrer par emplacement"><option value="">Tous les emplacements</option></select>' +
        '<button type="button" id="resetAdvanced" class="btn secondary">Réinitialiser</button>' +
      '</div>';
    toolbar.insertAdjacentElement("afterend", wrap);

    wrap.querySelector("#toggleAdvanced").addEventListener("click", () => {
      const panel = wrap.querySelector("#advancedPanel");
      panel.hidden = !panel.hidden;
    });
    wrap.querySelector("#resetAdvanced").addEventListener("click", () => {
      ["filterDecade","filterCountryAdv","filterLabelAdv","filterFormatAdv","filterLocationAdv"].forEach(id => {
        const el = document.querySelector("#" + id);
        if (el) el.value = "";
      });
      apply();
    });
    wrap.querySelectorAll("select").forEach(el => el.addEventListener("change", apply));
    return wrap;
  }

  function setSelectOptions(id, firstLabel, values){
    const select = document.querySelector("#" + id);
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">' + esc(firstLabel) + '</option>' +
      values.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join("");
    if ([...select.options].some(o => o.value === current)) select.value = current;
  }

  function populateAdvanced(){
    ensureAdvancedUI();
    const decades = uniq(collection.map(r => decadeOf(r.year)).filter(Boolean))
      .sort((a,b) => Number(b) - Number(a))
      .map(v => v + "s");
    setSelectOptions("filterDecade", "Toutes les décennies", decades);
    setSelectOptions("filterCountryAdv", "Tous les pays",
      uniq(collection.map(r => r.country)).sort((a,b)=>a.localeCompare(b,"fr")));
    setSelectOptions("filterLabelAdv", "Tous les labels",
      uniq(collection.map(r => r.label)).sort((a,b)=>a.localeCompare(b,"fr")));
    setSelectOptions("filterFormatAdv", "Tous les formats",
      uniq(collection.map(r => r.format)).sort((a,b)=>a.localeCompare(b,"fr")));
    setSelectOptions("filterLocationAdv", "Tous les emplacements",
      uniq(collection.map(r => r.location)).sort((a,b)=>a.localeCompare(b,"fr")));

    const count = ["filterDecade","filterCountryAdv","filterLabelAdv","filterFormatAdv","filterLocationAdv"]
      .filter(id => document.querySelector("#" + id)?.value).length;
    const badge = document.querySelector("#advancedCount");
    if (badge) {
      badge.hidden = count === 0;
      badge.textContent = count ? count + " actif" + (count > 1 ? "s" : "") : "";
    }
  }

  function mainFiltersMatch(r){
    const q = norm(document.querySelector("#filterText")?.value || "");
    const genre = document.querySelector("#filterGenre")?.value || "";
    const hay = norm([
      r.artist,r.title,r.label,r.catno,r.barcode,r.country,r.genre,r.style,
      r.year,r.format,r.location,r.notes
    ].join(" "));
    const genreOk = !genre || splitTax(r.genre).some(v => norm(v) === norm(genre));
    return (!q || hay.includes(q)) && genreOk;
  }

  function advancedMatch(r){
    const decade = document.querySelector("#filterDecade")?.value || "";
    const country = document.querySelector("#filterCountryAdv")?.value || "";
    const label = document.querySelector("#filterLabelAdv")?.value || "";
    const format = document.querySelector("#filterFormatAdv")?.value || "";
    const location = document.querySelector("#filterLocationAdv")?.value || "";

    if (decade && decadeOf(r.year) + "s" !== decade) return false;
    if (country && String(r.country || "") !== country) return false;
    if (label && String(r.label || "") !== label) return false;
    if (format && String(r.format || "") !== format) return false;
    if (location && String(r.location || "") !== location) return false;
    return true;
  }

  function baseRecords(){
    return collection.filter(r => mainFiltersMatch(r) && advancedMatch(r));
  }

  function ensureBrowser(){
    const anchor = document.querySelector("#advancedWrap") || document.querySelector(".toolbar");
    if (!anchor) return null;
    let section = document.querySelector("#styleBrowser");
    if (!section) {
      section = document.createElement("section");
      section.id = "styleBrowser";
      section.className = "style-browser";
      section.innerHTML =
        '<div class="style-browser-head">' +
          '<div><p class="eyebrow">EXPLORER</p><h3>Par style</h3></div>' +
          '<button type="button" id="clearStyleFilter" class="btn secondary">Tous les styles</button>' +
        '</div>' +
        '<div id="styleBrowserGrid" class="style-browser-grid"></div>';
      anchor.insertAdjacentElement("afterend", section);
      section.querySelector("#clearStyleFilter").addEventListener("click", () => {
        activeStyle = "";
        apply();
      });
    }
    return section;
  }

  function styleGroups(){
    const map = new Map();
    baseRecords().forEach(record => {
      splitTax(record.style).forEach(style => {
        const key = norm(style);
        if (!map.has(key)) map.set(key, {name:style, records:[]});
        map.get(key).records.push(record);
      });
    });
    return [...map.values()].sort((a,b) => a.name.localeCompare(b.name, "fr"));
  }

  function renderBrowser(){
    const section = ensureBrowser();
    if (!section) return;
    const grid = section.querySelector("#styleBrowserGrid");
    const groups = styleGroups();

    if (activeStyle && !groups.some(g => norm(g.name) === norm(activeStyle))) activeStyle = "";

    if (!groups.length) {
      grid.innerHTML = '<p class="hint">Les styles apparaîtront ici dès qu’ils seront renseignés sur tes vinyles.</p>';
      return;
    }

    grid.innerHTML = groups.map(group => {
      const covers = group.records.slice(0,4).map(r => {
        const src = coverOf(r);
        return src
          ? '<img src="' + esc(src) + '" alt="' + esc(r.title || group.name) + '" loading="lazy">'
          : '<div class="style-thumb placeholder-thumb"></div>';
      }).join("");
      return '<button type="button" class="style-card ' +
        (norm(activeStyle)===norm(group.name) ? "active" : "") +
        '" data-style="' + esc(group.name) + '">' +
        '<div class="style-card-thumbs">' + covers + '</div>' +
        '<div class="style-card-meta"><strong>' + esc(group.name) + '</strong>' +
        '<span>' + group.records.length + ' vinyle' + (group.records.length>1?"s":"") + '</span></div>' +
        '</button>';
    }).join("");

    grid.querySelectorAll("[data-style]").forEach(btn => btn.addEventListener("click", () => {
      const value = btn.dataset.style || "";
      activeStyle = norm(activeStyle) === norm(value) ? "" : value;
      apply();
      document.querySelector("#collection")?.scrollIntoView({behavior:"smooth",block:"start"});
    }));
  }

  function addTags(card, record){
    card.querySelector(".taxonomy-tags")?.remove();
    const items = [
      ...splitTax(record.genre).map(v => [v,"genre"]),
      ...splitTax(record.style).map(v => [v,"style"])
    ];
    if (items.length) {
      const wrap = document.createElement("div");
      wrap.className = "taxonomy-tags";
      wrap.innerHTML = items.map(([v,k]) =>
        '<span class="taxonomy-tag ' + k + '">' + esc(v) + '</span>'
      ).join("");
      card.querySelector(".card-actions")?.before(wrap);
    }

    card.querySelector(".location-line")?.remove();
    if (record.location) {
      const loc = document.createElement("div");
      loc.className = "location-line";
      loc.textContent = "📍 " + record.location;
      card.querySelector(".card-actions")?.before(loc);
    }

    const artist = card.querySelector(".artist");
    if (artist) {
      artist.classList.add("artist-link");
      artist.dataset.artist = record.artist || "";
      artist.setAttribute("role","button");
      artist.setAttribute("tabindex","0");
      artist.setAttribute("title","Voir la fiche artiste");
    }
  }

  function filterCards(){
    const container = document.querySelector("#collection");
    if (!container) return;
    let visible = 0;
    container.querySelectorAll(".record-card").forEach(card => {
      const id = card.querySelector("[data-edit]")?.dataset.edit;
      const record = collection.find(r => r.id === id);
      if (!record) return;
      addTags(card, record);
      const styleOk = !activeStyle || splitTax(record.style).some(s => norm(s) === norm(activeStyle));
      const ok = mainFiltersMatch(record) && advancedMatch(record) && styleOk;
      card.hidden = !ok;
      if (ok) visible++;
    });
    container.hidden = visible === 0;
  }

  function ensureArtistDialog(){
    let dialog = document.querySelector("#artistDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "artistDialog";
    dialog.className = "modal artist-modal";
    dialog.innerHTML =
      '<div class="modal-head">' +
        '<div><p class="eyebrow">ARTISTE</p><h2 id="artistDialogTitle"></h2></div>' +
        '<button type="button" class="icon-btn" id="closeArtistDialog" aria-label="Fermer">✕</button>' +
      '</div>' +
      '<div id="artistDialogStats" class="artist-stats"></div>' +
      '<div id="artistDialogRecords" class="artist-records"></div>';
    document.body.appendChild(dialog);
    dialog.querySelector("#closeArtistDialog").addEventListener("click",()=>dialog.close());
    dialog.addEventListener("click", e => {
      const edit = e.target.closest("[data-artist-edit]");
      if (!edit) return;
      const record = collection.find(r => r.id === edit.dataset.artistEdit);
      if (record) {
        dialog.close();
        openRecord(record);
      }
    });
    return dialog;
  }

  function openArtist(artistName){
    if (!artistName) return;
    const dialog = ensureArtistDialog();
    const records = collection
      .filter(r => norm(r.artist) === norm(artistName))
      .sort((a,b) => Number(a.year||9999)-Number(b.year||9999) || String(a.title||"").localeCompare(String(b.title||""),"fr"));

    const years = records.map(r=>Number(r.year)).filter(y=>y>1800&&y<2200).sort((a,b)=>a-b);
    const genres = uniq(records.flatMap(r=>splitTax(r.genre)));
    dialog.querySelector("#artistDialogTitle").textContent = artistName;
    dialog.querySelector("#artistDialogStats").innerHTML =
      '<strong>' + records.length + '</strong><span>vinyle' + (records.length>1?"s":"") + '</span>' +
      (years.length ? '<strong>' + (years[0]===years.at(-1)?years[0]:years[0]+"–"+years.at(-1)) + '</strong><span>période</span>' : '') +
      (genres.length ? '<strong>' + esc(genres.slice(0,3).join(", ")) + '</strong><span>genre' + (genres.length>1?"s":"") + '</span>' : '');

    dialog.querySelector("#artistDialogRecords").innerHTML = records.map(r => {
      const cover = coverOf(r);
      return '<article class="artist-record">' +
        (cover ? '<img src="' + esc(cover) + '" alt="">' : '<div class="artist-record-placeholder"></div>') +
        '<div><h3>' + esc(r.title || "Sans titre") + '</h3>' +
        '<p>' + esc([r.year,r.format,r.style].filter(Boolean).join(" · ")) + '</p>' +
        (r.location ? '<p>📍 ' + esc(r.location) + '</p>' : '') + '</div>' +
        '<button type="button" class="btn secondary" data-artist-edit="' + esc(r.id) + '">Ouvrir</button>' +
      '</article>';
    }).join("");
    dialog.showModal();
  }

  function visibleRecords(){
    const container = document.querySelector("#collection");
    if (!container) return [];
    return [...container.querySelectorAll(".record-card")]
      .filter(card => !card.hidden)
      .map(card => card.querySelector("[data-edit]")?.dataset.edit)
      .map(id => collection.find(r => r.id === id))
      .filter(Boolean);
  }

  function filterSummary(){
    const parts = [];
    const genre = document.querySelector("#filterGenre")?.value;
    const decade = document.querySelector("#filterDecade")?.value;
    const country = document.querySelector("#filterCountryAdv")?.value;
    const label = document.querySelector("#filterLabelAdv")?.value;
    const format = document.querySelector("#filterFormatAdv")?.value;
    const location = document.querySelector("#filterLocationAdv")?.value;
    if (genre) parts.push("Genre : " + genre);
    if (activeStyle) parts.push("Style : " + activeStyle);
    if (decade) parts.push("Décennie : " + decade);
    if (country) parts.push("Pays : " + country);
    if (label) parts.push("Label : " + label);
    if (format) parts.push("Format : " + format);
    if (location) parts.push("Emplacement : " + location);
    return parts;
  }

  function exportPdfCatalogue(){
    const rows = visibleRecords();
    if (!rows.length) {
      toast("Aucun vinyle à exporter avec ces filtres");
      return;
    }

    const win = window.open("", "_blank");
    if (!win) {
      toast("Autorise les fenêtres pop-up pour créer le PDF");
      return;
    }

    const summary = filterSummary();
    const date = new Date().toLocaleDateString("fr-FR");
    const cards = rows.map(r => {
      const cover = coverOf(r);
      return '<article class="record">' +
        (cover ? '<img src="' + esc(cover) + '" alt="">' : '<div class="placeholder">♪</div>') +
        '<div class="info"><h2>' + esc(r.title || "Sans titre") + '</h2>' +
        '<h3>' + esc(r.artist || "Artiste inconnu") + '</h3>' +
        '<p>' + esc([r.year,r.format,r.country].filter(Boolean).join(" · ")) + '</p>' +
        (r.genre ? '<p><b>Genre :</b> ' + esc(r.genre) + '</p>' : '') +
        (r.style ? '<p><b>Style :</b> ' + esc(r.style) + '</p>' : '') +
        (r.label ? '<p><b>Label :</b> ' + esc(r.label) + (r.catno ? ' — ' + esc(r.catno) : '') + '</p>' : '') +
        (r.location ? '<p><b>Emplacement :</b> ' + esc(r.location) + '</p>' : '') +
        '</div></article>';
    }).join("");

    const doc = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Catalogue Vinylothèque</title>' +
      '<style>' +
      '@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#181818;margin:0}' +
      'header{border-bottom:2px solid #d5a526;padding-bottom:8mm;margin-bottom:7mm}h1{font-size:25px;margin:0 0 4px}' +
      '.sub{font-size:11px;color:#666}.summary{font-size:10px;margin-top:5px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7mm}' +
      '.record{display:grid;grid-template-columns:36mm 1fr;gap:4mm;border:1px solid #ddd;border-radius:4mm;padding:3mm;break-inside:avoid;page-break-inside:avoid}' +
      '.record img,.placeholder{width:36mm;height:36mm;object-fit:cover;border-radius:2mm;background:#eee;display:grid;place-items:center;font-size:30px}' +
      '.info h2{font-size:13px;margin:0 0 2px}.info h3{font-size:11px;margin:0 0 5px;color:#555}.info p{font-size:8.5px;line-height:1.35;margin:2px 0}' +
      '.screen-note{margin:0 0 8mm;padding:10px;background:#fff7dc;border:1px solid #d5a526;border-radius:8px;font-size:12px}.screen-note button{margin-left:8px;padding:7px 10px}' +
      '@media print{.screen-note{display:none}}' +
      '</style></head><body>' +
      '<div class="screen-note">Dans la fenêtre d’impression, choisis <b>Enregistrer au format PDF</b>.<button onclick="window.print()">Imprimer / PDF</button></div>' +
      '<header><h1>Vinylothèque</h1><div class="sub">' + rows.length + ' vinyle' + (rows.length>1?'s':'') + ' · Catalogue du ' + date + '</div>' +
      (summary.length ? '<div class="summary">' + summary.map(esc).join(' · ') + '</div>' : '') + '</header>' +
      '<main class="grid">' + cards + '</main>' +
      '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),900));<\/script>' +
      '</body></html>';

    win.document.open();
    win.document.write(doc);
    win.document.close();
  }

  function apply(){
    populateAdvanced();
    renderBrowser();
    filterCards();
  }

  const css = document.createElement("style");
  css.textContent = `
    .advanced-wrap{margin:-12px 0 20px}
    .advanced-toggle-row{display:flex;align-items:center;gap:9px}
    .advanced-count{font-size:.76rem;font-weight:800;background:#fff7dc;border:1px solid #d5a526;padding:5px 8px;border-radius:999px}
    .advanced-panel{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr)) auto;gap:8px;margin-top:10px;padding:12px;background:rgba(255,255,255,.55);border:1px solid var(--line);border-radius:16px}
    .advanced-panel select{width:100%;font:inherit;background:#fff;color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:10px 11px}
    .style-browser{margin:6px 0 24px}
    .style-browser-head{display:flex;justify-content:space-between;align-items:end;gap:14px;margin-bottom:12px}
    .style-browser-head h3{margin:0;font-size:1.3rem;letter-spacing:-.03em}
    .style-browser-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
    .style-card{border:1px solid var(--line);background:var(--card);border-radius:18px;padding:10px;text-align:left;cursor:pointer;transition:.15s}
    .style-card:active{transform:scale(.985)}
    .style-card.active{outline:2px solid #d5a526;box-shadow:0 0 0 4px rgba(213,165,38,.13)}
    .style-card-thumbs{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:9px}
    .style-card-thumbs img,.style-thumb{width:100%;aspect-ratio:1;object-fit:cover;border-radius:9px;background:#ded8cd}
    .placeholder-thumb{background:linear-gradient(135deg,#ece7dd,#d8d0c2)}
    .style-card-meta{display:flex;flex-direction:column;gap:2px}
    .style-card-meta strong{font-size:.94rem;line-height:1.2}
    .style-card-meta span{font-size:.75rem;color:var(--muted)}
    .taxonomy-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}
    .taxonomy-tag{display:inline-flex;border-radius:999px;padding:4px 7px;font-size:.68rem;font-weight:800;background:var(--soft)}
    .taxonomy-tag.style{border:1px solid #d5a526;background:#fff7dc}
    .location-line{font-size:.76rem;color:var(--muted);margin-top:9px}
    .artist-link{cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}
    .artist-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
    .artist-stats strong,.artist-stats span{display:block}
    .artist-stats strong{font-size:1.05rem}.artist-stats span{font-size:.72rem;color:var(--muted)}
    .artist-records{display:grid;gap:9px}
    .artist-record{display:grid;grid-template-columns:64px 1fr auto;gap:10px;align-items:center;padding:9px;background:#fff;border:1px solid var(--line);border-radius:14px}
    .artist-record img,.artist-record-placeholder{width:64px;height:64px;object-fit:cover;border-radius:9px;background:#ded8cd}
    .artist-record h3{font-size:.95rem;margin:0 0 3px}.artist-record p{font-size:.76rem;color:var(--muted);margin:2px 0}
    @media(max-width:980px){.advanced-panel{grid-template-columns:1fr 1fr 1fr}}
    @media(max-width:760px){
      .toolbar{grid-template-columns:1fr}
      .advanced-panel{grid-template-columns:1fr 1fr}
      .style-browser-head{align-items:flex-start}
      .style-browser-grid{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(155px,68vw);grid-template-columns:none;overflow-x:auto;padding:2px 2px 10px;scroll-snap-type:x proximity}
      .style-card{scroll-snap-align:start}
      .artist-stats{grid-template-columns:1fr 1fr}
      .artist-record{grid-template-columns:56px 1fr}.artist-record img,.artist-record-placeholder{width:56px;height:56px}.artist-record .btn{grid-column:1/-1}
    }
    @media(max-width:430px){.advanced-panel{grid-template-columns:1fr}}
  `;
  document.head.appendChild(css);

  const changed = migrateLegacyTaxonomy();
  ensureAdvancedUI();
  ensureArtistDialog();

  const collectionEl = document.querySelector("#collection");
  if (collectionEl) {
    let timer;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(apply, 0);
    }).observe(collectionEl, {childList:true});

    collectionEl.addEventListener("click", e => {
      const artist = e.target.closest(".artist-link");
      if (artist) openArtist(artist.dataset.artist || artist.textContent.trim());
    });
    collectionEl.addEventListener("keydown", e => {
      const artist = e.target.closest(".artist-link");
      if (artist && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        openArtist(artist.dataset.artist || artist.textContent.trim());
      }
    });
  }

  document.querySelector("#filterGenre")?.addEventListener("change", () => setTimeout(apply,0));
  document.querySelector("#filterText")?.addEventListener("input", () => setTimeout(apply,0));
  document.querySelector("#sortBy")?.addEventListener("change", () => setTimeout(apply,0));
  document.querySelector("#exportPdfBtn")?.addEventListener("click", exportPdfCatalogue);

  if (changed && typeof render === "function") render();
  setTimeout(apply,0);
})();