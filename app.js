/**
 * PARAGON VOTE SEARCH — App principale
 */
(async function() {
  'use strict';

  let allCompanies = [];
  let filteredResults = [];
  let currentSort = 'nextElection';
  let chartBinFilter = null;

  const loadingEl = document.getElementById('loading');
  const loadingBar = document.getElementById('loading-bar');
  const searchInput = document.getElementById('search-input');

  // ── Chargement ──────────────────────────────────────────────────
  try {
    const data = await DataLoader.loadAll(pct => {
      loadingBar.style.width = pct + '%';
    });

    allCompanies = data.companies;
    Render.setCompaniesMap(allCompanies);
    SearchEngine.init(data.searchDocs);
    Filters.init(data.facets, applyAndRender);

    // Banner imminent (compter imminent + proche pour cohérence avec le filtre)
    const imminentCount = allCompanies.filter(c => c.urgency === 'imminent' || c.urgency === 'proche').length;
    if (imminentCount > 0) {
      document.getElementById('imminent-banner').style.display = '';
      document.getElementById('imminent-count').textContent =
        imminentCount.toLocaleString('fr-FR');
    }

    loadingEl.style.display = 'none';

    // Rendu initial
    applyAndRender();

  } catch (err) {
    loadingEl.innerHTML = `
      <div class="empty-state__icon">⚠️</div>
      <div style="font-family:var(--font-pixel);font-size:0.55rem;color:var(--coral);letter-spacing:2px;margin:1rem 0">
        ERREUR DE CHARGEMENT
      </div>
      <p style="color:var(--text-dim)">${err.message}</p>
    `;
    console.error('Erreur chargement:', err);
    return;
  }

  // ── Recherche (debounce) ────────────────────────────────────────
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    chartBinFilter = null;
    Chart.clearActiveBin();
    debounceTimer = setTimeout(applyAndRender, 300);
  });

  // ── Tri ─────────────────────────────────────────────────────────
  document.getElementById('sort-select').addEventListener('change', (e) => {
    currentSort = e.target.value;
    applyAndRender();
  });

  // ── Bouton "Voir les urgentes" ──────────────────────────────────
  document.getElementById('btn-show-imminent').addEventListener('click', () => {
    searchInput.value = '';
    Filters.resetAll();
    Filters.setUrgence(['imminent', 'proche']);
  });

  // ── Modale ──────────────────────────────────────────────────────
  Render.initModal();

  // ── Panier ─────────────────────────────────────────────────────
  const cartBar = document.getElementById('cart-bar');
  const cartBarText = document.getElementById('cart-bar-text');
  const selectionCounter = document.getElementById('selection-counter');

  document.addEventListener('cart-updated', (e) => {
    const count = e.detail.count;
    cartBarText.textContent = `${count} entreprise${count > 1 ? 's' : ''} sélectionnée${count > 1 ? 's' : ''}`;
    selectionCounter.textContent = `${count} sélectionnée${count > 1 ? 's' : ''}`;
    cartBar.style.display = count > 0 ? '' : 'none';
    Render.refreshCartUI();
  });

  document.getElementById('btn-select-page').addEventListener('click', () => {
    Cart.addArray(Render.getPageIds());
  });

  document.getElementById('btn-select-all').addEventListener('click', () => {
    Cart.addArray(Render.getAllResultIds());
  });

  document.getElementById('btn-clear-selection').addEventListener('click', () => {
    Cart.clear();
  });

  document.getElementById('btn-cart-clear').addEventListener('click', () => {
    Cart.clear();
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    exportCSV();
  });

  function buildLinkedInUrl(nom) {
    // Phrase exacte "Relations sociales" (guillemets) ajoutée aux mots-clés (09/06/2026).
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(nom + ' "Relations sociales"')}&origin=SWITCH_SEARCH_VERTICAL`;
  }

  function exportCSV() {
    const ids = Cart.getIds();
    if (ids.length === 0) return;

    const idSet = new Set(ids);
    const rows = allCompanies.filter(c => idSet.has(c.id));

    const header = 'Nom;SIRET;Adresse;CP;Ville;Département;Code NAF;Effectif;IDCC;Prochaine élection;Urgence;Syndicats;Lien LinkedIn';
    const csvRows = rows.map(c => {
      const fields = [
        c.nom,
        c.siret,
        c.adr,
        c.cp,
        c.ville,
        c.dep,
        c.naf,
        c.effectif,
        c.idcc || '',
        c.nextElection || '',
        c.urgency || '',
        (c.syndicats || []).join(', '),
        buildLinkedInUrl(c.nom)
      ];
      return fields.map(f => `"${String(f).replace(/"/g, '""')}"`).join(';');
    });

    const csv = '\uFEFF' + header + '\n' + csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `paragon-export-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Chart clic sur barre ────────────────────────────────────────
  document.addEventListener('chart-bin-click', (e) => {
    chartBinFilter = e.detail;
    applyAndRender();
  });

  // ── Logique principale ──────────────────────────────────────────
  function applyAndRender() {
    const query = searchInput.value.trim();
    const searchIds = SearchEngine.search(query);

    let results;
    if (searchIds !== null) {
      results = allCompanies.filter(c => searchIds.has(c.id));
    } else {
      results = allCompanies;
    }

    results = Filters.apply(results);

    // Le chart se base sur les résultats filtrés AVANT le filtre de bin
    const chartResults = results;

    // Filtre par bin du chart si actif
    if (chartBinFilter) {
      const filterState = Filters.getState();
      const filterTypes = filterState.institution;
      results = results.filter(c =>
        c.elections.some(e => {
          if (!e.next) return false;
          if (filterTypes && filterTypes.size > 0 && !filterTypes.has(e.type)) return false;
          return e.next >= chartBinFilter.start && e.next < chartBinFilter.end;
        })
      );
    }

    results = sortResults(results, currentSort);

    filteredResults = results;
    document.getElementById('select-all-count').textContent = results.length.toLocaleString('fr-FR');
    Render.renderResults(results, 1);
    Chart.render(chartResults);
  }

  function sortResults(results, sort) {
    const sorted = [...results];
    switch (sort) {
      case 'nextElection':
        sorted.sort((a, b) => {
          const da = a.nextElection || '9999';
          const db = b.nextElection || '9999';
          return da.localeCompare(db);
        });
        break;
      case 'effectif':
        sorted.sort((a, b) => (b.effectif || 0) - (a.effectif || 0));
        break;
      case 'nom':
        sorted.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));
        break;
    }
    return sorted;
  }

})();
