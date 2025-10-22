#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { OpenAI } from 'openai';

import { ModelManager } from './src/ModelManager.js';
import { ContentAnalyzer } from './src/ContentAnalyzer.js';
import { ReportGenerator } from './src/ReportGenerator.js';

class ViralContentAnalyzer {
  constructor() {
    this.modelManager = new ModelManager();
    this.contentAnalyzer = null;
    this.reportGenerator = new ReportGenerator();
    this.openai = null;
    
    // 初始化OpenAI客户端 - 默认启用AI分析
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.contentAnalyzer = new ContentAnalyzer(this.openai);
    } else {
      // 没有API密钥时也尝试创建空客户端，让ContentAnalyzer处理回退逻辑
      this.contentAnalyzer = new ContentAnalyzer();
    }
  }

  /**
   * 初始化应用
   */
  async initialize() {
    try {
      await this.modelManager.loadDefaultModels();
      console.log('✅ 模型加载完成');
    } catch (error) {
      console.error('❌ 模型加载失败:', error.message);
      throw error;
    }
  }

  /**
   * 分析内容
   * @param {string} content - 要分析的内容
   * @param {Object} options - 分析选项
   */
  async analyzeContent(content, options = {}) {
    const {
      modelName = null,
      useAI = true,
      simple = false
    } = options;

    try {
      // 设置当前模型
      if (modelName) {
        this.modelManager.setCurrentModel(modelName);
      }

      const currentModel = this.modelManager.getCurrentModel();
      const dimensions = this.modelManager.getCurrentDimensions();
      const scoringConfig = this.modelManager.getCurrentScoringConfig();

      console.log(`📊 使用模型：${currentModel.name}`);
      console.log(`🎯 分析维度：${dimensions.length}个`);
      
      // 准备模型上下文信息
      const modelContext = {
        name: currentModel.name,
        description: currentModel.description,
        author: currentModel.author,
        version: currentModel.version
      };
      
      // 分析内容
      const analysis = await this.contentAnalyzer.analyzeContent(
        content,
        dimensions,
        { 
          useAI, 
          aiScoring: useAI,
          modelContext 
        }
      );

      // 获取预测
      const prediction = this.contentAnalyzer.getEngagementPrediction(
        analysis.score,
        scoringConfig
      );

      // 添加预测到分析结果
      analysis.prediction = prediction;

      // 生成报告
      let report;
      if (simple) {
        report = this.reportGenerator.generateSimpleReport(analysis, prediction);
      } else {
        report = this.reportGenerator.generateReport(analysis, currentModel, prediction);
      }

      return {
        analysis,
        prediction,
        report,
        model: currentModel
      };

    } catch (error) {
      console.error('❌ 分析失败:', error.message);
      throw error;
    }
  }

  /**
   * 列出可用模型
   */
  listAvailableModels() {
    const models = this.modelManager.getAvailableModels().map(name => {
      const model = this.modelManager.getModel(name);
      return {
        name,
        description: model.description,
        author: model.author,
        dimensions: model.dimensions
      };
    });

    return this.reportGenerator.generateModelList(models);
  }

  /**
   * 加载自定义模型文件
   * @param {string} filePath - 模型文件路径
   * @param {string} modelName - 模型名称
   */
  async loadCustomModel(filePath, modelName = null) {
    try {
      const name = await this.modelManager.loadModelFromFile(filePath, modelName);
      console.log(`✅ 自定义模型加载成功：${name}`);
      return name;
    } catch (error) {
      console.error(`❌ 自定义模型加载失败:`, error.message);
      throw error;
    }
  }

  /**
   * 获取模型信息
   * @param {string} modelName - 模型名称
   */
  getModelInfo(modelName) {
    const model = this.modelManager.getModel(modelName);
    if (!model) {
      throw new Error(`模型 '${modelName}' 不存在`);
    }
    return model;
  }
}

