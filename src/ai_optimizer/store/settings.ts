import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { getSettings, saveSettings, defaultSettings, Settings } from '../settings';

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>(defaultSettings);

  // 异步加载设置
  getSettings().then(loadedSettings => {
    settings.value = loadedSettings;
  });

  // 监听设置变化并保存
  watch(
    settings,
    newSettings => {
      saveSettings(newSettings);
    },
    { deep: true },
  );

  return { settings };
});
