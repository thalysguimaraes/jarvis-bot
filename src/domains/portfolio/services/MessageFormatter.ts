import { PortfolioCalculation } from '../types';

export interface IMessageFormatter {
  formatPortfolioMessage(calculation: PortfolioCalculation, isInstant?: boolean): string;
}

export class PortfolioMessageFormatter implements IMessageFormatter {
  formatPortfolioMessage(calculation: PortfolioCalculation, isInstant: boolean = false): string {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    const lines: string[] = [
      isInstant 
        ? `📊 *RELATÓRIO DO PORTFÓLIO*`
        : '📊 *RELATÓRIO DIÁRIO DO PORTFÓLIO*',
      `📅 ${now.toLocaleDateString('pt-BR')} ${isInstant ? `às ${timeStr}` : ''}`,
      '',
    ];

    // Check if we have funds data
    const hasFunds = !!(calculation.funds && calculation.funds.length > 0);
    
    // Stock section - only show if we have stock positions
    if (calculation.details && calculation.details.length > 0) {
      const stockValue = hasFunds 
        ? calculation.currentValue - (calculation.fundsValue || 0)
        : calculation.currentValue;
      const stockCost = hasFunds
        ? calculation.totalCost - (calculation.fundsTotalCost || 0)
        : calculation.totalCost;
      const stockPnL = stockValue - stockCost;
      const stockPnLPercent = stockCost > 0 ? (stockPnL / stockCost) * 100 : 0;
        
      lines.push('📈 *AÇÕES*');
      lines.push(`💰 Valor Total: R$ ${this.formatNumber(stockValue)}`);
      lines.push(`📊 Custo Total: R$ ${this.formatNumber(stockCost)}`);
      lines.push(`${this.getEmoji(stockPnL)} Lucro/Prejuízo: R$ ${this.formatNumber(Math.abs(stockPnL))} (${stockPnLPercent >= 0 ? '+' : ''}${stockPnLPercent.toFixed(2)}%)`);
      lines.push('');
      
      if (!isInstant) {
        lines.push('*Desempenho Diário:*');
        lines.push(`${this.getEmoji(calculation.dailyPnL)} R$ ${this.formatNumber(Math.abs(calculation.dailyPnL))} (${calculation.dailyPercentageChange >= 0 ? '+' : ''}${calculation.dailyPercentageChange.toFixed(2)}%)`);
        lines.push('');
      }
      
      lines.push('*Posições:*');
      
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
}