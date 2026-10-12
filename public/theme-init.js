// Apply the theme before first paint to avoid a light/dark flash.
// External file (not inline) so the Content-Security-Policy can forbid inline scripts.
try {
  var p = localStorage.getItem('tilt.theme')
  var dark = p === 'dark' || ((!p || p === 'system') && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
} catch (e) {}
