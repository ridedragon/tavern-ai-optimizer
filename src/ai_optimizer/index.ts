import { createApp } from 'vue';
import Panel from './Panel.vue';
import { createPinia } from 'pinia';

$(() => {
  const pinia = createPinia();
  const app = createApp(Panel);
  app.use(pinia);

  // 找到或创建一个挂载点
  let mountPoint = $('#ai-optimizer-mount-point');
  if (mountPoint.length === 0) {
    // 这是一个示例，您可能需要根据 SillyTavern 的实际 DOM 结构进行调整
    // 例如，将其附加到某个特定的设置面板
    mountPoint = $('<div id="ai-optimizer-mount-point"></div>');
    $('body').append(mountPoint); // 将其附加到 body，或更合适的位置
  }

  app.mount('#ai-optimizer-mount-point');
});
