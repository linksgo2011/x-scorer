import { OpenAI } from 'openai';

class ContentAnalyzer {
  constructor(openaiClient = null) {
    this.openai = openaiClient;
  }

  /**
   * 分析内容
   * @param {string} content - 要分析的内容
   * @param {Array} dimensions - 评估维度
   * @param {Object} options - 分析选项
   */
  async analyzeContent(content, dimensions, options = {}) {
    const {
      useAI = true,
      aiScoring = true,
      modelName = 'gpt-3.5-turbo'
    } = options;

    const analysis = {
      content,
      dimensions: {},
      scores: {},
      score: 0,
      maxScore: 0,
      aiScoring: useAI && aiScoring
    };

    // 并行分析所有维度
    const dimensionPromises = dimensions.map(async (dimension) => {
      try {
        const result = await this.analyzeDimension(content, dimension, useAI && aiScoring);
        return { dimension, result };
      } catch (error) {
        console.warn(`分析维度 "${dimension.name}" 失败:`, error.message);
        // 回退到关键词匹配
        return {
          dimension,
          result: this.calculateDimensionScoreFallback(content, dimension)
        };
      }
    });

    const results = await Promise.all(dimensionPromises);

    // 汇总结果
    results.forEach(({ dimension, result }) => {
      analysis.dimensions[dimension.key] = result;
      analysis.scores[dimension.key] = result.score;
      analysis.score += result.score * dimension.weight;
      analysis.maxScore += 100 * dimension.weight;
    });

    // 计算总分（0-100）
    analysis.score = Math.round((analysis.score / analysis.maxScore) * 100);

    return analysis;
  }

  /**
   * 分析单个维度
   * @param {string} content - 内容
   * @param {Object} dimension - 维度定义
   * @param {boolean} useAI - 是否使用AI评分
   */
  async analyzeDimension(content, dimension, useAI) {
    if (useAI && this.openai) {
      return await this.calculateDimensionScoreWithAI(content, dimension);
    } else {
      return this.calculateDimensionScoreFallback(content, dimension);
    }
  }

  /**
   * 使用AI计算维度分数
   * @param {string} content - 内容
   * @param {Object} dimension - 维度定义
   */
  async calculateDimensionScoreWithAI(content, dimension) {
    const prompt = this.buildAnalysisPrompt(content, dimension);
    
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的内容传播分析师。请根据提供的维度和指标，客观评估内容的质量，并给出具体的分数和改进建议。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const response = completion.choices[0].message.content;
    return this.parseAIResponse(response, dimension);
  }

  /**
   * 构建分析提示
   * @param {string} content - 内容
   * @param {Object} dimension - 维度定义
   */
  buildAnalysisPrompt(content, dimension) {
    return `请分析以下内容在"${dimension.name}"维度上的表现：

内容：
${content}

维度描述：${dimension.description}

评估指标：
${dimension.indicators.map(indicator => `- ${indicator}`).join('\n')}

关键词参考：${dimension.keywords.join('、')}

请给出：
1. 分数（0-100分）
2. 具体的分析理由
3. 改进建议

请按以下格式回复：
分数：[分数]
分析：[分析内容]
建议：[改进建议]`;
  }

  /**
   * 解析AI响应
   * @param {string} response - AI响应
   * @param {Object} dimension - 维度定义
   */
  parseAIResponse(response, dimension) {
    const scoreMatch = response.match(/分数[:：]\s*(\d+)/);
    const analysisMatch = response.match(/分析[:：]\s*([\s\S]*?)(?:建议[:：]|$)/);
    const suggestionMatch = response.match(/建议[:：]\s*([\s\S]*?)$/);

    const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;
    const analysis = analysisMatch ? analysisMatch[1].trim() : 'AI分析失败';
    const suggestions = suggestionMatch ? suggestionMatch[1].trim().split(/[\n。]/).filter(s => s.trim()) : ['建议优化内容'];

    return {
      score: Math.max(0, Math.min(100, score)),
      analysis,
      suggestions,
      keywords: this.extractKeywordsFromAnalysis(response, dimension.keywords),
      aiGenerated: true
    };
  }

