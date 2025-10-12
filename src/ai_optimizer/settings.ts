// 定义设置的 Zod Schema
export const SettingsSchema = z
  .object({
    autoOptimize: z.boolean().default(false),
    apiProvider: z.enum(['openai', 'openai_test', 'google', 'sillytavern_backend', 'sillytavern_preset']).default('openai'),
    apiUrl: z.string().url().optional().or(z.literal('')).default(''),
    apiKey: z.string().default(''),
    modelName: z.string().default(''),
    autoFetchModels: z.boolean().default(false),
    disabledWords: z.string().default(''),
    regexFilters: z.string().default(
      [
        '<StatusPlaceHolderImpl\\/>',
        '\\s*<!--[\\s\\S]*?-->\\s*',
        '(<disclaimer>.*?<\\/disclaimer>)|(<guifan>.*?<\\/guifan>)|```start|<content>|<\\/content>|```end|<done>|`<done>`|(<!--\\s*consider\\s*:\\s*(.*?)\\s*-->)|(.*?<\\/think(ing)?>(\\n)?)|(<think(ing)?>[\\s\\S]*?<\\/think(ing)?>(\\n)?)',
        '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gm',
      ].join('\n')
    ),
    disableNotifications: z.boolean().default(false),

    // 生成设置
    temperature: z.number().min(0).max(2).default(0.7),
    max_tokens: z.number().int().positive().default(2000),
    top_p: z.number().min(0).max(1).default(1),
    top_k: z.number().int().positive().optional(),

    // 提示词编写器设置
    promptSettings: z.object({
        main: z.string().default(''),
        system: z.string().default(''),
        final_system: z.string().default(''),
    }).default({
        main: '你是一个专业的剧情优化助手。',
        system: '请根据用户的要求，优化提供的句子，使其更生动、更具描述性。',
        final_system: '只返回优化后的句子，不要包含任何额外的解释或标签。',
    }),
  });

// 从 Schema 推断出 TypeScript 类型
export type Settings = z.infer<typeof SettingsSchema>;

// 默认设置
export const defaultSettings: Settings = SettingsSchema.parse({});

// 用于存储和获取设置的辅助函数
// 我们将使用酒馆助手的脚本变量系统

/**
 * 获取当前脚本的设置，如果不存在则返回默认设置
 * @returns {Promise<Settings>}
 */
export async function getSettings(): Promise<Settings> {
  const variables = await TavernHelper.getVariables({ type: 'script' });
  // 使用 Zod 解析并提供默认值，确保类型安全
  return SettingsSchema.parse(variables.settings || {});
}

/**
 * 保存设置
 * @param {Partial<Settings>} newSettings
 * @returns {Promise<void>}
 */
export async function saveSettings(newSettings: Partial<Settings>): Promise<void> {
  const currentSettings = await getSettings();
  const updatedSettings = { ...currentSettings, ...newSettings };
  await TavernHelper.updateVariablesWith(() => ({ settings: updatedSettings }), { type: 'script' });
}
