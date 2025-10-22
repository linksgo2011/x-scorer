class ReportGenerator {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };
  }

  /**
   * 生成分析报告
   * @param {Object} analysis - 分析结果
   * @param {Object} model - 模型信息
   * @param {Object} prediction - 传播预测
   */
  generateReport(analysis, model, prediction) {
    const report = [];
    
    // 报告头部
    report.push(this.generateHeader(model));
    
    // 总体评分
    report.push(this.generateOverallScore(analysis, prediction));
    
    // 维度详细分析
    report.push(this.generateDimensionAnalysis(analysis));
    
    // 优化建议
    report.push(this.generateSuggestions(analysis));
    
    // AI优化文案
    if (analysis.aiScoring) {
      report.push(this.generateOptimizedContent(analysis));
    }
    
    return report.join('\n\n');
  }

  /**
   * 生成报告头部
   * @param {Object} model - 模型信息
   */
  generateHeader(model) {
    const lines = [];
    
    lines.push(`${this.colors.cyan}${this.colors.bright}═══════════════════════════════════════${this.colors.reset}`);
    lines.push(`${this.colors.cyan}${this.colors.bright}    📊 内容传播潜力分析报告${this.colors.reset}`);
    lines.push(`${this.colors.cyan}${this.colors.bright}═══════════════════════════════════════${this.colors.reset}`);
    
    if (model) {
      lines.push(`${this.colors.dim}分析模型：${this.colors.reset}${model.name || '默认模型'}`);
      if (model.description) {
        lines.push(`${this.colors.dim}模型描述：${this.colors.reset}${model.description}`);
      }
      if (model.author) {
        lines.push(`${this.colors.dim}模型作者：${this.colors.reset}${model.author}`);
      }
    }
    
    lines.push(`${this.colors.dim}分析时间：${this.colors.reset}${new Date().toLocaleString('zh-CN')}`);
    
    return lines.join('\n');
  }

  /**
   * 生成总体评分
   * @param {Object} analysis - 分析结果
   * @param {Object} prediction - 传播预测
   */
  generateOverallScore(analysis, prediction) {
    const lines = [];
    
    lines.push(`${this.colors.bright}📈 总体评分${this.colors.reset}`);
    lines.push(`${this.colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${this.colors.reset}`);
    
    // 分数显示
    const scoreColor = analysis.score >= 80 ? this.colors.green : 
                      analysis.score >= 60 ? this.colors.yellow : this.colors.red;
    
    lines.push(`${scoreColor}${this.colors.bright}总分：${analysis.score}/100${this.colors.reset}`);
    
    // 预测信息
    if (prediction) {
      lines.push(`${prediction.color}${this.colors.bright}传播潜力：${prediction.level}${this.colors.reset}`);
      lines.push(`${this.colors.dim}${prediction.description}${this.colors.reset}`);
    }
    
    // AI评分标识
    if (analysis.aiScoring) {
      lines.push(`${this.colors.cyan}🤖 AI智能评分${this.colors.reset}`);
    } else {
      lines.push(`${this.colors.dim}📋 关键词匹配评分${this.colors.reset}`);
    }
    
    return lines.join('\n');
  }

  /**
   * 生成维度详细分析
   * @param {Object} analysis - 分析结果
   */
  generateDimensionAnalysis(analysis) {
    const lines = [];
    
    lines.push(`${this.colors.bright}🔍 维度详细分析${this.colors.reset}`);
    lines.push(`${this.colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${this.colors.reset}`);
    
    Object.entries(analysis.dimensions).forEach(([key, dimension]) => {
      const scoreColor = dimension.score >= 80 ? this.colors.green : 
                        dimension.score >= 60 ? this.colors.yellow : this.colors.red;
      
      lines.push(`\n${this.colors.bright}${dimension.name || key}${this.colors.reset}`);
      lines.push(`${scoreColor}分数：${dimension.score}/100${this.colors.reset}`);
      lines.push(`${this.colors.dim}分析：${this.colors.reset}${dimension.analysis}`);
      
      if (dimension.keywords && dimension.keywords.length > 0) {
        lines.push(`${this.colors.dim}关键词：${this.colors.reset}${dimension.keywords.join('、')}`);
      }
      
      if (dimension.aiGenerated) {
        lines.push(`${this.colors.cyan}🤖 AI分析${this.colors.reset}`);
      } else {
        lines.push(`${this.colors.dim}📋 关键词匹配${this.colors.reset}`);
      }
    });
    
    return lines.join('\n');
  }

  /**
   * 生成优化建议
   * @param {Object} analysis - 分析结果
   */
  generateSuggestions(analysis) {
    const lines = [];
    
    lines.push(`${this.colors.bright}💡 优化建议${this.colors.reset}`);
    lines.push(`${this.colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${this.colors.reset}`);
    
    const allSuggestions = [];
    
    Object.entries(analysis.dimensions).forEach(([key, dimension]) => {
      if (dimension.score < 80 && dimension.suggestions && dimension.suggestions.length > 0) {
        allSuggestions.push({
          dimension: dimension.name || key,
          score: dimension.score,
          suggestions: dimension.suggestions
        });
      }
    });
    
    if (allSuggestions.length === 0) {
      lines.push(`${this.colors.green}✨ 内容质量优秀，暂无需优化建议${this.colors.reset}`);
      return lines.join('\n');
    }
    
    // 按分数排序（从低到高）
    allSuggestions.sort((a, b) => a.score - b.score);
    
    allSuggestions.forEach((item, index) => {
      lines.push(`\n${index + 1}. ${this.colors.bright}${item.dimension}（${item.score}/100）${this.colors.reset}`);
      item.suggestions.forEach((suggestion, sIndex) => {
        lines.push(`   ${this.colors.dim}${sIndex + 1})${this.colors.reset} ${suggestion}`);
      });
    });
    
    return lines.join('\n');
  }

  /**
   * 生成AI优化文案
   * @param {Object} analysis - 分析结果
   */
  generateOptimizedContent(analysis) {
    const lines = [];
    
    lines.push(`${this.colors.bright}🤖 AI智能优化文案${this.colors.reset}`);
    lines.push(`${this.colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${this.colors.reset}`);
    
    if (analysis.optimizedContent) {
      lines.push(`${this.colors.cyan}优化建议：${this.colors.reset}`);
      lines.push(analysis.optimizedContent);
    } else {
      lines.push(`${this.colors.dim}基于分析结果，建议从以下方面优化：${this.colors.reset}`);
      
      const suggestions = [];
      Object.entries(analysis.dimensions).forEach(([key, dimension]) => {
        if (dimension.score < 70 && dimension.suggestions) {
          suggestions.push(...dimension.suggestions.slice(0, 2));
        }
      });
      
      if (suggestions.length > 0) {
        suggestions.forEach((suggestion, index) => {
          lines.push(`${index + 1}. ${suggestion}`);
        });
      } else {
        lines.push(`${this.colors.green}内容已经很棒了！${this.colors.reset}`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * 生成简化报告（用于命令行显示）
   * @param {Object} analysis - 分析结果
   * @param {Object} prediction - 传播预测
   */
  generateSimpleReport(analysis, prediction) {
    const lines = [];
    
    lines.push(`${this.colors.bright}📊 内容分析结果${this.colors.reset}`);
    lines.push(`${prediction.color}总分：${analysis.score}/100 | 传播潜力：${prediction.level}${this.colors.reset}`);
    
    // 显示各维度分数
    const dimensionScores = Object.entries(analysis.dimensions)
      .map(([key, dim]) => `${dim.name}: ${dim.score}`)
      .join(' | ');
    
    lines.push(`${this.colors.dim}${dimensionScores}${this.colors.reset}`);
    
    return lines.join('\n');
  }

  /**
   * 显示可用模型列表
   * @param {Array} models - 模型列表
   */
  generateModelList(models) {
    const lines = [];
    
    lines.push(`${this.colors.bright}📚 可用传播学模型${this.colors.reset}`);
    lines.push(`${this.colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${this.colors.reset}`);
    
    models.forEach((model, index) => {
      lines.push(`\n${index + 1}. ${this.colors.bright}${model.name}${this.colors.reset}`);
      if (model.description) {
        lines.push(`   ${this.colors.dim}${model.description}${this.colors.reset}`);
      }
      if (model.author) {
        lines.push(`   ${this.colors.dim}作者：${model.author}${this.colors.reset}`);
      }
      if (model.dimensions && model.dimensions.length > 0) {
        lines.push(`   ${this.colors.dim}维度数量：${model.dimensions.length}${this.colors.reset}`);
      }
    });
    
    return lines.join('\n');
  }
}

export { ReportGenerator };