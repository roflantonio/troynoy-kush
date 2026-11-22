'use strict';

const installButton = document.querySelector('#install-game');
const installHelp = document.querySelector('#install-help');
const installedMode = matchMedia('(display-mode: standalone)');
let installPrompt;

if (!installedMode.matches && navigator.standalone !== true && matchMedia('(any-pointer: coarse)').matches) {
  installButton.hidden = false;
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});

window.addEventListener('appinstalled', () => {
  installButton.hidden = true;
  installHelp.hidden = true;
  installPrompt = null;
});

installButton.addEventListener('click', async () => {
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome === 'accepted') return;
    } catch {
      // The browser menu remains available if the install prompt expires.
    }
  }
  installHelp.textContent = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
    ? 'В Safari нажми «Поделиться», затем «На экран „Домой“».'
    : 'В меню браузера выбери «Установить приложение» или «Добавить на главный экран».';
  installHelp.hidden = false;
});
