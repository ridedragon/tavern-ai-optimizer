import { createApp, App } from 'vue';
import Panel from './Panel.vue';
import { initialize } from './core';

let app: App | null = null;

// 辅助函数，用于创建带脚本ID的唯一容器
function createScriptIdDiv(): JQuery<HTMLDivElement> {
  return $('<div>').attr('script_id', getScriptId()) as JQuery<HTMLDivElement>;
}

// 辅助函数，用于销毁容器
function destroyScriptIdDiv(): void {
  $(`div[script_id="${getScriptId()}"]`).remove();
}

/**
 * 等待 SillyTavern 核心UI加载完毕，确保所有上下文和API都可用。
 * @returns A promise that resolves when the UI is ready.
 */
function waitForTavern() {
  return new Promise<void>((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 100; // 等待20秒
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

// 当 DOM 加载完成时执行
$(() => {
  waitForTavern()
    .then(() => {
      // 1. 初始化核心逻辑
      initialize();

      // 2. 创建并挂载 Vue 设置面板
      const $appContainer = createScriptIdDiv();
      $('#extensions_settings2').append($appContainer);

      app = createApp(Panel);
      app.mount($appContainer[0]);
    })
    .catch(error => {
      console.error('[AI Optimizer] Initialization failed:', error);
    });
});

// 当脚本卸载时执行清理
$(window).on('unload', () => {
  if (app) {
    app.unmount();
  }
  destroyScriptIdDiv();
});
