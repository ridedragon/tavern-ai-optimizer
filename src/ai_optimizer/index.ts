import { createApp, App } from 'vue';
import { createPinia } from 'pinia';
import Panel from './Panel.vue';
import { initialize } from './core';

// 国际化占位符
const t = (str: string) => str;

let app: App | null = null;

function createScriptIdDiv(): JQuery<HTMLDivElement> {
  return $('<div>').attr('script_id', getScriptId()) as JQuery<HTMLDivElement>;
}

function destroyScriptIdDiv(): void {
  $(`div[script_id="${getScriptId()}"]`).remove();
}

function waitForTavern() {
  return new Promise<void>((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 100;
    const interval = setInterval(() => {
      if (window.parent.document.getElementById('send_form')) {
        clearInterval(interval);
        resolve();
      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Timeout waiting for #send_form in parent document'));
        }
      }
    }, 200);
  });
}

$(() => {
  waitForTavern()
    .then(() => {
      initialize();

      const $appContainer = createScriptIdDiv();
      $('#extensions_settings2').append($appContainer);

      app = createApp(Panel);

      // 设置 Pinia
      const pinia = createPinia();
      app.use(pinia);

      // 设置 i18n
      const i18n = {
        install: (app: App) => {
          app.config.globalProperties.t = t;
        },
      };
      app.use(i18n);

      app.mount($appContainer[0]);
    })
    .catch(error => {
      console.error('[AI Optimizer] Initialization failed:', error);
    });
});

$(window).on('unload', () => {
  if (app) {
    app.unmount();
  }
  destroyScriptIdDiv();
});
