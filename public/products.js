// Reads products saved by admin.html (localStorage)
window.ProductsStore = (function () {
  const KEY = "gridplanner_products_v1";
  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  }
  return { load };
})();
