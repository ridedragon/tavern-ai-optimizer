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

// 当 DOM 加载完成时执行
$(() => {
  // 1. 初始化核心逻辑
  initialize();

  // 2. 创建并挂载 Vue 设置面板
  const $appContainer = createScriptIdDiv();
  $('#extensions_settings2').append($appContainer);
  
  app = createApp(Panel);
  app.mount($appContainer[0]);
});

// 当脚本卸载时执行清理
$(window).on('unload', () => {
  if (app) {
    app.unmount();
  }
  destroyScriptIdDiv();
});
