/**
 * DataLoader — Chargement progressif des données avec cache IndexedDB.
 */
const DataLoader = (() => {
  const DB_NAME = 'paragon-vote-search';
  const DB_VERSION = 1;
  const STORE_NAME = 'data';

  let db = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onerror = () => resolve(null); // fallback sans cache
    });
  }

  function cacheGet(key) {
    if (!db) return Promise.resolve(null);
    return new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  function cacheSet(key, value) {
    if (!db) return Promise.resolve();
    return new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async function fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);
    return resp.json();
  }

  /**
   * Charge toutes les données. Retourne { meta, facets, companies, searchDocs }.
   * onProgress(pct) est appelé avec le pourcentage 0-100.
   */
  async function loadAll(onProgress = () => {}) {
    await openDB();

    // Vérifier le cache
    const cachedMeta = await cacheGet('meta');
    let meta, facets, companies, searchDocs;

    onProgress(5);
    meta = await fetchJSON('data/meta.json');

    // Si cache valide (même date de génération), utiliser
    if (cachedMeta && cachedMeta.generatedAt === meta.generatedAt) {
      onProgress(20);
      const cached = await cacheGet('allData');
      if (cached) {
        onProgress(100);
        return cached;
      }
    }

    onProgress(10);
    // Charger facets et search docs en parallèle
    [facets, searchDocs] = await Promise.all([
      fetchJSON('data/facets.json'),
      fetchJSON('data/search-docs.json')
    ]);
    onProgress(30);

    // Charger les chunks de companies
    companies = [];
    const totalChunks = meta.totalChunks;
    for (let i = 0; i < totalChunks; i++) {
      const chunk = await fetchJSON(`data/companies-${String(i).padStart(2, '0')}.json`);
      companies.push(...chunk);
      onProgress(30 + Math.round((i + 1) / totalChunks * 65));
    }

    onProgress(98);

    const result = { meta, facets, companies, searchDocs };

    // Mettre en cache
    await cacheSet('meta', meta);
    await cacheSet('allData', result);

    onProgress(100);
    return result;
  }

  /** Vide le cache IndexedDB. */
  async function clearCache() {
    await openDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  }

  return { loadAll, clearCache };
})();