// 命令行界面
async function main() {
  const analyzer = new ViralContentAnalyzer();
  
  try {
    await analyzer.initialize();
  } catch (error) {
    console.error('初始化失败:', error.message);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  
  // 显示帮助
  if (args.includes('-h') || args.includes('--help')) {
    showHelp();
    return;
  }

  // 列出模型
  if (args.includes('-l') || args.includes('--list')) {
    console.log(analyzer.listAvailableModels());
    return;
  }

  // 加载自定义模型（优先级最高）
  const loadIndex = args.findIndex(arg => arg === '--load');
  if (loadIndex !== -1 && args[loadIndex + 1]) {
    const filePath = args[loadIndex + 1];
    const modelName = args[loadIndex + 2] || null;
    
    try {
      const loadedName = await analyzer.loadCustomModel(filePath, modelName);
      console.log(`✅ 模型加载完成：${loadedName}`);
      
      // 如果加载成功，立即使用测试内容演示
      const testContent = `刚刚看到一个令人震惊的视频！

一个普通的上班族，通过每天早起1小时学习新技能，仅仅用了6个月就成功转行，薪资翻倍！

他的秘诀很简单：
✅ 每天早上5点起床
✅ 学习2小时新技能
✅ 坚持180天不间断

现在的他，不仅收入翻倍，更重要的是找到了自己真正热爱的工作！

看完这个视频，我深受启发。原来改变自己并不难，难的是开始行动。

如果你也想改变现状，不妨从明天开始，给自己设定一个小目标，坚持下去！

你觉得这个方法怎么样？欢迎在评论区分享你的想法！

#个人成长 #职场转型 #学习方法 #自律 #改变`;
      
      console.log(`\n🎯 使用新模型 "${loadedName}" 进行测试：\n`);
      const result = await analyzer.analyzeContent(testContent, {
        modelName: loadedName,
        useAI: !args.includes('--no-ai'),
        simple: args.includes('--simple')
      });
      
      console.log(result.report);
      console.log(`\n✅ 模型 "${loadedName}" 加载并测试成功！`);
      console.log(`现在可以在其他命令中使用 -m ${loadedName} 来使用这个模型了。`);
    } catch (error) {
      console.error('模型加载失败:', error.message);
      process.exit(1);
    }
    return;
  }

  // 使用测试内容
  if (args.includes('-t') || args.includes('--test')) {
    const testContent = `刚刚看到一个令人震惊的视频！

一个普通的上班族，通过每天早起1小时学习新技能，仅仅用了6个月就成功转行，薪资翻倍！

他的秘诀很简单：
✅ 每天早上5点起床
✅ 学习2小时新技能
✅ 坚持180天不间断

现在的他，不仅收入翻倍，更重要的是找到了自己真正热爱的工作！

看完这个视频，我深受启发。原来改变自己并不难，难的是开始行动。

如果你也想改变现状，不妨从明天开始，给自己设定一个小目标，坚持下去！

你觉得这个方法怎么样？欢迎在评论区分享你的想法！

#个人成长 #职场转型 #学习方法 #自律 #改变`;

    try {
      const result = await analyzer.analyzeContent(testContent, {
        modelName: getModelName(args),
        useAI: !args.includes('--no-ai'),
        simple: args.includes('--simple')
      });
      
      console.log(result.report);
    } catch (error) {
      console.error('测试失败:', error.message);
      process.exit(1);
    }
    return;
  }

  // 分析文件
  const fileIndex = args.findIndex(arg => !arg.startsWith('-'));
  if (fileIndex !== -1) {
    const filePath = args[fileIndex];
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const result = await analyzer.analyzeContent(content, {
        modelName: getModelName(args),
        useAI: !args.includes('--no-ai'),
        simple: args.includes('--simple')
      });
      
      console.log(result.report);
    } catch (error) {
      console.error(`文件分析失败:`, error.message);
      process.exit(1);
    }
    return;
  }

  // 默认显示帮助
  showHelp();
}

/**
 * 从参数中获取模型名称
 */
function getModelName(args) {
  const modelIndex = args.findIndex(arg => arg === '-m' || arg === '--model');
  if (modelIndex !== -1 && args[modelIndex + 1]) {
    return args[modelIndex + 1];
  }
  return null;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
${'═══════════════════════════════════════'}
${'    📊 病毒传播内容分析工具'}
${'═══════════════════════════════════════'}

使用方法：
  node app.js [选项] [文件路径]

选项：
  -h, --help              显示帮助信息
  -l, --list              列出可用模型
  -t, --test              使用内置测试内容
  -m, --model <名称>      指定分析模型
  --load <路径> [名称]     加载自定义模型文件
  --no-ai                 禁用AI评分，使用关键词匹配
  --simple                生成简化报告

示例：
  # 使用默认模型分析文件
  node app.js input.md

  # 使用影响力模型分析
  node app.js -m influence input.md

  # 使用测试内容
  node app.js -t

  # 列出所有可用模型
  node app.js -l

  # 加载自定义模型
  node app.js --load my-model.json 我的模型

可用模型：
  viral-scoring    病毒传播内容评估模型（默认）
  influence        影响力六原则模型（罗伯特·西奥迪尼）
  contagious       疯传六原则模型（乔纳·伯杰）

环境变量：
  OPENAI_API_KEY    OpenAI API密钥（可选，用于AI评分）
`);
}

// 运行主程序
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('程序运行失败:', error.message);
    process.exit(1);
  });
}

export { ViralContentAnalyzer, main };