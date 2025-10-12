import { getSettings, Settings } from './settings';

const { getChatMessages, setChatMessages, generate, getLastMessageId } = TavernHelper;

// 通知辅助函数
async function showToast(type: 'success' | 'info' | 'warning' | 'error', message: string) {
  const settings = await getSettings();
  if (settings.disableNotifications && type !== 'error') {
    return;
  }
  toastr[type](message);
}

/**
 * 插件的核心初始化函数。
 */
export function initialize() {
  // 监听角色消息渲染完成事件
  eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, onGenerationEnded);
  showToast('success', 'AI 文本优化助手已加载！');
}

/**
 * 当AI生成结束时触发的回调函数。
 */
async function onGenerationEnded(messageId: number) {
  const settings = await getSettings();
  if (!settings.autoOptimize) {
    return;
  }

  const lastMessageId = await getLastMessageId();
  if (messageId !== lastMessageId) {
    return;
  }

  const messages = await getChatMessages(messageId);
  if (!messages || messages.length === 0) {
    return;
  }
  const latestMessage = messages[0];

  if (await checkMessageForDisabledWords(latestMessage.message)) {
    await handleFullAutoOptimize();
  }
}

/**
 * 检查消息中是否包含禁用词。
 */
export async function checkMessageForDisabledWords(messageText: string): Promise<boolean> {
  const settings = await getSettings();
  const cleanedMessage = cleanTextWithRegex(messageText, settings);
  const disabledWords = (settings.disabledWords || '').split(',').map(w => w.trim()).filter(Boolean);

  if (disabledWords.length === 0) {
    return false;
  }

  return disabledWords.some(word => {
    const escapedWord = word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    return new RegExp(escapedWord, 'i').test(cleanedMessage);
  });
}

/**
 * 从文本中提取包含指定单词的句子。
 */
