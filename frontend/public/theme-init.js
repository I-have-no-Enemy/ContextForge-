// Theme before first paint: saved choice, else the system setting (dark by default).
// A separate file, not an inline script, so the server's Content-Security-Policy can stay script-src 'self'.
(function () {
  var t = null;
  try { t = localStorage.getItem('cf-theme'); } catch (e) {}
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
})();
