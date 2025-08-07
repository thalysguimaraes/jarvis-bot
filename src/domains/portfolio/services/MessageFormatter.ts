import { PortfolioCalculation } from '../types';
import { FundPortfolioCalculation } from '../../../legacy/modules/fund-tracker/types';

export interface IMessageFormatter {
  formatPortfolioMessage(
    stockData: PortfolioCalculation, 
    fundData?: FundPortfolioCalculation | null, 
    hasFunds?: boolean
  ): string;
}

export class PortfolioMessageFormatter implements IMessageFormatter {
  formatPortfolioMessage(
    stockData: PortfolioCalculation, 
    fundData?: FundPortfolioCalculation | null, 
    hasFunds: boolean = false
  ): string {
    const lines: string[] = [
      '📊 *RELATÓRIO DIÁRIO DO PORTFÓLIO*',
      `📅 ${new Date().toLocaleDateString('pt-BR')}`,
      '',
    ];

    // Stock section
    lines.push('📈 *AÇÕES*');
    lines.push(`💰 Valor Total: R$ ${this.formatNumber(stockData.currentValue)}`);
    lines.push(`📊 Custo Total: R$ ${this.formatNumber(stockData.totalCost)}`);
    lines.push('');
    
    lines.push('*Desempenho Diário:*');
    lines.push(`${this.getEmoji(stockData.dailyPnL)} R$ ${this.formatNumber(Math.abs(stockData.dailyPnL))} (${stockData.dailyPercentageChange >= 0 ? '+' : ''}${stockData.dailyPercentageChange.toFixed(2)}%)`);
    lines.push('');
    
    lines.push('*Desempenho Total:*');
    lines.push(`${this.getEmoji(stockData.totalPnL)} R$ ${this.formatNumber(Math.abs(stockData.totalPnL))} (${stockData.totalPercentageChange >= 0 ? '+' : ''}${stockData.totalPercentageChange.toFixed(2)}%)`);
    lines.push('');
    
    lines.push('*Posições:*');
    
    // Sort by position value (descending)
    const sortedDetails = [...stockData.details].sort((a, b) => b.position - a.position);
    
    for (const detail of sortedDetails) {
      if (detail.currentPrice !== null) {
        const emoji = this.getEmoji(detail.dailyChange);
        lines.push(`${emoji} ${detail.ticker}: R$ ${this.formatNumber(detail.position)} (${detail.dailyChangePercent >= 0 ? '+' : ''}${detail.dailyChangePercent.toFixed(2)}%)`);
      } else {
        lines.push(`❓ ${detail.ticker}: Sem cotação`);
      }
    }

    // Fund section if available
    if (hasFunds && fundData) {
      lines.push('');
      lines.push('💼 *FUNDOS DE INVESTIMENTO*');
      lines.push(`💰 Valor Total: R$ ${this.formatNumber(fundData.currentValue)}`);
      lines.push(`📊 Total Investido: R$ ${this.formatNumber(fundData.totalInvested)}`);
      lines.push('');
      
      lines.push('*Desempenho Total:*');
      lines.push(`${this.getEmoji(fundData.totalPerformance)} R$ ${this.formatNumber(Math.abs(fundData.totalPerformance))} (${fundData.totalPerformancePercent >= 0 ? '+' : ''}${fundData.totalPerformancePercent.toFixed(2)}%)`);
      lines.push('');
      
      if (fundData.positions.length > 0) {
        lines.push('*Posições:*');
        
        // Sort funds by current value (descending)
        const sortedFunds = [...fundData.positions].sort((a, b) => b.currentValue - a.currentValue);
        
        for (const fund of sortedFunds) {
          const emoji = this.getEmoji(fund.performance);
          const fundName = fund.name.length > 30 
            ? fund.name.substring(0, 27) + '...' 
            : fund.name;
          lines.push(`${emoji} ${fundName}`);
          lines.push(`   Valor: R$ ${this.formatNumber(fund.currentValue)} (${fund.performancePercent >= 0 ? '+' : ''}${fund.performancePercent.toFixed(2)}%)`);
        }
      }

      // Combined totals
      lines.push('');
      lines.push('📊 *RESUMO GERAL*');
      const totalValue = stockData.currentValue + fundData.currentValue;
      const totalInvested = stockData.totalCost + fundData.totalInvested;
      const totalPerformance = totalValue - totalInvested;
      const totalPerformancePercent = totalInvested > 0 ? (totalPerformance / totalInvested) * 100 : 0;
      
      lines.push(`💰 Patrimônio Total: R$ ${this.formatNumber(totalValue)}`);
      lines.push(`📊 Total Investido: R$ ${this.formatNumber(totalInvested)}`);
      lines.push(`${this.getEmoji(totalPerformance)} Lucro/Prejuízo: R$ ${this.formatNumber(Math.abs(totalPerformance))} (${totalPerformancePercent >= 0 ? '+' : ''}${totalPerformancePercent.toFixed(2)}%)`);
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