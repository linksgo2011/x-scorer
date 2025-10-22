import 'dotenv/config';
import OpenAI from 'openai';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const client = new OpenAI();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 从模型文件加载评估维度
function loadViralDimensions() {
  try {
    // 优先使用简化的JSON模型文件
    const jsonModelPath = path.join(__dirname, 'viral-scoring-model-simple.json');
    if (fs.existsSync(jsonModelPath)) {
      const modelContent = fs.readFileSync(jsonModelPath, 'utf8');
      const model = JSON.parse(modelContent);
      if (model.dimensions && Object.keys(model.dimensions).length > 0) {
        console.log(chalk.green('✅ 成功加载JSON评估模型'));
        return model.dimensions;
      }
    }
    
    // 回退到Markdown模型文件
    const mdModelPath = path.join(__dirname, '流量密码评估模型.md');
    if (fs.existsSync(mdModelPath)) {
      const content = fs.readFileSync(mdModelPath, 'utf8');
      const dimensions = parseModelDimensions(content);
      if (dimensions && Object.keys(dimensions).length > 0) {
        console.log(chalk.green('✅ 成功加载Markdown评估模型'));
        return dimensions;
      }
    }
    
    throw new Error('无法加载任何评估模型文件');
  } catch (error) {
    console.log(chalk.red('❌ 加载评估模型失败:', error.message));
    throw error; // 不再使用内置规则，直接抛出错误
  }
}

