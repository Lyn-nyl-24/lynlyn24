(() => {
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const menu = document.querySelector('.menu-button');
  const theme = document.querySelector('.theme-button');
  const mobile = matchMedia('(max-width: 700px)');
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
    if (event.key !== 'Escape') return;
    const reference = document.querySelector('.stacks-reference[open]');
    if (reference) {
      reference.open = false;
      reference.querySelector('summary').focus();
    } else if (header.hasAttribute('data-menu-open')) {
      setMenu(false);
      menu.focus();
    }
  });
  document.addEventListener('click', event => {
    const reference = document.querySelector('.stacks-reference[open]');
    if (reference && !reference.contains(event.target)) reference.open = false;
  });
  function fitReference(reference) {
    const panel = reference.querySelector('.stacks-reference-panel');
    reference.classList.toggle('align-end',
      reference.getBoundingClientRect().left + panel.offsetWidth > root.clientWidth - 12);
  }
  document.addEventListener('toggle', event => {
    if (event.target.open && event.target.matches('.stacks-reference')) fitReference(event.target);
  }, true);
  addEventListener('resize', () => {
    const reference = document.querySelector('.stacks-reference[open]');
    if (reference) fitReference(reference);
  });

  function updateTheme() {
    const dark = root.dataset.theme === 'dark';
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
  theme.addEventListener('click', () => {
    root.dataset.theme = theme.getAttribute('aria-pressed') === 'true' ? 'light' : 'dark';
    updateTheme();
    try { localStorage.setItem(storageKey, root.dataset.theme); } catch { /* Keep the in-page setting. */ }
  });

  const sortButton = document.querySelector('[data-title-sort]');
  if (sortButton) {
    const list = document.getElementById(sortButton.getAttribute('aria-controls'));
    const entries = Array.from(list.children, element => ({ element, title: element.querySelector('.note-title').textContent }));
    const status = document.querySelector('[data-title-status]');
    const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
    let ascending = false;
    sortButton.hidden = false;
    document.querySelector('[data-title-label]').hidden = true;
    sortButton.addEventListener('click', () => {
      ascending = !ascending;
      const direction = ascending ? 1 : -1;
      const sorted = entries.toSorted((a, b) => direction * collator.compare(a.title, b.title));
      list.append(...sorted.map(entry => entry.element));
      sortButton.firstElementChild.textContent = ascending ? '↑' : '↓';
      sortButton.setAttribute('aria-label', 'Sort titles ' + (ascending ? 'Z to A' : 'A to Z'));
      status.textContent = 'Titles sorted ' + (ascending ? 'A to Z.' : 'Z to A.');
    });
  }

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
