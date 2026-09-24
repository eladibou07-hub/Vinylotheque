(() => {
  const splitTax = v => String(v || "").split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  const norm = v => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const uniq = arr => [...new Map(arr.map(v => [norm(v), v])).values()];
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

  function ensureBrowser(){
    const toolbar = document.querySelector(".toolbar");
    if (!toolbar) return null;
    let section = document.querySelector("#styleBrowser");
    if (!section) {
      section = document.createElement("section");
      section.id = "styleBrowser";
      section.className = "style-browser";
      section.innerHTML = `
        <div class="style-browser-head">
          <div>
            <p class="eyebrow">EXPLORER</p>
            <h3>Par style</h3>
          </div>
          <button type="button" id="clearStyleFilter" class="btn secondary">Tous les styles</button>
        </div>
        <div id="styleBrowserGrid" class="style-browser-grid"></div>`;
      toolbar.insertAdjacentElement("afterend", section);
      section.querySelector("#clearStyleFilter").addEventListener("click", () => {
        activeStyle = "";
        apply();
      });
    }
    return section;
  }

  function browserSource(){
    const selectedGenre = document.querySelector("#filterGenre")?.value || "";
    return collection.filter(r => !selectedGenre || splitTax(r.genre).some(g => norm(g) === norm(selectedGenre)));
  }

  function styleGroups(){
    const map = new Map();
    browserSource().forEach(record => {
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
          ? `<img src="${esc(src)}" alt="${esc(r.title || group.name)}" loading="lazy">`
          : '<div class="style-thumb placeholder-thumb"></div>';
      }).join("");
      return `
        <button type="button" class="style-card ${norm(activeStyle)===norm(group.name)?"active":""}" data-style="${esc(group.name)}">
          <div class="style-card-thumbs">${covers}</div>
          <div class="style-card-meta">
            <strong>${esc(group.name)}</strong>
            <span>${group.records.length} vinyle${group.records.length>1?"s":""}</span>
          </div>
        </button>`;
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
    if (!items.length) return;
    const wrap = document.createElement("div");
    wrap.className = "taxonomy-tags";
    wrap.innerHTML = items.map(([v,k]) => `<span class="taxonomy-tag ${k}">${esc(v)}</span>`).join("");
    card.querySelector(".card-actions")?.before(wrap);
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
      const ok = !activeStyle || splitTax(record.style).some(s => norm(s) === norm(activeStyle));
      card.hidden = !ok;
      if (ok) visible++;
    });
    container.hidden = visible === 0;
  }

  function apply(){
    renderBrowser();
    filterCards();
  }

  const css = document.createElement("style");
  css.textContent = `
    .toolbar{grid-template-columns:minmax(240px,1.8fr) minmax(160px,1fr) minmax(160px,1fr)}
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
    @media(max-width:760px){
      .toolbar{grid-template-columns:1fr}
      .style-browser-head{align-items:flex-start}
      .style-browser-grid{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(155px,68vw);grid-template-columns:none;overflow-x:auto;padding:2px 2px 10px;scroll-snap-type:x proximity}
      .style-card{scroll-snap-align:start}
    }`;
  document.head.appendChild(css);

  const changed = migrateLegacyTaxonomy();
  const collectionEl = document.querySelector("#collection");
  if (collectionEl) {
    let timer;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(apply, 0);
    }).observe(collectionEl, {childList:true});
  }

  document.querySelector("#filterGenre")?.addEventListener("change", () => setTimeout(apply,0));
  document.querySelector("#filterText")?.addEventListener("input", () => setTimeout(apply,0));

  if (changed && typeof render === "function") render();
  setTimeout(apply,0);
})();