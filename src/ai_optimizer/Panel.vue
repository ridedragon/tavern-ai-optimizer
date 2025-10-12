<template>
  <div class="ai-optimizer-settings">
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>AI 文本优化助手</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>
      <div class="inline-drawer-content">
        <!-- 生成设置 -->
        <b>生成设置</b>
        <div class="block">
          <label>Temperature ({{ settings.temperature }})</label>
          <CustomSlider v-model="settings.temperature" :min="0" :max="2" :step="0.01" />
        </div>
        <div class="block">
          <label>Max Tokens</label>
          <input v-model.number="settings.max_tokens" class="text_pole" type="number" />
        </div>
        <div class="block">
          <label>Top P ({{ settings.top_p }})</label>
          <CustomSlider v-model="settings.top_p" :min="0" :max="1" :step="0.01" />
        </div>
        <div class="block">
          <label>Top K</label>
          <input v-model.number="settings.top_k" class="text_pole" type="number" />
        </div>

        <hr class="sysHR" />

        <!-- API 设置 -->
        <b>API 设置</b>
        <div class="block">
          <label>API 提供商</label>
          <select v-model="settings.apiProvider" class="text_pole">
            <option value="openai">OpenAI</option>
            <option value="openai_test">OpenAI (测试)</option>
            <option value="google">Google</option>
            <option value="sillytavern_backend">SillyTavern (后端)</option>
            <option value="sillytavern_preset">SillyTavern (预设)</option>
          </select>
        </div>
        <div class="block">
          <label>API URL</label>
          <input v-model="settings.apiUrl" class="text_pole" type="text" placeholder="例如: https://api.openai.com/v1" />
        </div>
        <div class="block">
          <label>API 密钥</label>
          <input v-model="settings.apiKey" class="text_pole" type="password" />
        </div>
        <div class="button-group">
          <button class="menu_button" @click="handleTestConnection">测试连接</button>
          <button class="menu_button" @click="fetchModels">获取模型</button>
          <span v-if="connectionStatus === 'success'" style="color: green;">连接成功！</span>
          <span v-if="connectionStatus === 'error'" style="color: red;">连接失败。</span>
        </div>
        <div class="block">
          <label>模型名称</label>
          <select v-model="settings.modelName" class="text_pole">
            <option v-if="settings.modelName && !modelList.includes(settings.modelName)" :value="settings.modelName">
              {{ settings.modelName }} (自定义)
            </option>
            <option v-for="model in modelList" :key="model" :value="model">
              {{ model }}
            </option>
          </select>
          <label class="checkbox_label">
            <input v-model="settings.autoFetchModels" type="checkbox" />
            每次加载时自动获取
          </label>
        </div>

        <hr class="sysHR" />

        <!-- 禁用词设置 -->
        <b>禁用词与优化</b>
        <div class="block">
          <label>禁用词列表 (用英文逗号 , 分隔)</label>
          <textarea v-model="settings.disabledWords" class="text_pole" rows="3"></textarea>
        </div>
        <div class="block">
          <label>正则表达式过滤器 (每行一个)</label>
          <textarea v-model="settings.regexFilters" class="text_pole" rows="5"></textarea>
        </div>
        <div class="block">
          <label>最后一条角色消息 (自动刷新)</label>
          <textarea v-model="lastCharMessageContent" class="text_pole" rows="4" readonly></textarea>
        </div>
        <div class="button-group">
          <button class="menu_button" @click="handleFullAutoOptimize">一键全自动优化</button>
          <label class="checkbox_label">
            <input v-model="settings.autoOptimize" type="checkbox" />
            自动优化
          </label>
          <label class="checkbox_label">
            <input v-model="settings.disableNotifications" type="checkbox" />
            关闭大部分通知
          </label>
        </div>
        <div class="block">
          <label>待优化内容</label>
          <textarea v-model="optimizedContent" class="text_pole" rows="4"></textarea>
        </div>
        <div class="button-group">
          <button class="menu_button" @click="handleOptimize">优化</button>
        </div>
        <div class="block">
          <label>优化后内容</label>
          <textarea v-model="optimizedResult" class="text_pole" rows="4"></textarea>
        </div>
        <div class="button-group">
          <button class="menu_button" @click="handleReplaceMessage">替换</button>
        </div>
        <div class="block">
          <label>修改后的消息内容 (测试)</label>
          <textarea v-model="modifiedMessage" class="text_pole" rows="6"></textarea>
        </div>

        <hr class="sysHR" />

        <!-- 提示词编写器 -->
        <b>提示词编写器</b>
        <div class="block">
          <label>选择编辑的提示词:</label>
          <select v-model="activePrompt" class="text_pole">
            <option value="main">主系统提示词 (通用)</option>
            <option value="system">拦截任务详细指令</option>
            <option value="final_system">最终注入指令</option>
          </select>
          <textarea v-model="settings.promptSettings[activePrompt]" class="text_pole" rows="6"></textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CustomSlider from './components/CustomSlider.vue';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { getSettings, saveSettings, defaultSettings, Settings } from './settings';
