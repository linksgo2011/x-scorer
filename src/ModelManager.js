import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

class ModelManager {
  constructor() {
    this.models = new Map();
    this.currentModel = null;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.modelDir = path.join(__dirname, '../models');
    this.configFile = path.join(__dirname, '../custom-models.json');
    
    // 加载已保存的自定义模型
    this.loadCustomModels();
  }

  /**
   * 注册一个新的传播学模型
   * @param {string} name - 模型名称
   * @param {Object} modelData - 模型数据
   */
  registerModel(name, modelData) {
    this.models.set(name, {
      name,
      description: modelData.description || '',
      author: modelData.author || '',
      version: modelData.version || '1.0',
      dimensions: modelData.dimensions || [],
      scoring: modelData.scoring || {}
    });
  }

  /**
   * 从文件加载模型
   * @param {string} filePath - 模型文件路径
   * @param {string} modelName - 模型名称（可选）
   */
  async loadModelFromFile(filePath, modelName = null) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const modelData = this.parseModelFile(content);
      const name = modelName || path.basename(filePath, path.extname(filePath));
      
      this.registerModel(name, modelData);
      return name;
    } catch (error) {
      throw new Error(`Failed to load model from ${filePath}: ${error.message}`);
    }
  }

  /**
   * 解析模型文件（支持 JSON 和 Markdown）
   * @param {string} content - 文件内容
   */
  parseModelFile(content) {
    // 尝试解析 JSON
    try {
      return JSON.parse(content);
    } catch {
      // 如果不是 JSON，尝试解析 Markdown
      return this.parseMarkdownModel(content);
    }
  }

  /**
   * 解析 Markdown 格式的模型
   * @param {string} content - Markdown 内容
   */
  parseMarkdownModel(content) {
    const model = {
      description: '',
      author: '',
      version: '1.0',
      dimensions: [],
      scoring: {}
    };

    // 提取标题和元信息
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      model.name = titleMatch[1].trim();
    }

    // 提取描述
    const descMatch = content.match(/^##\s+模型描述\s*\n([\s\S]*?)(?=##|\n##|$)/);
    if (descMatch) {
      model.description = descMatch[1].trim();
    }

    // 提取作者
    const authorMatch = content.match(/^作者：\s*(.+)$/m);
    if (authorMatch) {
      model.author = authorMatch[1].trim();
    }

    // 提取维度
    const dimensionRegex = /^###\s+(.+?)\s*\n([\s\S]*?)(?=###|\n###|$)/g;
    let match;
    
    while ((match = dimensionRegex.exec(content)) !== null) {
      const dimensionName = match[1].trim();
      const dimensionContent = match[2].trim();
      
      const dimension = {
        name: dimensionName,
        key: this.generateKey(dimensionName),
        description: this.extractDescription(dimensionContent),
        indicators: this.extractIndicators(dimensionContent),
        keywords: this.extractKeywords(dimensionContent),
        weight: this.extractWeight(dimensionContent)
      };
      
      model.dimensions.push(dimension);
    }

    return model;
  }

  /**
   * 生成维度键名
   * @param {string} name - 维度名称
   */
  generateKey(name) {
    return name.replace(/[\s\-\:\(\)]+/g, '_').toLowerCase();
  }

  /**
   * 提取维度描述
   * @param {string} content - 维度内容
   */
  extractDescription(content) {
    const descMatch = content.match(/^\*\*描述：\*\*\s*\n?([\s\S]*?)(?=\*\*|$)/);
    return descMatch ? descMatch[1].trim() : '';
  }

  /**
   * 提取指标
   * @param {string} content - 维度内容
   */
  extractIndicators(content) {
    const indicators = [];
    const indicatorRegex = /^\*\s+(.+?)(?=\n\*|\n\n|$)/gm;
    let match;
    
    while ((match = indicatorRegex.exec(content)) !== null) {
      indicators.push(match[1].trim());
    }
    
    return indicators;
  }

  /**
   * 提取关键词
   * @param {string} content - 维度内容
   */
  extractKeywords(content) {
    const keywords = [];
    const keywordRegex = /关键词[：:]\s*([^\n]+)/g;
    let match;
    
    while ((match = keywordRegex.exec(content)) !== null) {
      const words = match[1].split(/[,，\s]+/)
        .map(word => word.trim())
        .filter(word => word.length > 0);
      keywords.push(...words);
    }
    
    return [...new Set(keywords)]; // 去重
  }

  /**
   * 提取权重
   * @param {string} content - 维度内容
   */
  extractWeight(content) {
    const weightMatch = content.match(/权重[：:]\s*(\d+(?:\.\d+)?)/);
    return weightMatch ? parseFloat(weightMatch[1]) : 1.0;
  }

  /**
   * 获取指定模型
   * @param {string} name - 模型名称
   */
  getModel(name) {
    return this.models.get(name);
  }

  /**
   * 获取所有可用模型
   */
  getAvailableModels() {
    return Array.from(this.models.keys());
  }

  /**
   * 设置当前使用的模型
   * @param {string} name - 模型名称
   */
  setCurrentModel(name) {
    if (!this.models.has(name)) {
      throw new Error(`Model '${name}' not found. Available models: ${this.getAvailableModels().join(', ')}`);
    }
    this.currentModel = name;
  }

  /**
   * 获取当前模型
   */
  getCurrentModel() {
    if (!this.currentModel) {
      throw new Error('No model selected. Please set a current model first.');
    }
    return this.models.get(this.currentModel);
  }

  /**
   * 获取当前模型的维度
   */
  getCurrentDimensions() {
    const model = this.getCurrentModel();
    return model.dimensions;
  }

  /**
   * 获取当前模型的评分配置
   */
  getCurrentScoringConfig() {
    const model = this.getCurrentModel();
    return model.scoring || {};
  }

  /**
   * 加载默认模型集
   */
  async loadDefaultModels() {
    // 内置模型定义
    const defaultModels = {
      'viral-scoring': {
        description: '病毒传播内容评估模型',
        author: '传播学专家',
        version: '1.0',
        dimensions: [
          {
            name: '情绪共鸣度',
            key: 'emotional_resonance',
            description: '内容引发情感共鸣的能力',
            indicators: ['引发强烈情感反应', '触动用户内心', '产生情感连接'],
            keywords: ['感动', '震撼', '惊喜', '愤怒', '喜悦', '悲伤', '惊讶', '恐惧'],
            weight: 1.2
          },
          {
            name: '互动钩子',
            key: 'engagement_hooks',
            description: '促使用户互动的元素',
            indicators: ['提问引导', '行动召唤', '话题讨论'],
            keywords: ['你怎么看', '欢迎留言', '点赞', '转发', '评论', '参与', '互动', '讨论'],
            weight: 1.1
          }
        ],
        scoring: {
          highScore: 80,
          mediumScore: 60,
          weights: 'adaptive'
        }
      },
      'influence': {
        description: '影响力六原则模型（基于罗伯特·西奥迪尼《影响力》）',
        author: '罗伯特·西奥迪尼',
        version: '1.0',
        dimensions: [
          {
            name: '互惠原理',
            key: 'reciprocity',
            description: '人们倾向于回报他人的善意',
            indicators: ['提供价值', '免费资源', '先给予后索取'],
            keywords: ['免费', '赠送', '分享', '帮助', '回馈', '感谢', '礼物', '优惠'],
            weight: 1.0
          },
          {
            name: '承诺一致',
            key: 'commitment_consistency',
            description: '人们倾向于保持言行一致',
            indicators: ['公开承诺', '逐步引导', '身份认同'],
            keywords: ['承诺', '保证', '立场', '观点', '支持', '认同', '立场坚定', '始终如一'],
            weight: 1.0
          },
          {
            name: '社会认同',
            key: 'social_proof',
            description: '人们倾向于跟随大众行为',
            indicators: ['群体行为', '名人背书', '数据支持'],
            keywords: ['大家', '流行', '趋势', '热门', '点赞', '转发', '评论', '关注'],
            weight: 1.2
          },
          {
            name: '权威效应',
            key: 'authority',
            description: '人们倾向于服从权威人士',
            indicators: ['专家身份', '专业背景', '可信来源'],
            keywords: ['专家', '权威', '专业', '研究', '数据', '报告', '官方', '认证'],
            weight: 1.1
          },
          {
            name: '喜好原理',
            key: 'liking',
            description: '人们更容易被喜欢的人影响',
            indicators: ['个人魅力', '相似性', '赞美认同'],
            keywords: ['喜欢', '可爱', '有趣', '亲切', '友好', '温暖', '幽默', '真诚'],
            weight: 1.0
          },
          {
            name: '稀缺效应',
            key: 'scarcity',
            description: '稀缺性会增加物品价值',
            indicators: ['数量有限', '时间紧迫', '独家机会'],
            keywords: ['限量', '稀缺', '抢购', '最后机会', '即将结束', '仅剩', '独家', '限时'],
            weight: 1.3
          }
        ],
        scoring: {
          highScore: 75,
          mediumScore: 55,
          weights: 'fixed'
        }
      },
      'contagious': {
        description: '疯传六原则模型（基于乔纳·伯杰《疯传》）',
        author: '乔纳·伯杰',
        version: '1.0',
        dimensions: [
          {
            name: '社交货币',
            key: 'social_currency',
            description: '分享内容能提升个人形象',
            indicators: ['展示品味', '显示聪明', '表现独特'],
            keywords: ['内幕', '秘诀', '独家', '稀缺', '高端', '专业', '前沿', '新潮'],
            weight: 1.2
          },
          {
            name: '诱因触发',
            key: 'triggers',
            description: '内容容易被日常事物触发',
            indicators: ['关联日常', '环境提醒', '时机恰当'],
            keywords: ['每天', '经常', '总是', '想到', '看到', '听到', '关联', '联系'],
            weight: 1.0
          },
          {
            name: '情绪驱动',
            key: 'emotion',
            description: '内容能激发强烈情绪',
            indicators: ['情感强烈', '情绪共鸣', '情感传染'],
            keywords: ['震惊', '愤怒', '感动', '惊喜', '恐惧', '焦虑', '兴奋', '快乐'],
            weight: 1.3
          },
          {
            name: '公开可见',
            key: 'public',
            description: '内容具有公开性和可见性',
            indicators: ['易于观察', '公开分享', '社交展示'],
            keywords: ['公开', '展示', '分享', '可见', '透明', '曝光', '传播', '扩散'],
            weight: 1.0
          },
          {
            name: '实用价值',
            key: 'practical_value',
            description: '内容具有实用性和帮助性',
            indicators: ['有用信息', '解决问题', '提供价值'],
            keywords: ['有用', '实用', '价值', '帮助', '解决', '方法', '技巧', '攻略'],
            weight: 1.1
          },
          {
            name: '故事包装',
            key: 'stories',
            description: '内容以故事形式呈现',
            indicators: ['情节吸引', '人物生动', '寓意深刻'],
            keywords: ['故事', '经历', '案例', '传说', '神话', '叙述', '讲述', '分享'],
            weight: 1.2
          }
        ],
        scoring: {
          highScore: 80,
          mediumScore: 60,
          weights: 'adaptive'
        }
      }
    };

    // 注册所有默认模型
    Object.entries(defaultModels).forEach(([name, model]) => {
      this.registerModel(name, model);
    });

    // 设置默认模型
    this.setCurrentModel('viral-scoring');
  }

  /**
   * 加载自定义模型配置
   */
  async loadCustomModels() {
    try {
      const configContent = await fs.readFile(this.configFile, 'utf-8');
      const customModels = JSON.parse(configContent);
      
      Object.entries(customModels).forEach(([name, modelData]) => {
        this.registerModel(name, modelData);
      });
      
      console.log(`✅ 已加载 ${Object.keys(customModels).length} 个自定义模型`);
    } catch (error) {
      // 配置文件不存在或解析失败，忽略错误
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️  加载自定义模型配置失败: ${error.message}`);
      }
    }
  }

  /**
   * 保存自定义模型配置
   */
  async saveCustomModels() {
    try {
      // 只保存非默认的自定义模型
      const customModels = {};
      const defaultModelNames = ['viral-scoring', 'influence', 'contagious'];
      
      for (const [name, model] of this.models) {
        if (!defaultModelNames.includes(name)) {
          customModels[name] = model;
        }
      }
      
      if (Object.keys(customModels).length > 0) {
        await fs.writeFile(this.configFile, JSON.stringify(customModels, null, 2));
        console.log(`✅ 已保存 ${Object.keys(customModels).length} 个自定义模型`);
      }
    } catch (error) {
      console.warn(`⚠️  保存自定义模型配置失败: ${error.message}`);
    }
  }

  /**
   * 重写从文件加载模型方法，包含持久化
   */
  async loadModelFromFile(filePath, modelName = null) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const modelData = this.parseModelFile(content);
      const name = modelName || path.basename(filePath, path.extname(filePath));
      
      this.registerModel(name, modelData);
      
      // 保存自定义模型配置
      await this.saveCustomModels();
      
      return name;
    } catch (error) {
      throw new Error(`Failed to load model from ${filePath}: ${error.message}`);
    }
  }
}

export { ModelManager };