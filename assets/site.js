(() => {
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const menu = document.querySelector('.menu-button');
  const theme = document.querySelector('.theme-button');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const mobile = matchMedia('(max-width: 650px)');
  const storageKey = 'notebook:' + new URL('../', document.currentScript.src).pathname + ':theme';

  function setMenu(open) {
    header.toggleAttribute('data-menu-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  function setMobile() {
    menu.hidden = !mobile.matches;
    setMenu(false);
  }
  header.setAttribute('data-enhanced', '');
  setMobile();
  mobile.addEventListener('change', setMobile);
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.hasAttribute('data-menu-open')) {
      setMenu(false);
      menu.focus();
    }
  });

  function updateTheme() {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : systemTheme.matches;
    theme.setAttribute('aria-pressed', String(dark));
    theme.firstElementChild.textContent = dark ? '☀' : '☾';
  }
  try {
    const preference = localStorage.getItem(storageKey);
    if (preference === 'light' || preference === 'dark') root.dataset.theme = preference;
  } catch {
    // The theme still works when browser storage is unavailable.
  }
  updateTheme();
  theme.hidden = false;
  systemTheme.addEventListener('change', updateTheme);
  theme.addEventListener('click', () => {
    root.dataset.theme = theme.getAttribute('aria-pressed') === 'true' ? 'light' : 'dark';
    updateTheme();
    try { localStorage.setItem(storageKey, root.dataset.theme); } catch { /* Keep the in-page setting. */ }
  });

  const query = document.querySelector('#query');
  if (!query) return;
  query.parentElement.hidden = false;
  const status = document.querySelector('#search-status');
  const normalize = text => text.normalize('NFKC').toLowerCase();
  const entries = Array.from(document.querySelectorAll('[data-search]'), element => ({
    element, text: normalize(element.dataset.search),
  }));
  function filter() {
    const terms = normalize(query.value).trim().split(/\s+/u).filter(Boolean);
    let count = 0;
    for (const entry of entries) {
      const matches = terms.every(term => entry.text.includes(term));
      entry.element.hidden = !matches;
      if (matches) count += 1;
    }
    status.textContent = count ? count + (count === 1 ? ' note' : ' notes') : 'No matching notes.';
  }
  query.addEventListener('input', filter);
  filter();
})();
