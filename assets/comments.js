(() => {
  const panel = document.querySelector('[data-note-comments]');
  const page = new URL(location.href);
  if (!panel || page.origin !== 'https://lyn-nyl-24.github.io' || !page.pathname.startsWith('/lynlyn24/')) return;

  const giscusOrigin = 'https://giscus.app';
  const storageKey = 'lynlyn24:giscus';
  const tag = panel.dataset.noteComments;
  const loadButton = panel.querySelector('[data-load-comments]');
  const status = panel.querySelector('[data-comments-status]');
  const container = panel.querySelector('[data-comments-widget]');
  const stateParam = 'comments-state';
  let frame;
  let session = '';
  let state;
  const theme = () => document.documentElement.dataset.theme === 'dark' ? 'noborder_dark' : 'noborder_light';

  function remember() {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ note: tag, state, session })); } catch { /* Storage can be disabled. */ }
  }

  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(storageKey)); } catch { /* Invalid or unavailable storage. */ }
  const returned = page.searchParams.getAll('giscus');
  const returnedState = page.searchParams.getAll(stateParam);
  if (returned.length || returnedState.length) {
    page.searchParams.delete('giscus');
    page.searchParams.delete(stateParam);
    history.replaceState(history.state, '', page);
  }

  // Giscus returns an encrypted, base64-encoded session after the GitHub OAuth flow.
  const validSession = value => typeof value === 'string' && /^[A-Za-z0-9+/_=-]{1,4096}$/.test(value);
  const callback = returnedState.length === 1 && returnedState[0] && saved?.note === tag && saved.state === returnedState[0];
  if (callback && returned.length === 1 && validSession(returned[0])) session = returned[0];
  else if (validSession(saved?.session)) session = saved.session;

  const callbackPage = new URL(page.pathname, page.origin);
  callbackPage.hash = panel.id;
  const permalink = new URL('/lynlyn24/tag/' + tag + '/', page.origin);

  function widgetUrl() {
    const url = new URL('/en/widget', giscusOrigin);
    url.search = new URLSearchParams({
      origin: callbackPage.href,
      backLink: permalink.href,
      repo: 'Lyn-nyl-24/lynlyn24',
      repoId: 'R_kgDOVrh1qw',
      category: 'Announcements',
      categoryId: 'DIC_kwDOVrh1q84DK9fL',
      term: 'Lynlyn24 Tag ' + tag,
      strict: '1',
      reactionsEnabled: '0',
      emitMetadata: '0',
      inputPosition: 'top',
      theme: theme(),
      ...(session ? { session } : {}),
    });
    return url.href;
  }

  function syncTheme() {
    frame?.contentWindow?.postMessage({ giscus: { setConfig: { theme: theme() } } }, giscusOrigin);
  }

  function load() {
    if (frame) return;
    state = crypto.randomUUID();
    callbackPage.searchParams.set(stateParam, state);
    remember();
    frame = document.createElement('iframe');
    frame.title = 'GitHub Discussions comments';
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation');
    frame.addEventListener('load', syncTheme);
    frame.src = widgetUrl();
    container.append(frame);
    loadButton.hidden = true;
    status.textContent = 'Loading comments.';
  }

  window.addEventListener('message', event => {
    if (event.origin !== giscusOrigin || !frame || event.source !== frame.contentWindow) return;
    const message = event.data?.giscus;
    if (!message || typeof message !== 'object') return;
    if (Number.isSafeInteger(message.resizeHeight) && message.resizeHeight > 0) {
      frame.height = String(Math.max(180, Math.min(message.resizeHeight, 12000)));
      status.textContent = '';
    }
    const invalidSession = typeof message.error === 'string' && /Bad credentials|Invalid state value|State has expired/i.test(message.error);
    if (session && (message.signOut === true || invalidSession)) {
      session = '';
      remember();
      frame.src = widgetUrl();
    }
  });

  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  loadButton.addEventListener('click', load);
  panel.hidden = false;
  if (callback) {
    panel.open = true;
    load();
  }
})();
