/**
 * Filters — Gestion des facettes combinées (AND).
 */
const Filters = (() => {
  let state = {
    dep: '',
    naf: '',
    institution: new Set(),
    effectif: new Set(),
    anneeMin: '',
    anneeMax: '',
    urgence: new Set(),
    syndicats: null
  };

  // Libellés NAF (sections principales)
  const nafLabels = {
    '01':'Agriculture','02':'Sylviculture','03':'Pêche','05':'Charbon','06':'Hydrocarbures',
    '07':'Minerais métalliques','08':'Autres industries extractives','09':'Services extraction',
    '10':'Alimentaire','11':'Boissons','12':'Tabac','13':'Textile','14':'Habillement',
    '15':'Cuir/chaussure','16':'Bois','17':'Papier/carton','18':'Imprimerie','19':'Cokéfaction/raffinage',
    '20':'Chimie','21':'Pharma','22':'Caoutchouc/plastique','23':'Minéraux non métalliques',
    '24':'Métallurgie','25':'Produits métalliques','26':'Électronique/optique','27':'Équipements électriques',
    '28':'Machines/équipements','29':'Automobile','30':'Matériels transport','31':'Meubles',
    '32':'Autres industries manuf.','33':'Réparation/installation machines','34':'Énergie élec./gaz',
    '35':'Eau/assainissement','36':'Collecte/traitement eaux','37':'Collecte/traitement déchets',
    '38':'Dépollution','39':'Dépollution autre',
    '41':'Construction bâtiments','42':'Génie civil','43':'Travaux spécialisés',
    '45':'Commerce/réparation auto','46':'Commerce de gros','47':'Commerce de détail',
    '49':'Transports terrestres','50':'Transports par eau','51':'Transports aériens',
    '52':'Entreposage/logistique','53':'Activités de poste/courrier',
    '55':'Hébergement','56':'Restauration',
    '58':'Édition','59':'Cinéma/audiovisuel','60':'Radio/télévision',
    '61':'Télécommunications','62':'Informatique','63':'Services d\'information',
    '64':'Services financiers','65':'Assurance','66':'Auxiliaires financiers',
    '68':'Immobilier','69':'Juridique/comptable','70':'Sièges sociaux/conseil',
    '71':'Architecture/ingénierie','72':'R&D scientifique','73':'Publicité/études de marché',
    '74':'Autres activités spécialisées','75':'Vétérinaire',
    '77':'Location','78':'Emploi','79':'Agences de voyage',
    '80':'Enquêtes/sécurité','81':'Services aux bâtiments','82':'Services admin. de bureau',
    '84':'Administration publique','85':'Enseignement',
    '86':'Santé','87':'Hébergement médico-social','88':'Action sociale',
    '90':'Arts/spectacle','91':'Bibliothèques/musées','92':'Jeux de hasard',
    '93':'Sports/loisirs','94':'Organisations associatives','95':'Réparation biens',
    '96':'Autres services personnels'
  };

  const effectifRanges = {
    '1-49': [1, 49],
    '50-99': [50, 99],
    '100-299': [100, 299],
    '300-999': [300, 999],
    '1000+': [1000, Infinity]
  };

  let _onChange = () => {};

  function init(facets, onChange) {
    _onChange = onChange;

    // Département (select)
    const depSelect = document.getElementById('filter-dep');
    const deps = Object.entries(facets.departements).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [dep, count] of deps) {
      const opt = document.createElement('option');
      opt.value = dep;
      opt.textContent = `${dep} (${count})`;
      depSelect.appendChild(opt);
    }
    depSelect.addEventListener('change', () => {
      state.dep = depSelect.value;
      onChange();
    });

    // NAF (select)
    const nafSelect = document.getElementById('filter-naf');
    const nafs = Object.entries(facets.naf)
      .filter(([k]) => /^\d{2}$/.test(k))
      .sort((a, b) => a[0].localeCompare(b[0]));
    for (const [naf, count] of nafs) {
      const opt = document.createElement('option');
      opt.value = naf;
      const label = nafLabels[naf] || naf;
      opt.textContent = `${naf} — ${label} (${count.toLocaleString('fr-FR')})`;
      nafSelect.appendChild(opt);
    }
    nafSelect.addEventListener('change', () => {
      state.naf = nafSelect.value;
      onChange();
    });

    // Institution
    buildToggleGroup('filter-institution', facets.institutions, 'institution', onChange);

    // Effectif
    buildToggleGroup('filter-effectif', facets.effectifs, 'effectif', onChange);

    // Année élection (min / max selects)
    const years = Object.keys(facets.annees).sort();
    const anneeMin = document.getElementById('filter-annee-min');
    const anneeMax = document.getElementById('filter-annee-max');
    for (const y of years) {
      const c = facets.annees[y];
      const optMin = document.createElement('option');
      optMin.value = y;
      optMin.textContent = y;
      anneeMin.appendChild(optMin);
      const optMax = document.createElement('option');
      optMax.value = y;
      optMax.textContent = y;
      anneeMax.appendChild(optMax);
    }
    anneeMin.addEventListener('change', () => {
      state.anneeMin = anneeMin.value;
      // Auto-ajuster max si besoin
      if (state.anneeMin && state.anneeMax && state.anneeMax < state.anneeMin) {
        state.anneeMax = state.anneeMin;
        anneeMax.value = state.anneeMin;
      }
      onChange();
    });
    anneeMax.addEventListener('change', () => {
      state.anneeMax = anneeMax.value;
      if (state.anneeMin && state.anneeMax && state.anneeMin > state.anneeMax) {
        state.anneeMin = state.anneeMax;
        anneeMin.value = state.anneeMax;
      }
      onChange();
    });

    // Urgence
    const urgenceLabels = {
      'imminent': '⚡ Imminent',
      'proche': '📅 Proche',
      'planifie': '📋 Planifié',
      'lointain': '🔮 Lointain'
    };
    const urgenceFacets = {};
    for (const [k, v] of Object.entries(facets.urgences)) {
      if (urgenceLabels[k]) urgenceFacets[k] = v;
    }
    buildToggleGroup('filter-urgence', urgenceFacets, 'urgence', onChange, urgenceLabels);

    // Syndicats (mono-select : oui OU non)
    buildToggleGroup('filter-syndicats', facets.syndicats, 'syndicats', onChange, {
      'oui': '✓ Oui',
      'non': '✕ Non'
    }, false);

    // Reset
    document.getElementById('btn-reset-filters').addEventListener('click', () => {
      resetAll();
      onChange();
    });
  }

  function buildToggleGroup(containerId, facetData, stateKey, onChange, labelMap, multiSelect) {
    const container = document.getElementById(containerId);
    const isMulti = multiSelect !== false; // multi-select par défaut
    for (const [key, count] of Object.entries(facetData)) {
      const btn = document.createElement('button');
      btn.className = 'toggle-btn';
      btn.dataset.value = key;
      const label = labelMap ? (labelMap[key] || key) : key;
      btn.textContent = `${label} (${count.toLocaleString('fr-FR')})`;
      btn.addEventListener('click', () => {
        if (isMulti) {
          // Multi-select avec Set
          btn.classList.toggle('active');
          if (btn.classList.contains('active')) {
            state[stateKey].add(key);
          } else {
            state[stateKey].delete(key);
          }
        } else {
          // Mono-select (syndicats oui/non)
          if (btn.classList.contains('active')) {
            btn.classList.remove('active');
            state[stateKey] = null;
          } else {
            container.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state[stateKey] = key;
          }
        }
        onChange();
      });
      container.appendChild(btn);
    }
  }

  /** Active le filtre urgence "imminent" programmatiquement. */
  function setUrgence(value) {
    state.urgence = new Set([value]);
    // Mettre à jour l'UI
    const container = document.getElementById('filter-urgence');
    container.querySelectorAll('.toggle-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.value === value);
    });
    _onChange();
  }

  function resetAll() {
    state = { dep: '', naf: '', institution: new Set(), effectif: new Set(), anneeMin: '', anneeMax: '', urgence: new Set(), syndicats: null };
    document.getElementById('filter-dep').value = '';
    document.getElementById('filter-naf').value = '';
    document.getElementById('filter-annee-min').value = '';
    document.getElementById('filter-annee-max').value = '';
    document.querySelectorAll('.toggle-btn.active').forEach(b => b.classList.remove('active'));
  }

  function apply(companies) {
    return companies.filter(c => {
      if (state.dep && c.dep !== state.dep) return false;

      if (state.naf && !c.naf.startsWith(state.naf)) return false;

      if (state.institution.size > 0) {
        if (!c.elections.some(e => state.institution.has(e.type))) return false;
      }

      if (state.effectif.size > 0) {
        let matchEffectif = false;
        for (const key of state.effectif) {
          const range = effectifRanges[key];
          if (range && c.effectif >= range[0] && c.effectif <= range[1]) {
            matchEffectif = true;
            break;
          }
        }
        if (!matchEffectif) return false;
      }

      // Année min/max : vérifier si au moins une élection tombe dans la plage
      if (state.anneeMin || state.anneeMax) {
        const hasMatch = c.elections.some(e => {
          if (!e.next) return false;
          const y = e.next.substring(0, 4);
          if (state.anneeMin && y < state.anneeMin) return false;
          if (state.anneeMax && y > state.anneeMax) return false;
          return true;
        });
        if (!hasMatch) return false;
      }

      if (state.urgence.size > 0) {
        if (!state.urgence.has(c.urgency)) return false;
      }

      if (state.syndicats === 'oui' && (!c.syndicats || c.syndicats.length === 0)) return false;
      if (state.syndicats === 'non' && c.syndicats && c.syndicats.length > 0) return false;

      return true;
    });
  }

  function getState() { return { ...state }; }

  function hasActiveFilters() {
    return state.dep || state.naf || state.institution.size > 0 || state.effectif.size > 0 ||
           state.anneeMin || state.anneeMax || state.urgence.size > 0 || state.syndicats;
  }

  return { init, apply, getState, hasActiveFilters, setUrgence, resetAll };
})();
