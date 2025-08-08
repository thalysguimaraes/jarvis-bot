import { PortfolioCalculation } from '../types';

export interface IMessageFormatter {
  formatPortfolioMessage(calculation: PortfolioCalculation, isInstant?: boolean): string;
}

export class PortfolioMessageFormatter implements IMessageFormatter {
  formatPortfolioMessage(calculation: PortfolioCalculation, isInstant: boolean = false): string {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // For instant reports, use a more focused format
    if (isInstant) {
      return this.formatInstantReport(calculation, now, timeStr);
    }
    
    // Regular scheduled report format - also focus on daily performance
    const lines: string[] = [
      '📊 *RELATÓRIO DIÁRIO DO PORTFÓLIO*',
      `📅 ${now.toLocaleDateString('pt-BR')}`,
      '',
    ];

    // Current value and daily performance first
    lines.push(`💼 *VALOR DO PORTFÓLIO: R$ ${this.formatNumber(calculation.currentValue)}*`);
    lines.push('');
    
    // Daily performance prominently displayed
    const dailyEmoji = this.getEmoji(calculation.dailyPnL);
    lines.push('📈 *DESEMPENHO HOJE*');
    lines.push(`${dailyEmoji} Variação do Dia: R$ ${this.formatNumber(Math.abs(calculation.dailyPnL))} (${calculation.dailyPercentageChange >= 0 ? '+' : ''}${calculation.dailyPercentageChange.toFixed(2)}%)`);
    
    // Count ups and downs
    const upsAndDowns = this.countUpsAndDowns(calculation.details);
    if (upsAndDowns.total > 0) {
      lines.push(`📊 Movimento: ${upsAndDowns.up}↑ ${upsAndDowns.down}↓ ${upsAndDowns.unchanged}→`);
    }
    lines.push('');

    // Check if we have funds data
    const hasFunds = !!(calculation.funds && calculation.funds.length > 0);
    
    // Stock section - only show if we have stock positions
    if (calculation.details && calculation.details.length > 0) {
      lines.push('📈 *AÇÕES - Variação do Dia*');
      
      // Sort by position value (descending)
      const sortedDetails = [...calculation.details].sort((a, b) => b.position - a.position);
      
      for (const detail of sortedDetails) {
        if (detail.currentPrice !== null) {
          const emoji = this.getEmoji(detail.dailyChange);
          lines.push(`${emoji} ${detail.ticker}: R$ ${this.formatNumber(detail.position)} (${detail.dailyChangePercent >= 0 ? '+' : ''}${detail.dailyChangePercent.toFixed(2)}%)`);
        } else {
          lines.push(`❓ ${detail.ticker}: Sem cotação`);
        }
      }
    }

    // Fund section if available
    if (hasFunds && calculation.funds) {
      lines.push('');
      lines.push('💼 *FUNDOS DE INVESTIMENTO*');
      lines.push(`💰 Valor Total: R$ ${this.formatNumber(calculation.fundsValue || 0)}`);
      lines.push(`📊 Total Investido: R$ ${this.formatNumber(calculation.fundsTotalCost || 0)}`);
      
      const fundsPnL = calculation.fundsPnL || 0;
      const fundsPnLPercent = (calculation.fundsTotalCost || 0) > 0 
        ? (fundsPnL / (calculation.fundsTotalCost || 1)) * 100 
        : 0;
      
      lines.push(`${this.getEmoji(fundsPnL)} Lucro/Prejuízo: R$ ${this.formatNumber(Math.abs(fundsPnL))} (${fundsPnLPercent >= 0 ? '+' : ''}${fundsPnLPercent.toFixed(2)}%)`);
      lines.push('');
      
      if (calculation.funds.length > 0) {
        lines.push('*Posições:*');
        
        // Sort funds by current value (descending)
        const sortedFunds = [...calculation.funds].sort((a, b) => 
          (b.currentValue || 0) - (a.currentValue || 0)
        );
        
        for (const fund of sortedFunds) {
          const performance = fund.performance || 0;
          const performancePercent = fund.performancePercent || 0;
          const emoji = this.getEmoji(performance);
          const fundName = fund.name.length > 30 
            ? fund.name.substring(0, 27) + '...' 
            : fund.name;
          lines.push(`${emoji} ${fundName}`);
          lines.push(`   Valor: R$ ${this.formatNumber(fund.currentValue || 0)} (${performancePercent >= 0 ? '+' : ''}${performancePercent.toFixed(2)}%)`);
        }
      }
    }

    // Combined totals
    if (hasFunds || (calculation.details && calculation.details.length > 0)) {
      lines.push('');
      lines.push('📊 *RESUMO GERAL*');
      lines.push(`💰 Patrimônio Total: R$ ${this.formatNumber(calculation.currentValue)}`);
      lines.push(`📊 Total Investido: R$ ${this.formatNumber(calculation.totalCost)}`);
      lines.push(`${this.getEmoji(calculation.totalPnL)} Lucro/Prejuízo: R$ ${this.formatNumber(Math.abs(calculation.totalPnL))} (${calculation.totalPercentageChange >= 0 ? '+' : ''}${calculation.totalPercentageChange.toFixed(2)}%)`);
    }
    
    lines.push('');
    lines.push('_Atualizado via Jarvis Bot_ 🤖');
    
    return lines.join('\n');
  }

