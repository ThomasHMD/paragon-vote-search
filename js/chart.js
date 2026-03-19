/**
 * Chart — Barres empilées des élections sur 12 mois glissants (par période de 2 mois).
 */
const Chart = (() => {
  const NUM_BINS = 12; // 12 mois glissants

  // Palette par type d'institution
  const TYPE_COLORS = {
    'CSE':  { bg: 'var(--neon-blue)', label: '#fff' },
    'DP':   { bg: 'var(--coral)', label: '#fff' },
    'CE':   { bg: 'var(--yellow)', label: 'var(--text)' },
    'CHSCT':{ bg: 'var(--lime)', label: '#fff' },
    'DUP':  { bg: 'var(--purple)', label: '#fff' },
  };
  const DEFAULT_COLOR = { bg: 'var(--navy)', label: '#fff' };

  function getColor(type) {
    return TYPE_COLORS[type] || DEFAULT_COLOR;
  }

  /**
   * Calcule les bins de 2 mois à partir d'aujourd'hui.
   * Retourne [{ label, start, end }, ...]
   */
  function buildBins() {
    const bins = [];
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

    for (let i = 0; i < NUM_BINS; i++) {
      const m = new Date(startMonth);
      m.setMonth(m.getMonth() + i);
      const end = new Date(startMonth);
      end.setMonth(end.getMonth() + i + 1);

      const label = `${monthNames[m.getMonth()]} ${String(m.getFullYear()).slice(2)}`;
      const startISO = m.toISOString().slice(0, 10);
      const endISO = end.toISOString().slice(0, 10);

      bins.push({ label, start: startISO, end: endISO });
    }
    return bins;
  }

  /**
   * Compte les élections par bin et par type.
   * @param {Array} companies — liste filtrée d'entreprises
   * @param {Set|null} filterTypes — types d'institution à afficher (null = tous)
   * @returns {{ bins, typesFound, data, maxTotal }}
   */
  function computeData(companies, filterTypes) {
    const bins = buildBins();
    const typesFound = new Set();

    // data[binIndex] = { type: count, ... }
    const data = bins.map(() => ({}));

    for (const c of companies) {
      for (const e of c.elections) {
        if (!e.next) continue;
        const t = e.type || 'Autre';
        // Si filtre institution actif, ne compter que les types sélectionnés
        if (filterTypes && filterTypes.size > 0 && !filterTypes.has(t)) continue;
        for (let bi = 0; bi < bins.length; bi++) {
          if (e.next >= bins[bi].start && e.next < bins[bi].end) {
            typesFound.add(t);
            data[bi][t] = (data[bi][t] || 0) + 1;
            break;
          }
        }
      }
    }

    let maxTotal = 0;
    for (const d of data) {
      const total = Object.values(d).reduce((a, b) => a + b, 0);
      if (total > maxTotal) maxTotal = total;
    }

    // Trier les types par fréquence globale décroissante
    const typeCount = {};
    for (const d of data) {
      for (const [t, n] of Object.entries(d)) {
        typeCount[t] = (typeCount[t] || 0) + n;
      }
    }
    const sortedTypes = [...typesFound].sort((a, b) => (typeCount[b] || 0) - (typeCount[a] || 0));

    return { bins, types: sortedTypes, data, maxTotal };
  }

  /**
   * Rend le graphique dans le container.
   */
  function render(companies) {
    const container = document.getElementById('chart-container');
    if (!container) return;

    // Récupérer le filtre institution actif
    const filterState = Filters.getState();
    const filterTypes = filterState.institution;

    const { bins, types, data, maxTotal } = computeData(companies, filterTypes);

    // Rien à afficher ?
    if (maxTotal === 0) {
      container.innerHTML = '<div class="chart__empty">Aucune élection dans les 12 prochains mois pour cette sélection</div>';
      return;
    }

    // Graduations Y (4 niveaux)
    const ySteps = 4;
    const yMax = Math.ceil(maxTotal / ySteps) * ySteps || ySteps;
    const yLabels = [];
    for (let i = ySteps; i >= 0; i--) {
      yLabels.push(Math.round(yMax / ySteps * i));
    }

    let html = '';

    // Légende
    html += '<div class="chart__legend">';
    for (const t of types) {
      const col = getColor(t);
      html += `<span class="chart__legend-item"><span class="chart__legend-dot" style="background:${col.bg}"></span>${t}</span>`;
    }
    html += '</div>';

    // Zone graphique
    html += '<div class="chart__area">';

    // Y-axis
    html += '<div class="chart__yaxis">';
    for (const v of yLabels) {
      html += `<span class="chart__yaxis-label">${v.toLocaleString('fr-FR')}</span>`;
    }
    html += '</div>';

    // Barres
    html += '<div class="chart__bars">';

    // Grid lines
    for (let i = 0; i <= ySteps; i++) {
      const pct = (i / ySteps) * 100;
      html += `<div class="chart__gridline" style="bottom:${pct}%"></div>`;
    }

    for (let bi = 0; bi < bins.length; bi++) {
      const bin = bins[bi];
      const d = data[bi];
      const total = Object.values(d).reduce((a, b) => a + b, 0);

      const clickable = total > 0 ? 'chart__bar-col--clickable' : '';
      html += `<div class="chart__bar-col ${clickable}" data-bin="${bi}">`;
      html += `<div class="chart__bar-stack" style="height:100%">`;

      // Segments empilés (du bas vers le haut)
      for (const t of [...types].reverse()) {
        if (!d[t]) continue;
        const pct = (d[t] / yMax) * 100;
        const col = getColor(t);
        html += `<div class="chart__bar-segment" style="height:${pct}%;background:${col.bg}" title="${t}: ${d[t]}">`;
        if (pct > 5) html += `<span class="chart__bar-value" style="color:${col.label}">${d[t]}</span>`;
        html += `</div>`;
      }

      html += `</div>`;
      if (total > 0) {
        html += `<div class="chart__bar-total">${total.toLocaleString('fr-FR')}</div>`;
      }
      html += `<div class="chart__bar-label">${bin.label}</div>`;
      html += `</div>`;
    }

    html += '</div>'; // chart__bars
    html += '</div>'; // chart__area

    container.innerHTML = html;

    // Click handlers sur les barres
    container.querySelectorAll('.chart__bar-col--clickable').forEach(col => {
      col.addEventListener('click', () => {
        const bi = parseInt(col.dataset.bin);
        const bin = bins[bi];
        // Toggle : si déjà actif, désactiver
        if (activeBin && activeBin.start === bin.start) {
          activeBin = null;
        } else {
          activeBin = bin;
        }
        document.dispatchEvent(new CustomEvent('chart-bin-click', {
          detail: activeBin ? { start: bin.start, end: bin.end, label: bin.label } : null
        }));
      });
    });

    // Highlight la barre active
    if (activeBin) {
      container.querySelectorAll('.chart__bar-col').forEach(col => {
        const bi = parseInt(col.dataset.bin);
        if (bins[bi] && bins[bi].start === activeBin.start) {
          col.classList.add('chart__bar-col--active');
        }
      });
    }
  }

  let activeBin = null;

  function clearActiveBin() {
    activeBin = null;
  }

  return { render, clearActiveBin };
})();