// 核心逻辑将在下一个步骤中创建
// import { fetchModelsFromApi, testApiConnection, manualOptimize, optimizeText, replaceMessage, getLastCharMessage, checkMessageForDisabledWords } from './core';

import { fetchModelsFromApi, testApiConnection, manualOptimize, optimizeText, replaceMessage, getLastCharMessage, checkMessageForDisabledWords, handleFullAutoOptimize } from './core';


const settings = ref<Settings>(defaultSettings);
const modelList = ref<string[]>([]);
const connectionStatus = ref<'unknown' | 'success' | 'error'>('unknown');
const activePrompt = ref<'main' | 'system' | 'final_system'>('main');
const optimizedContent = ref('');
const optimizedResult = ref('');
const modifiedMessage = ref('');
const lastCharMessageContent = ref('');
let messagePollingInterval: number | undefined;
let lastProcessedMessage = ref('');

// 监听设置变化并保存
watch(settings, (newSettings) => {
  saveSettings(newSettings);
}, { deep: true });

// 监听最后一条角色消息的变化，以触发自动优化
watch(lastCharMessageContent, (newMessage, oldMessage) => {
  if (!settings.value.autoOptimize || !newMessage || newMessage === lastProcessedMessage.value) {
    return;
  }

  if (checkMessageForDisabledWords(newMessage)) {
    console.log('[AI Optimizer] Detected disabled word in new message, triggering auto-optimization.');
    lastProcessedMessage.value = newMessage; // 标记为已处理
    handleFullAutoOptimize();
  }
});

const handleReplaceMessage = () => {
  if (!optimizedContent.value || !optimizedResult.value) {
    toastr.warning('“待优化内容”和“优化后内容”都不能为空。');
    return;
  }
  replaceMessage(
    optimizedContent.value,
    optimizedResult.value,
    (newContent: string) => {
      modifiedMessage.value = newContent;
    },
  );
};

const handleOptimize = async () => {
  if (!optimizedContent.value) {
    toastr.warning('待优化内容不能为空。');
    return;
  }
  toastr.info('正在发送给AI进行优化...');
  try {
    const result = await optimizeText(optimizedContent.value, settings.value.promptSettings[activePrompt.value]);
    optimizedResult.value = result;
    toastr.success('优化完成。');
  } catch (error) {
    console.error(error);
    toastr.error('优化失败，请查看控制台日志。');
  }
};

const fetchModels = async () => {
  toastr.info('正在获取模型列表...');
  try {
    const models = await fetchModelsFromApi();
    if (models.length > 0) {
      modelList.value = models;
      toastr.success(`成功获取 ${models.length} 个模型。`);
    } else {
      toastr.warning('未能获取到模型列表，请检查设置或控制台日志。');
    }
  } catch (error) {
    console.error(error);
    toastr.error('获取模型时发生未知错误。');
  }
};


const handleTestConnection = async () => {
  connectionStatus.value = 'unknown';
  toastr.info('正在测试连接...');
  try {
    const success = await testApiConnection();
    connectionStatus.value = success ? 'success' : 'error';
    if (success) {
      toastr.success('API 连接成功！');
    } else {
      toastr.error('API 连接失败，请检查设置和控制台日志。');
    }
  } catch (error) {
    connectionStatus.value = 'error';
    toastr.error('API 连接测试时发生错误。');
    console.error(error);
  }
};

onMounted(async () => {
  // 加载设置
  settings.value = await getSettings();

  if (settings.value.autoFetchModels) {
    fetchModels();
  }

  lastCharMessageContent.value = getLastCharMessage();
  console.log('[AI Optimizer] Initial lastCharMessage:', lastCharMessageContent.value);

  messagePollingInterval = window.setInterval(() => {
    const newMessage = getLastCharMessage();
    if (newMessage !== lastCharMessageContent.value) {
      lastCharMessageContent.value = newMessage;
      console.log('[AI Optimizer] lastCharMessage updated.');
    }
  }, 3000);
});

onUnmounted(() => {
  if (messagePollingInterval) {
    clearInterval(messagePollingInterval);
  }
});
</script>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 10px 0;
}
.flex-container {
  display: flex;
  gap: 10px;
  align-items: center;
}
.flex-container > select {
  flex-grow: 1;
}
.button-group {
  display: flex;
  flex-direction: row;
  gap: 10px;
  align-items: center;
  margin: 10px 0;
}
.menu_button {
  white-space: nowrap;
}
</style>
