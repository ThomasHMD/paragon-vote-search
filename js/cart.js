/**
 * Cart — Panier de sélection d'entreprises.
 */
const Cart = (() => {
  const selected = new Set();

  function emit() {
    document.dispatchEvent(new CustomEvent('cart-updated', { detail: { count: selected.size } }));
  }

  function toggle(id) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    emit();
  }

  function has(id) {
    return selected.has(id);
  }

  function addArray(ids) {
    for (const id of ids) selected.add(id);
    emit();
  }

  function remove(id) {
    selected.delete(id);
    emit();
  }

  function clear() {
    selected.clear();
    emit();
  }

  function getIds() {
    return [...selected];
  }

  return {
    toggle,
    has,
    addArray,
    remove,
    clear,
    getIds,
    get count() { return selected.size; }
  };
})();
