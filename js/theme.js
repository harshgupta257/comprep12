// Theme (light / dark / system) and text size.
import * as store from './store.js';

const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;

export function applyAppearance() {
  const { theme, textSize } = store.get().settings;
  const dark = theme === 'dark' || (theme !== 'light' && !!(mq && mq.matches));
  const root = document.documentElement;
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.setAttribute('data-size', ['s', 'm', 'l', 'xl'].includes(textSize) ? textSize : 'm');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0B0F11' : '#12515A');
}

if (mq) {
  const onChange = () => { if (store.get().settings.theme === 'system') applyAppearance(); };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
}
