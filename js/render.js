/**
 * Render — Cards, modale, pagination.
 */
const Render = (() => {
  const PAGE_SIZE = 20;
  let currentPage = 1;
  let currentResults = [];
  let allCompaniesMap = {};

  function setCompaniesMap(companies) {
    allCompaniesMap = {};
    for (const c of companies) {
      allCompaniesMap[c.id] = c;
    }
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function urgencyClass(u) {
    return `badge--urgency-${u || 'lointain'}`;
  }

  function urgencyLabel(u) {
    const labels = {
      'imminent': '⚡ Imminent',
      'proche': '📅 Proche',
      'planifie': '📋 Planifié',
      'lointain': '🔮 Lointain',
      'inconnu': '? Inconnu',
      'passe': '⏰ Passé'
    };
    return labels[u] || u;
  }

  function buildLinkedInUrl(nom) {
    // "Relations sociales" ajouté systématiquement aux mots-clés (09/06/2026).
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(nom + ' Relations sociales')}&origin=SWITCH_SEARCH_VERTICAL`;
  }

  function renderCard(company) {
    const c = company;
    const inCart = Cart.has(c.id);

    const badges = c.elections.map(e =>
      `<span class="badge badge--institution">${e.type}</span>`
    ).join('');

    const syndicatTags = (c.syndicats || []).slice(0, 4).map(s =>
      `<span class="syndicat-tag">${escapeHtml(s)}</span>`
    ).join('');
    const moreTag = (c.syndicats || []).length > 4
      ? `<span class="syndicat-tag">+${c.syndicats.length - 4}</span>` : '';

    return `
      <div class="card card--${c.urgency || 'lointain'}${inCart ? ' card--selected' : ''}" data-id="${c.id}">
        <button class="card__select" data-cart-id="${c.id}" title="Ajouter au panier">${inCart ? '✓' : '+'}</button>
        <div class="card__top">
          <div class="card__name-row">
            <span class="card__name">${escapeHtml(c.nom)}</span>
            <a class="card__linkedin" href="${buildLinkedInUrl(c.nom)}" target="_blank" rel="noopener" title="Rechercher sur LinkedIn">in</a>
          </div>
          <div class="card__badges">
            ${badges}
            <span class="badge ${urgencyClass(c.urgency)}">${urgencyLabel(c.urgency)}</span>
          </div>
        </div>
        <div class="card__info">
          <span>📍 ${escapeHtml(c.ville)} (${c.dep})</span>
          <span title="${c.effEstime ? 'Effectif estimé d’après le nombre d’inscrits (non publié sur le cycle 2021-2024)' : ''}">👥 ${c.effEstime ? '~' : ''}${c.effectif.toLocaleString('fr-FR')} ${c.effEstime ? 'inscrits' : 'sal.'}</span>
          <span>🏢 NAF ${c.naf}</span>
        </div>
        <div class="card__election">
          <span class="card__election-label">Prochaine :</span>
          <span class="card__election-date">${formatDate(c.nextElection)}</span>
        </div>
        ${syndicatTags || moreTag ? `<div class="card__syndicats">${syndicatTags}${moreTag}</div>` : ''}
      </div>
    `;
  }

  function renderResults(results, page) {
    currentResults = results;
    currentPage = page || 1;

    const grid = document.getElementById('results-grid');
    const empty = document.getElementById('empty-state');
    const countEl = document.getElementById('results-count');
    const total = results.length;

    countEl.innerHTML = `<strong>${total.toLocaleString('fr-FR')}</strong> entreprise${total !== 1 ? 's' : ''}`;

    if (total === 0) {
      grid.innerHTML = '';
      empty.style.display = '';
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    empty.style.display = 'none';
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = results.slice(start, start + PAGE_SIZE);

    grid.innerHTML = pageItems.map(renderCard).join('');

    // Attach click handlers
    grid.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card__select') || e.target.closest('.card__linkedin')) return;
        const id = parseInt(card.dataset.id);
        openModal(allCompaniesMap[id]);
      });
    });

    // Cart checkbox handlers
    grid.querySelectorAll('.card__select').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.cartId);
        const wasInCart = Cart.has(id);
        Cart.toggle(id);
        const card = btn.closest('.card');
        card.classList.toggle('card--selected', Cart.has(id));
        btn.textContent = Cart.has(id) ? '✓' : '+';

        // Coin animation on add
        if (!wasInCart) {
          spawnCoin(btn);
        }
      });
    });

    // LinkedIn link stopPropagation
    grid.querySelectorAll('.card__linkedin').forEach(link => {
      link.addEventListener('click', (e) => e.stopPropagation());
    });

    renderPagination(total);
  }

  function renderPagination(total) {
    const container = document.getElementById('pagination');
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    let html = '';
    html += `<button class="pagination__btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>◀ Préc.</button>`;

    let startP = Math.max(1, currentPage - 3);
    let endP = Math.min(totalPages, startP + 6);
    if (endP - startP < 6) startP = Math.max(1, endP - 6);

    if (startP > 1) html += `<button class="pagination__btn" data-page="1">1</button>`;
    if (startP > 2) html += `<span class="pagination__dots">...</span>`;

    for (let i = startP; i <= endP; i++) {
      html += `<button class="pagination__btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endP < totalPages - 1) html += `<span class="pagination__dots">...</span>`;
    if (endP < totalPages) html += `<button class="pagination__btn" data-page="${totalPages}">${totalPages}</button>`;

    html += `<button class="pagination__btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Suiv. ▶</button>`;

    container.innerHTML = html;
    container.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page);
        if (p >= 1 && p <= totalPages) {
          renderResults(currentResults, p);
          document.getElementById('results-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  function openModal(company) {
    if (!company) return;
    const c = company;
    const content = document.getElementById('modal-content');

    const electionsRows = c.elections.map(e => {
      const participation = e.inscrits > 0 ? Math.round(e.votants / e.inscrits * 100) : 0;
      return `
        <tr>
          <td><span class="badge badge--institution">${e.type}</span></td>
          <td>${formatDate(e.date)}</td>
          <td><strong>${formatDate(e.next)}</strong></td>
          <td>${e.duree} ans</td>
          <td>${e.inscrits.toLocaleString('fr-FR')}</td>
          <td>${e.votants.toLocaleString('fr-FR')} (${participation}%)</td>
          <td>${e.elus}</td>
          <td>${(e.syndicats || []).join(', ') || '—'}</td>
        </tr>
      `;
    }).join('');

    content.innerHTML = `
      <div class="modal__header">
        <h2 class="modal__title">${escapeHtml(c.nom)}</h2>
        <div class="modal__siret">SIRET ${c.siret} · IDCC ${c.idcc || '—'} · NAF ${c.naf}</div>
        <a class="modal__linkedin" href="${buildLinkedInUrl(c.nom)}" target="_blank" rel="noopener">Rechercher sur LinkedIn →</a>
      </div>
      <div class="modal__body">
        <div class="modal__section">
          <h3 class="modal__section-title">Informations</h3>
          <div class="modal__grid">
            <div class="modal__field">
              <div class="modal__field-label">Adresse</div>
              <div class="modal__field-value">${escapeHtml(c.adr)}</div>
            </div>
            <div class="modal__field">
              <div class="modal__field-label">Ville</div>
              <div class="modal__field-value">${c.cp} ${escapeHtml(c.ville)}</div>
            </div>
            <div class="modal__field">
              <div class="modal__field-label">Département</div>
              <div class="modal__field-value">${c.dep}</div>
            </div>
            <div class="modal__field">
              <div class="modal__field-label">${c.effEstime ? 'Effectif estimé' : 'Effectif'}</div>
              <div class="modal__field-value" title="${c.effEstime ? 'Estimé d’après le nombre d’inscrits — l’effectif n’est plus publié sur le cycle 2021-2024' : ''}">${c.effEstime ? '~' : ''}${c.effectif.toLocaleString('fr-FR')} ${c.effEstime ? 'inscrits' : 'salarié' + (c.effectif > 1 ? 's' : '')}</div>
            </div>
          </div>
        </div>

        <div class="modal__section">
          <h3 class="modal__section-title">Historique élections</h3>
          <div style="overflow-x:auto">
            <table class="election-table">
              <thead>
                <tr>
                  <th>Inst.</th>
                  <th>Scrutin</th>
                  <th>Prochaine</th>
                  <th>Mandat</th>
                  <th>Inscrits</th>
                  <th>Votants</th>
                  <th>Élus</th>
                  <th>Syndicats</th>
                </tr>
              </thead>
              <tbody>${electionsRows}</tbody>
            </table>
          </div>
        </div>

        ${c.syndicats && c.syndicats.length > 0 ? `
        <div class="modal__section">
          <h3 class="modal__section-title">Syndicats présents</h3>
          <div class="card__syndicats">
            ${c.syndicats.map(s => `<span class="syndicat-tag">${escapeHtml(s)}</span>`).join('')}
          </div>
        </div>
        ` : ''}
      </div>
    `;

    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function initModal() {
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  function spawnCoin(originEl) {
    const rect = originEl.getBoundingClientRect();
    const startX = rect.left + rect.width / 2 - 12;
    const startY = rect.top;

    // Direction vers le bas (la barre panier est en bas)
    const targetY = window.innerHeight - 40;
    const dx = (Math.random() - 0.5) * 60; // légère dispersion horizontale
    const dy = targetY - startY;

    const coin = document.createElement('div');
    coin.className = 'coin-anim';
    coin.style.left = startX + 'px';
    coin.style.top = startY + 'px';
    coin.style.setProperty('--coin-dx', dx + 'px');
    coin.style.setProperty('--coin-dy', dy + 'px');
    coin.innerHTML = '<span class="coin-anim__inner"></span>';
    document.body.appendChild(coin);

    // Sparkles autour du bouton
    const sparkles = ['✦', '✧', '⭐'];
    for (let i = 0; i < 3; i++) {
      const sp = document.createElement('div');
      sp.className = 'coin-sparkle';
      sp.textContent = sparkles[i % sparkles.length];
      sp.style.left = (startX + (Math.random() - 0.5) * 40) + 'px';
      sp.style.top = (startY + (Math.random() - 0.5) * 30) + 'px';
      sp.style.animationDelay = (i * 0.08) + 's';
      document.body.appendChild(sp);
      sp.addEventListener('animationend', () => sp.remove());
    }

    // "+1" qui pop sur la card
    const card = originEl.closest('.card');
    if (card) {
      const pop = document.createElement('div');
      pop.className = 'plus-one-anim';
      pop.textContent = '+1';
      card.appendChild(pop);
      pop.addEventListener('animationend', () => pop.remove());
    }

    // Bounce la barre panier
    const cartBar = document.getElementById('cart-bar');
    if (cartBar) {
      cartBar.classList.remove('cart-bar--bounce');
      void cartBar.offsetWidth;
      cartBar.classList.add('cart-bar--bounce');
    }

    coin.addEventListener('animationend', () => coin.remove());
  }

  function getPageIds() {
    const start = (currentPage - 1) * PAGE_SIZE;
    return currentResults.slice(start, start + PAGE_SIZE).map(c => c.id);
  }

  function getAllResultIds() {
    return currentResults.map(c => c.id);
  }

  function refreshCartUI() {
    document.querySelectorAll('.card').forEach(card => {
      const id = parseInt(card.dataset.id);
      const inCart = Cart.has(id);
      card.classList.toggle('card--selected', inCart);
      const btn = card.querySelector('.card__select');
      if (btn) btn.textContent = inCart ? '✓' : '+';
    });
  }

  return { setCompaniesMap, renderResults, initModal, closeModal, getPageIds, getAllResultIds, refreshCartUI };
})();
