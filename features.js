(() => {
  const splitTax = v => String(v || "").split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  const norm = v => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let lastDiscogsTaxonomy = null;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = String(args[0] || "");
    if (/api\.discogs\.com\/releases\/\d+/.test(url) && response.ok) {
      response.clone().json().then(d => {
        lastDiscogsTaxonomy = {
          id: String(d.id || ""),
          genres: d.genres || [],
          styles: d.styles || [],
          at: Date.now()
        };
      }).catch(() => {});
    }
    return response;
  };

  const toolbar = document.querySelector('.toolbar');
  const sortBy = document.querySelector('#sortBy');
  if (toolbar && sortBy) {
    const genre = document.createElement('select');
    genre.id = 'filterGenre';
    genre.setAttribute('aria-label', 'Filtrer par genre');
    genre.innerHTML = '<option value="">Tous les genres</option>';

    const style = document.createElement('select');
    style.id = 'filterStyle';
    style.setAttribute('aria-label', 'Filtrer par style');
    style.innerHTML = '<option value="">Tous les styles</option>';

    toolbar.insertBefore(genre, sortBy);
    toolbar.insertBefore(style, sortBy);

    const genreOption = document.createElement('option');
    genreOption.value = 'genre-asc';
    genreOption.textContent = 'Genre A → Z';
    sortBy.insertBefore(genreOption, sortBy.querySelector('[value="year-desc"]'));

    const styleOption = document.createElement('option');
    styleOption.value = 'style-asc';
    styleOption.textContent = 'Style A → Z';
    sortBy.insertBefore(styleOption, sortBy.querySelector('[value="year-desc"]'));
  }

  const formGrid = document.querySelector('#recordForm .form-grid');
  const genreInput = document.querySelector('#genre');
  if (formGrid && genreInput && !document.querySelector('#style')) {
    const oldLabel = genreInput.closest('label');
    oldLabel.childNodes[0].nodeValue = 'Genre';
    genreInput.placeholder = 'Rock, Jazz, Reggae…';

    const styleLabel = document.createElement('label');
    styleLabel.innerHTML = 'Style<input id="style" placeholder="Hard Rock, New Wave, Synth-pop…">';
    oldLabel.insertAdjacentElement('afterend', styleLabel);
  }

  const styleEl = () => document.querySelector('#style');
  const genreFilter = () => document.querySelector('#filterGenre');
  const styleFilter = () => document.querySelector('#filterStyle');

  function allValues(key) {
    return [...new Set(collection.flatMap(r => splitTax(r[key])))].sort((a,b) => a.localeCompare(b, 'fr'));
  }

  function refillFilters() {
    const g = genreFilter(), s = styleFilter();
    if (!g || !s) return;
    const gv = g.value, sv = s.value;
    g.innerHTML = '<option value="">Tous les genres</option>' + allValues('genre').map(v => '<option>'+esc(v)+'</option>').join('');
    s.innerHTML = '<option value="">Tous les styles</option>' + allValues('style').map(v => '<option>'+esc(v)+'</option>').join('');
    if ([...g.options].some(o => o.value === gv)) g.value = gv;
    if ([...s.options].some(o => o.value === sv)) s.value = sv;
  }

  function addTags(card, record) {
    card.querySelector('.taxonomy-tags')?.remove();
    const vals = [
      ...splitTax(record.genre).map(v => [v, 'genre']),
      ...splitTax(record.style).map(v => [v, 'style'])
    ];
    if (!vals.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'taxonomy-tags';
    wrap.innerHTML = vals.map(([v,k]) => '<span class="taxonomy-tag '+k+'">'+esc(v)+'</span>').join('');
    card.querySelector('.card-actions')?.before(wrap);
  }

  function applyTaxonomy() {
    refillFilters();
    const wantedGenre = genreFilter()?.value || '';
    const wantedStyle = styleFilter()?.value || '';
    const sort = document.querySelector('#sortBy')?.value || '';
    const container = document.querySelector('#collection');
    if (!container) return;

    const cards = [...container.querySelectorAll('.record-card')];
    const visible = [];
    for (const card of cards) {
      const id = card.querySelector('[data-edit]')?.dataset.edit;
      const r = collection.find(x => x.id === id);
      if (!r) continue;
      addTags(card, r);
      const genreOk = !wantedGenre || splitTax(r.genre).some(v => norm(v) === norm(wantedGenre));
      const styleOk = !wantedStyle || splitTax(r.style).some(v => norm(v) === norm(wantedStyle));
      card.hidden = !(genreOk && styleOk);
      if (!card.hidden) visible.push(card);
    }

    if (sort === 'genre-asc' || sort === 'style-asc') {
      const key = sort.startsWith('genre') ? 'genre' : 'style';
      visible.sort((a,b) => {
        const ra = collection.find(x => x.id === a.querySelector('[data-edit]')?.dataset.edit);
        const rb = collection.find(x => x.id === b.querySelector('[data-edit]')?.dataset.edit);
        return String(splitTax(ra?.[key])[0] || '').localeCompare(String(splitTax(rb?.[key])[0] || ''), 'fr');
      }).forEach(card => container.appendChild(card));
    }
    container.hidden = visible.length === 0;
  }

  const dialog = document.querySelector('#recordDialog');
  if (dialog) {
    new MutationObserver(() => {
      if (!dialog.open) return;
      setTimeout(() => {
        const id = document.querySelector('#recordId')?.value || '';
        const discogsId = document.querySelector('#discogsId')?.value || '';
        const style = styleEl();
        if (!style) return;
        if (lastDiscogsTaxonomy && discogsId === lastDiscogsTaxonomy.id && Date.now() - lastDiscogsTaxonomy.at < 10000) {
          document.querySelector('#genre').value = lastDiscogsTaxonomy.genres.join(', ');
          style.value = lastDiscogsTaxonomy.styles.join(', ');
        } else if (id) {
          style.value = collection.find(r => r.id === id)?.style || '';
        } else {
          style.value = '';
        }
      }, 0);
    }).observe(dialog, {attributes:true, attributeFilter:['open']});
  }

  document.querySelector('#recordForm')?.addEventListener('submit', () => {
    const style = styleEl()?.value.trim() || '';
    setTimeout(() => {
      const id = document.querySelector('#recordId')?.value || '';
      let record = id ? collection.find(r => r.id === id) : collection.at(-1);
      if (!record) return;
      record.style = style;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collection));
      render();
      applyTaxonomy();
    }, 0);
  });

  genreFilter()?.addEventListener('change', applyTaxonomy);
  styleFilter()?.addEventListener('change', applyTaxonomy);
  ['filterText','filterFormat','sortBy'].forEach(id => document.querySelector('#'+id)?.addEventListener('change', () => setTimeout(applyTaxonomy,0)));
  document.querySelector('#filterText')?.addEventListener('input', () => setTimeout(applyTaxonomy,0));
  document.querySelector('#collection')?.addEventListener('click', () => setTimeout(applyTaxonomy,0));

  const style = document.createElement('style');
  style.textContent = `
    .toolbar{grid-template-columns:minmax(220px,1.5fr) repeat(4,minmax(145px,1fr))}
    .taxonomy-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
    .taxonomy-tag{display:inline-flex;align-items:center;border-radius:999px;padding:5px 8px;font-size:.7rem;font-weight:800;background:var(--soft);color:var(--ink)}
    .taxonomy-tag.style{border:1px solid #d5a526;background:#fff7dc}
    @media(max-width:760px){.toolbar{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  refillFilters();
  applyTaxonomy();
})();