  /**
   * 关键词匹配回退方案
   * @param {string} content - 内容
   * @param {Object} dimension - 维度定义
   */
  calculateDimensionScoreFallback(content, dimension) {
    const contentLower = content.toLowerCase();
    const foundKeywords = [];
    let keywordScore = 0;

    // 关键词匹配
    dimension.keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      const count = (contentLower.match(new RegExp(keywordLower, 'g')) || []).length;
      if (count > 0) {
        foundKeywords.push(keyword);
        keywordScore += Math.min(count * 15, 60); // 每个关键词最多贡献60分
      }
    });

    // 指标匹配
    let indicatorScore = 0;
    dimension.indicators.forEach(indicator => {
      const indicatorKeywords = indicator.toLowerCase().split(/[\s\-，,]+/);
      const matches = indicatorKeywords.filter(keyword => 
        contentLower.includes(keyword) && keyword.length > 1
      );
      if (matches.length > 0) {
        indicatorScore += Math.min(matches.length * 10, 40); // 每个指标最多贡献40分
      }
    });

    const finalScore = Math.min(keywordScore + indicatorScore, 100);

    return {
      score: finalScore,
      analysis: this.generateFallbackAnalysis(content, dimension, foundKeywords, finalScore),
      suggestions: this.generateFallbackSuggestions(dimension, foundKeywords, finalScore),
      keywords: foundKeywords,
      aiGenerated: false
    };
  }

  /**
   * 生成回退分析
   * @param {string} content - 内容
   * @param {Object} dimension - 维度定义
   * @param {Array} foundKeywords - 找到的关键词
   * @param {number} score - 分数
   */
  generateFallbackAnalysis(content, dimension, foundKeywords, score) {
    let analysis = `基于关键词匹配分析，内容在"${dimension.name}"维度上`;
    
    if (score >= 80) {
      analysis += '表现优秀，';
    } else if (score >= 60) {
      analysis += '表现良好，';
    } else if (score >= 40) {
      analysis += '表现一般，';
    } else {
      analysis += '需要改进，';
    }

    if (foundKeywords.length > 0) {
      analysis += `匹配到关键词：${foundKeywords.join('、')}。`;
    } else {
      analysis += '未匹配到相关关键词。';
    }

    analysis += ` ${dimension.description}`;
    return analysis;
  }

  /**
   * 生成回退建议
   * @param {Object} dimension - 维度定义
   * @param {Array} foundKeywords - 找到的关键词
   * @param {number} score - 分数
   */
  generateFallbackSuggestions(dimension, foundKeywords, score) {
    const suggestions = [];

    if (score < 60) {
      suggestions.push(`增加更多与"${dimension.name}"相关的关键词`);
      if (dimension.keywords.length > 0) {
        const missingKeywords = dimension.keywords.filter(kw => !foundKeywords.includes(kw));
        if (missingKeywords.length > 0) {
          suggestions.push(`考虑加入：${missingKeywords.slice(0, 3).join('、')}`);
        }
      }
    }

    if (score < 80) {
      suggestions.push(`强化${dimension.name}的表现形式`);
    }

    if (suggestions.length === 0) {
      suggestions.push('继续保持当前的内容质量');
    }

    return suggestions;
  }

  /**
   * 从分析中提取关键词
   * @param {string} analysis - 分析文本
   * @param {Array} referenceKeywords - 参考关键词
   */
  extractKeywordsFromAnalysis(analysis, referenceKeywords) {
    const foundKeywords = [];
    const analysisLower = analysis.toLowerCase();
    
    referenceKeywords.forEach(keyword => {
      if (analysisLower.includes(keyword.toLowerCase())) {
        foundKeywords.push(keyword);
      }
    });

    return foundKeywords;
  }

  /**
   * 获取参与度预测
   * @param {number} score - 总分
   * @param {Object} scoringConfig - 评分配置
   */
  getEngagementPrediction(score, scoringConfig = {}) {
    const { highScore = 80, mediumScore = 60 } = scoringConfig;

    if (score >= highScore) {
      return {
        level: '高',
        description: '内容具有很强的传播潜力，预计会获得大量互动',
        color: '\x1b[32m' // 绿色
      };
    } else if (score >= mediumScore) {
      return {
        level: '中',
        description: '内容有一定传播潜力，预计会获得适量互动',
        color: '\x1b[33m' // 黄色
      };
    } else {
      return {
        level: '低',
        description: '内容传播潜力有限，需要优化以提升互动',
        color: '\x1b[31m' // 红色
      };
    }
  }
}

export { ContentAnalyzer };