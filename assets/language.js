import { completeTemplate, keyOf, protectedSelector, sentence } from './language-text-332c6206e73c2868.js';

const control = document.querySelector('article [data-language-pack]');
if (control) {
  const regions = [...control.closest('article').querySelectorAll('[data-post-text]')];
  const radios = [...control.querySelectorAll('input[name="language"]')];
  const status = control.querySelector('[role="status"]');
  const storageKey = 'notebook:' + new URL('../', import.meta.url).pathname + ':post-language';
  const queryLanguage = new URL(location.href).searchParams.get('lang');
  const override = ['en','ko'].includes(queryLanguage) ? queryLanguage : undefined;
  const originalText = new Map();
  const originalSentences = new Map();
  let current = 'en';
  let revision = 0;
  let catalog;

  function saved() {
    try { return localStorage.getItem(storageKey); } catch { return undefined; }
  }
  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const source = node.data;
      const key = keyOf(source);
      if (Object.hasOwn(catalog, key)) {
        originalText.set(node, source);
        node.data = source.replace(/\S[\s\S]*\S|\S/u, () => catalog[key]);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || node.matches(protectedSelector)) return;
    const pattern = sentence(node);
    if (pattern && Object.hasOwn(catalog, pattern.key) && completeTemplate(pattern.key, catalog[pattern.key])) {
      originalSentences.set(node, [...node.childNodes]);
      node.replaceChildren(...catalog[pattern.key].split(/(Q\d+Q)/g).map(part => /^Q\d+Q$/.test(part)
        ? pattern.elements[Number(part.slice(1, -1))] : document.createTextNode(part)));
      for (const element of pattern.elements) visit(element);
    } else {
      for (const child of node.childNodes) visit(child);
    }
  }
  function restore() {
    for (const [element, nodes] of originalSentences) element.replaceChildren(...nodes);
    for (const [node, text] of originalText) node.data = text;
    originalSentences.clear();
    originalText.clear();
  }
  async function select(lang, remember = false) {
    const id = ++revision;
    status.textContent = '';
    if (lang === 'ko') {
      try { catalog ??= (await import(new URL(control.dataset.languagePack, document.baseURI).href)).default; }
      catch {
        if (id !== revision) return;
        for (const radio of radios) radio.checked = radio.value === current;
        status.textContent = '한국어 번역을 불러오지 못했습니다. 다시 선택해 주세요.';
        return;
      }
    }
    if (id !== revision) return;
    if (current !== lang) {
      if (lang === 'ko') regions.forEach(visit);
      else restore();
      for (const region of regions) region.lang = lang;
      current = lang;
    }
    for (const radio of radios) radio.checked = radio.value === lang;
    if (remember) {
      try { localStorage.setItem(storageKey, lang); } catch { /* Storage is optional. */ }
      if (override) {
        const url = new URL(location.href);
        url.searchParams.set('lang', lang);
        history.replaceState(history.state, '', url);
      }
    }
  }
  window.addEventListener('storage', event => {
    if (event.key === storageKey && !override) select(event.newValue === 'ko' ? 'ko' : 'en');
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted && !override) select(saved() === 'ko' ? 'ko' : 'en');
  });
  control.hidden = false;
  control.addEventListener('change', event => select(event.target.value, true));
  select((override ?? saved()) === 'ko' ? 'ko' : 'en');
}