  private formatNumber(value: number): string {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private getEmoji(value: number): string {
    if (value > 0) return '🟢';
    if (value < 0) return '🔴';
    return '⚪';
  }

  private formatInstantReport(calculation: PortfolioCalculation, now: Date, timeStr: string): string {
    const lines: string[] = [
      '📊 *PORTFÓLIO AGORA*',
      `📅 ${now.toLocaleDateString('pt-BR')} às ${timeStr}`,
      '',
    ];

    // Current portfolio value prominently displayed
    lines.push(`💼 *VALOR ATUAL: R$ ${this.formatNumber(calculation.currentValue)}*`);
    lines.push('');

    // Daily performance section
    const dailyEmoji = this.getEmoji(calculation.dailyPnL);
    const dailyPercent = calculation.dailyPercentageChange;
    
    lines.push('📈 *DESEMPENHO HOJE*');
    lines.push(`${dailyEmoji} Variação: R$ ${this.formatNumber(Math.abs(calculation.dailyPnL))} (${dailyPercent >= 0 ? '+' : ''}${dailyPercent.toFixed(2)}%)`);
    
    // Count ups and downs
    const upsAndDowns = this.countUpsAndDowns(calculation.details);
    if (upsAndDowns.total > 0) {
      lines.push(`📊 ${upsAndDowns.up}↑ ${upsAndDowns.down}↓ ${upsAndDowns.unchanged}→`);
    }
    lines.push('');

    // Top movers section (show only top 5 gainers and losers)
    const topMovers = this.getTopMovers(calculation.details, 5);
    
    if (topMovers.gainers.length > 0) {
      lines.push('*🟢 Maiores Altas:*');
      for (const mover of topMovers.gainers) {
        lines.push(`${mover.ticker}: ${mover.dailyChangePercent >= 0 ? '+' : ''}${mover.dailyChangePercent.toFixed(2)}% (R$ ${this.formatNumber(Math.abs(mover.dailyChange))})`);
      }
      lines.push('');
    }

    if (topMovers.losers.length > 0) {
      lines.push('*🔴 Maiores Quedas:*');
      for (const mover of topMovers.losers) {
        lines.push(`${mover.ticker}: ${mover.dailyChangePercent >= 0 ? '+' : ''}${mover.dailyChangePercent.toFixed(2)}% (R$ ${this.formatNumber(Math.abs(mover.dailyChange))})`);
      }
      lines.push('');
    }

    // Compact position list (show top 10 by value)
    const sortedPositions = [...calculation.details]
      .filter(d => d.currentPrice !== null)
      .sort((a, b) => b.position - a.position)
      .slice(0, 10);

    if (sortedPositions.length > 0) {
      lines.push('*💰 PRINCIPAIS POSIÇÕES*');
      for (const detail of sortedPositions) {
        const emoji = this.getEmoji(detail.dailyChange);
        const value = this.formatCompactNumber(detail.position);
        lines.push(`${emoji} ${detail.ticker}: R$ ${value} (${detail.dailyChangePercent >= 0 ? '+' : ''}${detail.dailyChangePercent.toFixed(2)}%)`);
      }
      
      if (calculation.details.length > 10) {
        lines.push(`_...e mais ${calculation.details.length - 10} ativos_`);
      }
      lines.push('');
    }

    // Add funds summary if available
    if (calculation.funds && calculation.funds.length > 0) {
      lines.push('💼 *FUNDOS: R$ ' + this.formatNumber(calculation.fundsValue || 0) + '*');
      const fundsPnL = calculation.fundsPnL || 0;
      const fundsPnLPercent = (calculation.fundsTotalCost || 0) > 0 
        ? (fundsPnL / (calculation.fundsTotalCost || 1)) * 100 
        : 0;
      lines.push(`${this.getEmoji(fundsPnL)} Resultado: ${fundsPnLPercent >= 0 ? '+' : ''}${fundsPnLPercent.toFixed(2)}%`);
      lines.push('');
    }

    // All-time performance at the bottom (less emphasis)
    lines.push('_Desempenho Total:_');
    lines.push(`_Investido: R$ ${this.formatNumber(calculation.totalCost)}_`);
    lines.push(`_Resultado: R$ ${this.formatNumber(Math.abs(calculation.totalPnL))} (${calculation.totalPercentageChange >= 0 ? '+' : ''}${calculation.totalPercentageChange.toFixed(2)}%)_`);
    
    lines.push('');
    lines.push('💬 _Digite "portfolio completo" para relatório detalhado_');
    lines.push('_Atualizado via Jarvis Bot_ 🤖');
    
    return lines.join('\n');
  }

  private countUpsAndDowns(details: PortfolioCalculation['details']): { up: number; down: number; unchanged: number; total: number } {
    let up = 0, down = 0, unchanged = 0;
    
    for (const detail of details) {
      if (detail.currentPrice === null) continue;
      if (detail.dailyChange > 0) up++;
      else if (detail.dailyChange < 0) down++;
      else unchanged++;
    }
    
    return { up, down, unchanged, total: up + down + unchanged };
  }

  private getTopMovers(details: PortfolioCalculation['details'], limit: number = 5) {
    const validDetails = details.filter(d => d.currentPrice !== null);
    
    const gainers = validDetails
      .filter(d => d.dailyChangePercent > 0)
      .sort((a, b) => b.dailyChangePercent - a.dailyChangePercent)
      .slice(0, limit);
    
    const losers = validDetails
      .filter(d => d.dailyChangePercent < 0)
      .sort((a, b) => a.dailyChangePercent - b.dailyChangePercent)
      .slice(0, limit);
    
    return { gainers, losers };
  }

  private formatCompactNumber(value: number): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return this.formatNumber(value);
  }
}