function extractSentencesWithWords(text: string, words: string[]): string[] {
    const sentences = text.match(/[^.!?。！？]+[.!?。！？]?/g) || [text];
    const uniqueSentences = new Set<string>();

    words.forEach(word => {
        const escapedWord = word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(escapedWord, 'i');
        sentences.forEach(sentence => {
            if (regex.test(sentence)) {
                let cleanedSentence = sentence.replace(/[\r\n]/g, ' ').trim();
                cleanedSentence = cleanedSentence.replace(/\*/g, '');
                cleanedSentence = cleanedSentence.replace(/^[\s"'“‘]+|[\s"'”’]+$/g, '').trim();
                const ellipsisIndex = cleanedSentence.lastIndexOf('……');
                if (ellipsisIndex !== -1 && ellipsisIndex + 2 < cleanedSentence.length) {
                    cleanedSentence = cleanedSentence.substring(ellipsisIndex + 2);
                }
                cleanedSentence = cleanedSentence.replace(/^[\s"'“‘]+/, '').trim();
                uniqueSentences.add(cleanedSentence);
            }
        });
    });

    return Array.from(uniqueSentences);
}

/**
 * 使用正则表达式列表清理文本。
 */
function cleanTextWithRegex(text: string, settings: Settings): string {
  const regexFilters = settings.regexFilters || '';
  if (!regexFilters.trim()) {
    return text;
  }

  const regexLines = regexFilters.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  let cleanedText = text;

  for (const line of regexLines) {
    try {
      let pattern = line;
      let flags = 'gs';
      const match = line.match(/^\/(.*)\/([gimsuy]*)$/);
      if (match) {
        pattern = match[1];
        flags = match[2] !== '' ? match[2] : flags;
      }
      const regex = new RegExp(pattern, flags);
      cleanedText = cleanedText.replace(regex, '');
    } catch (error) {
      console.error(`[AI Optimizer] 无效的正则表达式: "${line}"`, error);
    }
  }
  return cleanedText.trim();
}

function getSystemPrompt(settings: Settings): string {
  const disabledWords = (settings.disabledWords || '').split(',').map((w: string) => w.trim()).filter(Boolean);
  const { main, system, final_system } = settings.promptSettings;

  return [
    main,
    system,
    `必须避免使用这些词：[${disabledWords.join(', ')}]`,
    final_system,
  ].filter(Boolean).join('\n');
}

/**
 * 将指定的文本和提示词发送给AI进行优化。
 */
export async function optimizeText(textToOptimize: string, prompt: string): Promise<string> {
  showToast('info', '正在发送给AI进行优化...');
  try {
    const result = await generate({
      user_input: `待优化句子：\n${textToOptimize}`,
      injects: [{ role: 'system', content: prompt, position: 'in_chat', depth: 0 }],
    });
    showToast('success', '优化完成。');
    return result ?? '';
  } catch (error) {
    console.error(error);
    showToast('error', '优化失败，请查看控制台日志。');
    return '';
  }
}

/**
 * 替换消息中的句子。
 */
export async function replaceMessage(originalContent: string, optimizedContent: string, callback: (newContent: string) => void) {
  const lastMessageId = await getLastMessageId();
  const messages = await getChatMessages(lastMessageId);
  if (!messages || messages.length === 0) {
    showToast('error', '未找到可替换的消息。');
    return;
  }
  const lastCharMessage = messages[0];

  const originalSentences = originalContent.split('\n').map(s => s.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
  const optimizedSentences = (optimizedContent.match(/\d+[.)]\s*.*?(?=\s*\d+[.)]|$)/g) || [])
    .map(s => s.replace(/^\d+[.)]\s*/, '').trim())
    .filter(Boolean);

  let modifiedMessage = lastCharMessage.message;

  if (originalSentences.length !== optimizedSentences.length) {
      showToast('warning', 'AI返回的句子数量与原始数量不匹配，将尝试整体替换。');
      const firstSentence = originalSentences[0];
      if (modifiedMessage.includes(firstSentence)) {
        modifiedMessage = modifiedMessage.replace(firstSentence, optimizedContent);
        for (let i = 1; i < originalSentences.length; i++) {
            modifiedMessage = modifiedMessage.replace(originalSentences[i], '');
        }
      } else {
        showToast('error', '找不到原始句子的起始位置，无法执行替换。');
        return;
      }
  } else {
      originalSentences.forEach((original, index) => {
          const optimized = optimizedSentences[index];
          if (optimized) {
            modifiedMessage = modifiedMessage.replace(original, optimized);
          }
      });
  }

  callback(modifiedMessage); // 更新UI上的测试文本框

  await setChatMessages([{ message_id: lastCharMessage.message_id, message: modifiedMessage }]);
  showToast('success', '消息已成功替换！');
}

/**
 * 手动触发，提取最后一条角色消息中包含禁用词的句子。
 */
export async function manualOptimize(callback: (content: string) => void) {
  const settings = await getSettings();
  const lastMessageId = await getLastMessageId();
  const messages = await getChatMessages(lastMessageId);

  if (!messages || messages.length === 0) {
    showToast('error', '聊天记录为空，无法优化。');
    callback('');
    return;
  }
  const lastCharMessage = messages[0];
  const messageText = lastCharMessage.message;

  const cleanedMessage = cleanTextWithRegex(messageText, settings);
  const disabledWords = (settings.disabledWords || '').split(',').map(w => w.trim()).filter(Boolean);

  if (disabledWords.length === 0) {
    showToast('warning', '未设置禁用词，无法提取。');
    callback('');
    return;
  }

  const sentences = extractSentencesWithWords(cleanedMessage, disabledWords);

  if (sentences.length > 0) {
    showToast('success', '已提取待优化内容。');
    const numberedSentences = sentences.map((sentence, index) => `${index + 1}. ${sentence}`).join('\n');
    callback(numberedSentences);
  } else {
    showToast('info', '在最后一条角色消息中未找到包含禁用词的句子。');
    callback('');
  }
}

/**
 * 一键全自动优化流程
 */
export async function handleFullAutoOptimize() {
  try {
    showToast('info', '自动化优化流程已启动...');
    const settings = await getSettings();

    const sourceContent: string = await new Promise((resolve) => {
      manualOptimize(resolve);
    });

    if (!sourceContent) {
      return;
    }
    
    const systemPrompt = getSystemPrompt(settings);
    const optimizedResultText = await optimizeText(sourceContent, systemPrompt);

    if (!optimizedResultText) {
      throw new Error('AI 未能返回优化后的文本。');
    }

    await replaceMessage(sourceContent, optimizedResultText, () => {});
    showToast('success', '自动优化完成！');

  } catch (error: any) {
    console.error('[Auto Optimizer] 流程执行出错:', error);
    showToast('error', error.message);
  }
}

export async function getLastCharMessage(): Promise<string> {
  const lastMessageId = await getLastMessageId();
  const messages = await getChatMessages(lastMessageId);
  if (messages && messages.length > 0) {
    return messages[0].message;
  }
  return '';
}

// 模拟旧扩展的 API 调用函数，以便 Panel.vue 可以使用
// 在新架构中，我们直接使用 `generate`，但为了兼容 Panel.vue 的结构，我们保留这些。
export async function fetchModelsFromApi(): Promise<string[]> {
    // 酒馆助手没有直接获取模型列表的 API，此功能暂时无法完美实现。
    // 我们可以返回一个预设列表或让用户手动输入。
    showToast('info', '酒馆助手脚本模式下无法自动获取模型列表。');
    return ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus-20240229', 'gemini-pro'];
}

export async function testApiConnection(): Promise<boolean> {
    // 我们可以通过一次简单的生成来测试连接
    try {
        await generate({ user_input: 'test', max_chat_history: 0 });
        showToast('success', 'API 连接成功！');
        return true;
    } catch (error) {
        showToast('error', 'API 连接失败。');
        return false;
    }
}
