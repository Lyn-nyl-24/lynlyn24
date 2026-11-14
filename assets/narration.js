(() => {
  const narration = document.querySelector('[data-narration]');
  if (narration) {
    const audio = narration.querySelector('audio');
    const chapters = JSON.parse(narration.dataset.narration);
    const controls = narration.querySelector('.narration-controls');
    const play = narration.querySelector('[data-play]');
    const position = narration.querySelector('[data-seek]');
    const progress = narration.querySelector('progress');
    const time = narration.querySelector('[data-time]');
    const total = narration.querySelector('[data-duration]');
    const chapterLabel = narration.querySelector('[data-playing-chapter]');
    const rate = narration.querySelector('[data-rate]');
    const error = narration.querySelector('[data-narration-error]');
    const buttons = new Map();
    let active;
    let pending;
    let chapterEnd;
    function clock(seconds) {
      const whole = Math.floor(seconds);
      return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
    }
    function update() {
      const playing = !audio.paused && !audio.ended;
      const duration = Number.isFinite(audio.duration) ? audio.duration : Number(position.max);
      const elapsed = pending ?? audio.currentTime;
      position.max = duration;
      position.value = elapsed;
      progress.max = duration;
      progress.value = elapsed;
      time.textContent = clock(elapsed);
      total.textContent = clock(duration);
      position.setAttribute('aria-valuetext', clock(elapsed) + ' of ' + clock(duration));
      play.setAttribute('aria-label', playing ? 'Pause narration' : 'Play narration');
      const action = playing ? 'Pause' : 'Play';
      if (play.textContent !== action) play.textContent = action;
      const chapter = playing || elapsed > 0 ? chapters.findLast(item => item.start <= elapsed) : undefined;
      if (chapter !== active) {
        if (active) {
          buttons.get(active.id)?.removeAttribute('aria-current');
          document.getElementById(active.id)?.classList.remove('narrating');
        }
        active = chapter;
        if (active) {
          buttons.get(active.id)?.setAttribute('aria-current', 'true');
          document.getElementById(active.id)?.classList.add('narrating');
        }
        chapterLabel.textContent = active ? buttons.get(active.id)?.dataset.chapterTitle ?? '' : '';
      }
    }
    function seek(seconds) {
      if (audio.readyState) {
        audio.currentTime = seconds;
        pending = undefined;
      } else {
        pending = seconds;
      }
      update();
    }
    function start() {
      error.hidden = true;
      audio.play().catch(() => {
        if (audio.error) error.hidden = false;
        update();
      });
    }
    audio.addEventListener('loadedmetadata', () => pending === undefined ? update() : seek(pending));
    for (const event of ['play', 'pause', 'ended', 'seeked']) audio.addEventListener(event, update);
    audio.addEventListener('timeupdate', () => {
      if (chapterEnd !== undefined && audio.currentTime >= chapterEnd) {
        chapterEnd = undefined;
        audio.pause();
      }
      update();
    });
    audio.addEventListener('error', () => { error.hidden = false; });
    play.addEventListener('click', () => {
      chapterEnd = undefined;
      if (audio.paused) start();
      else audio.pause();
    });
    position.addEventListener('input', () => {
      chapterEnd = undefined;
      seek(Number(position.value));
    });
    rate.addEventListener('change', () => { audio.playbackRate = Number(rate.value); });
    for (const button of document.querySelectorAll('[data-chapter]')) {
      const index = chapters.findIndex(item => item.id === button.dataset.chapter);
      const chapter = chapters[index];
      buttons.set(chapter.id, button);
      button.hidden = false;
      button.addEventListener('click', () => {
        chapterEnd = chapters[index + 1]?.start;
        seek(chapter.start);
        start();
      });
    }
    audio.hidden = true;
    controls.hidden = false;
  }
})();
