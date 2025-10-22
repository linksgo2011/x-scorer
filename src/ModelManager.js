import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

class ModelManager {
  constructor(modelDir = null) {
    this.models = new Map();
    this.currentModel = null;
    this.modelDir = modelDir || path.join(process.cwd(), 'models');
    this.configFile = path.join(process.cwd(), 'custom-models.json');
    
    // 默认模型名称列表（现在从models目录动态加载）
    this.defaultModelNames = [];
    
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
   * 确保模型目录存在
   */
  async ensureModelDirExists() {
    try {
      await fs.access(this.modelDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        try {
          await fs.mkdir(this.modelDir, { recursive: true });
          console.log(`✅ 已创建模型目录: ${this.modelDir}`);
        } catch (mkdirError) {
          console.warn(`⚠️  创建模型目录失败: ${mkdirError.message}`);
        }
      }
    }
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
   * 加载默认模型集（从models目录读取）
   */
  async loadDefaultModels() {
    try {
      // 确保模型目录存在
      await this.ensureModelDirExists();
      
      // 获取models目录下的所有JSON文件
      const modelFiles = await fs.readdir(this.modelDir);
      const jsonFiles = modelFiles.filter(file => file.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        console.warn('⚠️  models目录中没有找到模型文件');
        return;
      }

      // 清空默认模型名称列表
      this.defaultModelNames = [];

      // 加载每个模型文件
      for (const file of jsonFiles) {
        const filePath = path.join(this.modelDir, file);
        const modelName = path.basename(file, '.json');
        
        try {
          await this.loadModelFromFile(filePath, modelName);
          this.defaultModelNames.push(modelName);
          console.log(`✅ 已加载模型：${modelName}`);
        } catch (error) {
          console.warn(`⚠️  加载模型文件失败 ${file}: ${error.message}`);
        }
      }

      // 设置默认模型（优先使用viral-scoring，如果不存在则使用第一个）
      const availableModels = this.getAvailableModels();
      if (availableModels.length > 0) {
        const defaultModel = availableModels.includes('viral-scoring') ? 'viral-scoring' : availableModels[0];
        this.setCurrentModel(defaultModel);
      }
      
    } catch (error) {
      console.error('❌ 加载默认模型失败:', error.message);
      throw error;
    }
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
      // 只保存非默认的自定义模型（使用动态加载的默认模型列表）
      const customModels = {};
      
      for (const [name, model] of this.models) {
        if (!this.defaultModelNames.includes(name)) {
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