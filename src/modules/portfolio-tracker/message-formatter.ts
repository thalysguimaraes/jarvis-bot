import { PortfolioCalculation } from './types';
import { FundCalculation } from '../fund-tracker/types';

export function formatPortfolioMessage(
  stocksData: PortfolioCalculation, 
  fundsData: FundCalculation | null = null, 
  hasFunds: boolean = false
): string {
  // Calculate combined totals if funds are included
  let combinedCurrentValue, combinedTotalCost, combinedDailyPnL, combinedTotalPnL;
  let combinedDailyPercentageChange, combinedTotalPercentageChange;

  if (hasFunds && fundsData) {
    combinedCurrentValue = stocksData.currentValue + fundsData.currentValue;
    combinedTotalCost = stocksData.totalCost + fundsData.totalCost;
    combinedDailyPnL = stocksData.dailyPnL + fundsData.dailyPnL;
    combinedTotalPnL = stocksData.totalPnL + fundsData.totalPnL;
    
    const combinedPreviousValue = combinedCurrentValue - combinedDailyPnL;
    combinedDailyPercentageChange = combinedPreviousValue > 0 ? (combinedDailyPnL / combinedPreviousValue) * 100 : 0;
    combinedTotalPercentageChange = combinedTotalCost > 0 ? (combinedTotalPnL / combinedTotalCost) * 100 : 0;
  } else {
    combinedCurrentValue = stocksData.currentValue;
    combinedTotalCost = stocksData.totalCost;
    combinedDailyPnL = stocksData.dailyPnL;
    combinedTotalPnL = stocksData.totalPnL;
    combinedDailyPercentageChange = stocksData.dailyPercentageChange;
    combinedTotalPercentageChange = stocksData.totalPercentageChange;
  }
  
  const dailyEmoji = combinedDailyPnL >= 0 ? '📈' : '📉';
  const dailySign = combinedDailyPnL >= 0 ? '+' : '';
  const totalSign = combinedTotalPnL >= 0 ? '+' : '';
  
  // Count how many stocks have prices
  const stocksWithPrices = stocksData.details.filter(d => d.currentPrice !== null).length;
  const totalStocks = stocksData.details.length;
  
  // Count how many funds have quotes
  const fundsWithQuotes = fundsData ? fundsData.details.filter(d => d.currentQuote !== null).length : 0;
  const totalFunds = fundsData ? fundsData.details.length : 0;
  
  let message = `${dailyEmoji} *Relatório Diário da Carteira* ${dailyEmoji}\n\n`;
  message += `💰 *Valor Total:* R$ ${combinedCurrentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
  
  message += `📅 *Resultado do Dia:*\n`;
  message += `${combinedDailyPnL >= 0 ? '💚' : '🔴'} ${dailySign}R$ ${combinedDailyPnL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${dailySign}${combinedDailyPercentageChange.toFixed(2)}%)\n\n`;
  
  message += `📊 *Resultado Total:*\n`;
  message += `💵 Custo: R$ ${combinedTotalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
  message += `${combinedTotalPnL >= 0 ? '💚' : '🔴'} P&L: ${totalSign}R$ ${combinedTotalPnL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${totalSign}${combinedTotalPercentageChange.toFixed(2)}%)\n\n`;
  
  // Breakdown by asset type
  message += `📊 *Detalhes por Categoria:*\n`;
  message += `📈 Ações: R$ ${stocksData.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${stocksWithPrices}/${totalStocks} com cotação)\n`;
  
  if (hasFunds && fundsData) {
    message += `🏦 Fundos: R$ ${fundsData.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${fundsWithQuotes}/${totalFunds} com cotação)\n`;
  }
  
  message += `\n_Enviado às ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}_`;
  
  return message;
}
