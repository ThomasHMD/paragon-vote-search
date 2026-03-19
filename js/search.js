/**
 * SearchEngine — Wrapper autour de MiniSearch pour la recherche full-text.
 */
const SearchEngine = (() => {
  let miniSearch = null;
  let allDocs = [];

  /**
   * Initialise MiniSearch avec les documents de recherche.
   */
  function init(searchDocs) {
    allDocs = searchDocs;
    miniSearch = new MiniSearch({
      fields: ['nom', 'ville', 'siret', 'cp'],
      storeFields: ['id'],
      searchOptions: {
        boost: { nom: 3, siret: 2, ville: 1.5, cp: 1 },
        fuzzy: 0.2,
        prefix: true
      }
    });
    miniSearch.addAll(searchDocs);
  }

  /**
   * Recherche full-text. Retourne un Set d'IDs correspondants.
   * Si query est vide, retourne null (= tout afficher).
   */
  function search(query) {
    if (!query || !query.trim()) return null;
    const results = miniSearch.search(query.trim());
    return new Set(results.map(r => r.id));
  }

  return { init, search };
})();