// 解析模型文件中的维度定义（简化版本）
function parseModelDimensions(content) {
  const dimensions = {};
  
  try {
    // 查找所有维度定义
    const dimensionMatches = content.match(/### \d+\. \[?([🔥📈📖💬🗣️]?)\s*([^\(]+?)\s*(?:\(([^)]+)\))?/g);
    
    if (!dimensionMatches) {
      console.log(chalk.yellow('⚠️ 未找到维度定义'));
      return {};
    }
    
    dimensionMatches.forEach((match, index) => {
      try {
        const nameMatch = match.match(/### \d+\. \[?([🔥📈📖💬🗣️]?)\s*([^\(]+?)\s*(?:\(([^)]+)\))?/);
        if (nameMatch) {
          const dimensionName = nameMatch[2].trim();
          
          // 提取该维度的内容段落
          const startIndex = content.indexOf(match);
          const nextSectionIndex = content.indexOf('###', startIndex + 1);
          const sectionContent = nextSectionIndex > 0 ? 
            content.substring(startIndex, nextSectionIndex) : 
            content.substring(startIndex);
          
          // 提取权重
          const weightMatch = sectionContent.match(/权重[:：]\s*(\d+)%/);
          const weight = weightMatch ? parseInt(weightMatch[1]) / 100 : 0.2;
          
          // 提取关键词
          const keywords = extractKeywordsFromSection(sectionContent);
          const indicators = extractIndicatorsFromSection(sectionContent);
          
          const key = getDimensionKey(dimensionName);
          if (key) {
            dimensions[key] = {
              name: dimensionName,
              description: getDimensionDescription(dimensionName),
              keywords: keywords,
              indicators: indicators,
              weight: weight
            };
          }
        }
      } catch (dimError) {
        console.log(chalk.yellow(`⚠️ 解析维度 ${match} 失败: ${dimError.message}`));
      }
    });
    
    return dimensions;
  } catch (error) {
    console.log(chalk.yellow(`⚠️ 解析模型文件失败: ${error.message}`));
    return {};
  }
}

// 从章节内容提取关键词
function extractKeywordsFromSection(sectionContent) {
  const keywords = [];
  
  // 查找关键词库
  const keywordMatch = sectionContent.match(/关键词库[\s\S]*?```([\s\S]*?)```/);
  if (keywordMatch) {
    const keywordText = keywordMatch[1];
    const matches = keywordText.match(/[\u4e00-\u9fa5]+(?:\s*[\u4e00-\u9fa5]+)*/g);
    if (matches) {
      keywords.push(...matches.filter(word => word.length > 1));
    }
  }
  
  return [...new Set(keywords)];
}

// 从章节内容提取指标
function extractIndicatorsFromSection(sectionContent) {
  const indicators = [];
  
  // 查找互动钩子类型
  const hookMatch = sectionContent.match(/互动钩子类型[\s\S]*?```([\s\S]*?)```/);
  if (hookMatch) {
    const hookText = hookMatch[1];
    const matches = hookText.match(/[\u4e00-\u9fa5]+[^：]*?[：：]\s*([^\n]+)/g);
    if (matches) {
      matches.forEach(match => {
        const examples = match.split(/[：：]/)[1];
        if (examples) {
          indicators.push(...examples.split(/[,、]/).map(e => e.trim()).filter(e => e.length > 1));
        }
      });
    }
  }
  
  return [...new Set(indicators)];
}

// 获取维度键名
function getDimensionKey(name) {
  const keyMap = {
    '情绪共鸣度': 'emotionalTrigger',
    '争议性': 'controversy', 
    '共鸣度': 'relatability',
    '故事性': 'storytelling',
    '热点关联': 'hotTopic',
    '互动钩子': 'engagementHook'
  };
  
  for (let [key, value] of Object.entries(keyMap)) {
    if (name.includes(key)) return value;
  }
  
  return null;
}

// 获取维度描述
function getDimensionDescription(name) {
  const descMap = {
    '情绪共鸣度': '内容是否能激发强烈情绪反应',
    '争议性': '是否包含容易引发争议的对立话题',
    '共鸣度': '内容是否贴近大众生活，引发共鸣',
    '故事性': '是否有故事感，能吸引人继续阅读',
    '热点关联': '是否与当前热点话题相关',
    '互动钩子': '是否包含提问、制造悬念等互动元素'
  };
  
  for (let [key, value] of Object.entries(descMap)) {
    if (name.includes(key)) return value;
  }
  
  return '评估维度';
}

// 注意：getDefaultDimensions 函数已被移除
// 程序现在完全依赖外部模型文件，不再使用内置规则

// 使用OpenAI进行智能评分
async function calculateDimensionScoreWithAI(content, modelContent, dimension) {
  try {
    const prompt = `
    你是一个专业的社交媒体内容评估专家。请根据以下评估模型标准，对给定内容进行评分。
    
    评估维度：${dimension.name}
    维度描述：${dimension.description}
    
    评估标准：
    ${modelContent}
    
    请分析以下内容，给出${dimension.name}维度的评分（0-100分）和简要理由：
    
    内容："""
    ${content}
    """
    
    请以JSON格式回复，包含：
    {
      "score": 分数,
      "reason": "评分理由",
      "matched_elements": ["匹配到的元素1", "匹配到的元素2"]
    }
    `;

    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 200
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      score: result.score,
      matchedItems: result.matched_elements || [],
      reason: result.reason
    };
  } catch (error) {
    console.error(chalk.red(`AI评分失败: ${error.message}`));
    // 如果AI评分失败，回退到关键词匹配
    return calculateDimensionScoreFallback(content, dimension);
  }
}

// 关键词匹配评分（回退方案）
function calculateDimensionScoreFallback(content, dimension) {
  try {
    let score = 0;
    let matchedItems = [];
    
    console.log(chalk.gray(`🔍 使用回退方案评估维度: ${dimension.name}`));
    
    // 检查关键词匹配
    if (dimension.keywords && Array.isArray(dimension.keywords)) {
      dimension.keywords.forEach(keyword => {
        if (content.toLowerCase().includes(keyword.toLowerCase())) {
          score += 1;
          matchedItems.push(keyword);
        }
      });
    }
    
    // 检查指标匹配
    if (dimension.indicators && Array.isArray(dimension.indicators)) {
      dimension.indicators.forEach(indicator => {
        if (content.toLowerCase().includes(indicator.toLowerCase())) {
          score += 0.5;
          matchedItems.push(indicator);
        }
      });
    }
    
    // 计算最终得分 (0-100)
    const maxScore = dimension.keywords ? dimension.keywords.length : 0;
    const maxIndicators = dimension.indicators ? dimension.indicators.length * 0.5 : 0;
    const totalMax = maxScore + maxIndicators;
    
    const finalScore = totalMax > 0 ? Math.min(100, (score / totalMax) * 100) : 0;
    
    console.log(chalk.gray(`✅ 维度 ${dimension.name} 评分完成: ${Math.round(finalScore)}分`));
    
    return {
      score: finalScore,
      matchedItems: matchedItems,
      reason: "基于关键词匹配评分"
    };
  } catch (error) {
    console.error(chalk.red(`❌ 回退方案评分失败: ${error.message}`));
    return {
      score: 0,
      matchedItems: [],
      reason: "评分异常"
    };
  }
}

// 读取评估模型文档
function readModelDocument() {
  try {
    const modelPath = path.join(__dirname, '流量密码评估模型.md');
    if (!fs.existsSync(modelPath)) {
      console.log(chalk.yellow('⚠️ 评估模型文档不存在，使用内置规则'));
      return null;
    }
    
    const content = fs.readFileSync(modelPath, 'utf8');
    return content;
  } catch (error) {
    console.log(chalk.yellow('⚠️ 读取评估模型失败，使用内置规则'));
    return null;
  }
}

// 分析内容病毒传播潜力
async function analyzeContent(content, useAI = true) {
  try {
    console.log(chalk.blue('🔍 开始分析内容...'));
    
    // 加载评估维度
    const dimensions = loadViralDimensions();
    if (!dimensions || Object.keys(dimensions).length === 0) {
      throw new Error('无法加载评估维度，请检查模型文件');
    }
    
    console.log(chalk.gray(`📊 加载了 ${Object.keys(dimensions).length} 个评估维度`));
    
    // 读取模型文档内容用于AI评分
    const modelContent = readModelDocument();
    
    // 并行分析所有维度
    const dimensionPromises = Object.entries(dimensions).map(async ([key, dimension]) => {
      try {
        let score, reason, matchedItems;
        
        if (useAI && modelContent) {
          const aiResult = await calculateDimensionScoreWithAI(content, modelContent, dimension);
          score = aiResult.score;
          reason = aiResult.reason;
          matchedItems = aiResult.matchedItems || [];
        } else {
          const fallbackResult = calculateDimensionScoreFallback(content, dimension);
          score = fallbackResult.score;
          reason = fallbackResult.reason;
          matchedItems = fallbackResult.matchedItems || [];
        }
        
        // 确保有有效的评分结果
        if (score === null || score === undefined) {
          console.log(chalk.yellow(`⚠️ 维度 ${dimension.name} 评分为空，使用默认值`));
          score = 0;
          reason = '评分失败，使用默认值';
          matchedItems = [];
        }
        
        return {
          key,
          name: dimension.name,
          score: Math.max(0, Math.min(100, score)),
          weight: dimension.weight || 0.2,
          reason: reason || '未提供评分理由',
          matchedItems: matchedItems || []
        };
      } catch (dimError) {
        console.log(chalk.yellow(`⚠️ 分析维度 ${dimension.name} 失败: ${dimError.message}`));
        return {
          key,
          name: dimension.name,
          score: 0,
          weight: dimension.weight || 0.2,
          reason: `分析失败: ${dimError.message}`,
          matchedItems: []
        };
      }
    });
    
    const dimensionResults = await Promise.all(dimensionPromises);
    
    // 计算总分
    let totalScore = 0;
    let totalWeight = 0;
    
    dimensionResults.forEach(result => {
      console.log(chalk.gray(`📋 ${result.name}: ${result.score}分 (${result.weight * 100}%权重)`));
      totalScore += result.score * result.weight;
      totalWeight += result.weight;
    });
    
    if (totalWeight === 0) {
      throw new Error('总权重为0，无法计算得分');
    }
    
    const finalScore = Math.round(totalScore / totalWeight);
    
    return {
      score: finalScore,
      aiScoring: useAI && modelContent, // 标记是否使用了AI评分
      dimensions: dimensionResults.reduce((acc, result) => {
        acc[result.key] = {
          name: result.name,
          score: result.score,
          reason: result.reason,
          weight: result.weight,
          matchedItems: result.matchedItems
        };
        return acc;
      }, {})
    };
    
  } catch (error) {
    console.log(chalk.red('❌ 内容分析失败:', error.message));
    throw error;
  }
}

// 根据得分预测互动效果
function getEngagementPrediction(score) {
  if (score >= 80) return {
    level: '爆款潜力',
    description: '极高互动率，预计点赞转发评论都很高',
    color: 'red'
  };
  if (score >= 60) return {
    level: '高互动潜力',
    description: '较好互动率，会引发讨论和分享',
    color: 'yellow'
  };
  if (score >= 40) return {
    level: '中等互动',
    description: '有一定互动，但可能需要优化',
    color: 'cyan'
  };
  return {
    level: '低互动风险',
    description: '互动率较低，建议重新调整内容',
    color: 'gray'
  };
}

// 生成详细分析报告
function generateReport(content, analysis) {
  const prediction = analysis.prediction;
  
  let report = chalk.bold(`\n📊 推文流量潜力分析报告\n`);
  report += chalk.bold(`═`.repeat(40)) + '\n\n';
  
  // 显示评分方式
  if (analysis.aiScoring) {
    report += chalk.green('🤖 AI智能评分模式\n');
    report += chalk.gray('基于OpenAI模型和评估文档进行智能分析\n\n');
  } else {
    report += chalk.yellow('🔤 关键词匹配模式\n');
    report += chalk.gray('使用内置关键词规则进行评分\n\n');
  }
  
  const scoreColor = prediction.color;
  report += chalk.bold('整体评分: ') + chalk[scoreColor](`${analysis.score}/100`) + ` - ${prediction.level}\n`;
  report += chalk.bold('预测效果: ') + chalk[prediction.color](`${prediction.description}\n\n`);
  
  report += chalk.bold('详细维度分析:\n');
  report += chalk.bold('─'.repeat(30)) + '\n';
  
  Object.keys(analysis.dimensions).forEach(key => {
    const dim = analysis.dimensions[key];
    const scoreBar = '█'.repeat(Math.round(dim.score / 10)) + '░'.repeat(10 - Math.round(dim.score / 10));
    const dimColor = dim.score >= 70 ? 'green' : dim.score >= 40 ? 'yellow' : 'red';
    report += chalk.white(`\n${dim.name} (${(dim.weight * 100)}%权重)\n`);
    report += chalk[dimColor](`${scoreBar} ${dim.score}/100\n`);
    if (dim.matchedItems.length > 0) {
      report += chalk.gray(`匹配到: ${dim.matchedItems.join(', ')}\n`);
    }
    if (analysis.aiScoring && dim.reason) {
      report += chalk.blue(`评分理由: ${dim.reason}\n`);
    }
  });
  
  // 改进建议
  report += chalk.bold('\n💡 优化建议:\n');
  report += chalk.bold('─'.repeat(20)) + '\n';
  
  const suggestions = generateSuggestions(analysis);
  suggestions.forEach(suggestion => {
    report += chalk.white(`• ${suggestion}\n`);
  });
  
  // AI优化文案建议
  if (analysis.aiScoring) {
    report += chalk.bold('\n🤖 AI智能优化文案:\n');
    report += chalk.bold('═'.repeat(40)) + '\n';
    report += generateOptimizedContent(content, analysis);
  }
  
  return report;
}

// 生成改进建议（基于AI分析）
function generateSuggestions(analysis) {
  const suggestions = [];
  const dims = analysis.dimensions;
  
  // 情绪共鸣度建议
  if (dims.emotionalTrigger && dims.emotionalTrigger.score < 50) {
    if (analysis.aiScoring) {
      suggestions.push('🎯 情绪共鸣度偏低：建议加入更多能引发情绪共鸣的元素');
      suggestions.push('  • 添加个人焦虑、挣扎的真实感受描述');
      suggestions.push('  • 使用"35岁危机"、"失业恐慌"、"整夜失眠"等强烈情绪词');
      suggestions.push('  • 分享具体的失败经历或血泪教训');
      suggestions.push('  • 描述经济压力、家庭责任等现实困境');
    } else {
      suggestions.push('增加情绪触发元素，如"失业"、"赚钱"、"改命"等能引起共鸣的词汇');
    }
  }
  
  // 争议性建议
  if (dims.controversy && dims.controversy.score < 30) {
    if (analysis.aiScoring) {
      suggestions.push('🔥 争议性不足：内容过于平和，缺乏讨论引爆点');
      suggestions.push('  • 引入观点对立：如"奋斗VS躺平"、"大厂VS小厂"');
      suggestions.push('  • 挑战主流认知：提出与常识相悖的观点');
      suggestions.push('  • 技术对比争议：如"iPhone VS Android"、"MACOS VS WINDOWS"');
      suggestions.push('  • 加入"黑粉说"、"被骂也要说"等争议性表达');
    } else {
      suggestions.push('考虑加入一些争议性话题，如技术对比、观点对立等');
    }
  }
  
  // 故事性建议
  if (dims.storytelling && dims.storytelling.score < 40) {
    if (analysis.aiScoring) {
      suggestions.push('📖 故事性较弱：需要构建完整的故事结构');
      suggestions.push('  • 按时间线组织："去年...今年...现在..."');
      suggestions.push('  • 添加背景铺垫：交代时间、地点、人物背景');
      suggestions.push('  • 突出冲突转折：描述遇到的问题和解决过程');
      suggestions.push('  • 展示具体结果：用数字和成果证明改变');
      suggestions.push('  • 分享血泪教训：总结经验心得');
    } else {
      suggestions.push('添加个人经历或故事元素，让内容更有代入感');
    }
  }
  
  // 互动钩子建议
  if (dims.engagementHook && dims.engagementHook.score < 30) {
    if (analysis.aiScoring) {
      suggestions.push('💬 互动钩子不足：需要激发用户参与讨论');
      suggestions.push('  • 结尾直接提问："你怎么看？"、"有类似经历吗？"');
      suggestions.push('  • 制造悬念："想知道我是怎么做到的吗？"');
      suggestions.push('  • 寻求建议："如果是你会怎么做？"');
      suggestions.push('  • 邀请对比："你更支持哪种观点？"');
      suggestions.push('  • 引导分享："欢迎在评论区分享你的看法"');
    } else {
      suggestions.push('在结尾加入提问或互动引导，激发用户参与讨论');
    }
  }
  
  // 热点关联建议
  if (dims.hotTopic && dims.hotTopic.score < 40) {
    if (analysis.aiScoring) {
      suggestions.push('📈 热点关联度低：需要连接当前热门话题');
      suggestions.push('  • 蹭技术热点：AI、ChatGPT、提示词工程');
      suggestions.push('  • 结合社会现象：35岁危机、躺平文化');
      suggestions.push('  • 引用热门对比：一线城市VS二线城市');
      suggestions.push('  • 关联职场话题：996、裁员、创业');
    }
  }
  
  // 整体建议
  if (analysis.score < 40) {
    if (analysis.aiScoring) {
      suggestions.push('⚠️ 整体内容需要大幅调整：');
      suggestions.push('  • 避免纯理论输出，加入更多个人经历');
      suggestions.push('  • 用生活化比喻替代专业术语');
      suggestions.push('  • 站在普通人角度思考问题');
      suggestions.push('  • 增加具体数字和场景描述');
    } else {
      suggestions.push('整体内容偏学术化，建议更加通俗化、生活化');
    }
  }
  
  // 高质量内容建议
  if (analysis.score >= 70) {
    suggestions.push('🎉 内容质量优秀！建议：');
    suggestions.push('  • 保持当前的内容风格和结构');
    suggestions.push('  • 可以继续深化故事细节');
    suggestions.push('  • 适当增加争议性观点提升讨论度');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('✅ 内容质量很好，保持这种风格！');
  }
  
  return suggestions;
}

// 自动生成优化后文案
function generateOptimizedContent(originalContent, analysis) {
  const dims = analysis.dimensions;
  const hooks = [];
  const hotspots = [];
  const emotions = [];
  const stories = [];
  
  // 收集需要增强的要素
  if (dims.emotionalTrigger && dims.emotionalTrigger.score < 50) {
    emotions.push('35岁危机','失业恐慌','整夜失眠','焦虑到胃痛','偷偷在车里哭');
  }
  if (dims.controversy && dims.controversy.score < 30) {
    hooks.push('奋斗VS躺平','iPhone VS Android','黑粉说','被骂也要说');
  }
  if (dims.engagementHook && dims.engagementHook.score < 30) {
    hooks.push('你怎么看？','有类似经历吗？','如果是你会怎么做？');
  }
  if (dims.hotTopic && dims.hotTopic.score < 40) {
    hotspots.push('#35岁危机','#职场生存法则','#AI转型','#打工人');
  }
  
  let optimized = `📝 AI优化文案建议：\n`;
  optimized += `═══════════════════════════════════════\n\n`;
  optimized += `【标题钩子】\n`;
  optimized += `35岁被裁后，我靠自学AI提示词月入3万：那些没人告诉你的血泪真相\n\n`;
  optimized += `【正文框架】\n`;
  optimized += `去年今天，我还在大厂加班到凌晨2点；\n`;
  optimized += `今年3月，一纸裁员通知让我整夜失眠；\n`;
  optimized += `现在，我靠AI提示词接单，月入3万。\n\n`;
  optimized += `【情绪爆点】\n`;
  if (emotions.length) optimized += `关键词：${emotions.slice(0,3).join('、')}\n\n`;
  optimized += `【互动钩子】\n`;
  if (hooks.length) optimized += `结尾提问：${hooks[0] || '你怎么看？'}\n\n`;
  optimized += `【热点标签】\n`;
  if (hotspots.length) optimized += `${hotspots.slice(0,3).join(' ')}\n\n`;
  optimized += `【使用提示】\n`;
  optimized += `复制框架，替换你的真实经历即可发布！`;
  
  return optimized;
}

// 读取Markdown文件内容
function readMarkdownFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 简单的Markdown清理：移除标题标记和链接
    const cleanContent = content
      .replace(/^#+\s+/gm, '') // 移除标题标记
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接，保留文本
      .replace(/\*\*([^*]+)\*\*/g, '$1') // 移除粗体
      .replace(/\*([^*]+)\*/g, '$1') // 移除斜体
      .replace(/`([^`]+)`/g, '$1') // 移除行内代码
      .trim();
    
    return cleanContent;
  } catch (error) {
    console.error(chalk.red(`❌ 读取文件失败: ${error.message}`));
    process.exit(1);
  }
}

// 显示使用帮助
function showHelp() {
  console.log(chalk.bold.blue('📱 X流量密码评分工具\n'));
  console.log(chalk.white('使用方式:'));
  console.log(chalk.gray('  node index.js [选项] [文件路径]\n'));
  console.log(chalk.white('选项:'));
  console.log(chalk.gray('  -h, --help     显示帮助信息'));
  console.log(chalk.gray('  -t, --test     运行内置测试内容'));
  console.log(chalk.gray('  -f, --file     指定Markdown文件路径\n'));
  console.log(chalk.white('示例:'));
  console.log(chalk.gray('  node index.js -t                    # 运行测试内容'));
  console.log(chalk.gray('  node index.js -f ./post.md          # 分析指定文件'));
  console.log(chalk.gray('  node index.js ./post.md             # 直接分析文件\n'));
}

// 解析命令行参数
function parseArguments() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }
  
  if (args.includes('-t') || args.includes('--test')) {
    return { mode: 'test' };
  }
  
  let filePath = null;
  
  // 查找文件路径
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-f' || args[i] === '--file') && i + 1 < args.length) {
      filePath = args[i + 1];
      break;
    } else if (!args[i].startsWith('-')) {
      filePath = args[i];
      break;
    }
  }
  
  if (!filePath) {
    console.error(chalk.red('❌ 请提供文件路径'));
    showHelp();
    process.exit(1);
  }
  
  // 如果是相对路径，转换为绝对路径
  if (!path.isAbsolute(filePath)) {
    filePath = path.join(process.cwd(), filePath);
  }
  
  return { mode: 'file', filePath };
}

// 主函数
async function analyzeViralPotential(content, source = '命令行输入') {
  console.log(chalk.blue(`🚀 开始分析推文流量潜力... (${source})`));
  
  const analysis = await analyzeContent(content);
  
  // 添加预测结果
  analysis.prediction = getEngagementPrediction(analysis.score);
  
  const report = generateReport(content, analysis);
  
  console.log(report);
  
  return analysis;
}

// 测试内容
const testContent = `
35岁程序员失业后，靠自学AI提示词月入3万，他是怎么做到的？

大厂裁员潮下，很多35岁的程序员都面临失业危机。但是有位朋友却通过自学AI提示词，不仅成功转行，还实现了月入3万的目标。

他的经验告诉我：
1. 不要局限于传统的编程思维
2. AI时代，提示词就是新的编程语言
3. 抓住风口比努力更重要

你们觉得在AI时代，程序员应该如何转型？欢迎在评论区分享你的看法。
`;

// 主程序入口
async function main() {
  const config = parseArguments();
  
  try {
    if (config.mode === 'test') {
      // 运行测试内容
      console.log(chalk.green('📝 测试内容:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(testContent);
      console.log(chalk.gray('─'.repeat(50)));
      
      await analyzeViralPotential(testContent, '内置测试');
    } else if (config.mode === 'file') {
      // 从文件读取内容
      console.log(chalk.blue(`📖 正在读取文件: ${config.filePath}`));
      const content = readMarkdownFile(config.filePath);
      
      console.log(chalk.green('📝 文件内容:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(content.length > 500 ? content.substring(0, 500) + '...' : content);
      console.log(chalk.gray('─'.repeat(50)));
      
      await analyzeViralPotential(content, path.basename(config.filePath));
    }
  } catch (error) {
    console.error(chalk.red(`❌ 程序执行失败: ${error.message}`));
    process.exit(1);
  }
}

// 运行主程序
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}