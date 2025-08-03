import { FundCalculation, FundPosition, LatestQuoteResponse } from './types';
import { ZaisenFundAPI } from './fund-api';

export async function calculateFundPortfolioValue(
  portfolio: FundPosition[],
  fundAPI: ZaisenFundAPI
): Promise<FundCalculation> {
  const quoteData = new Map<string, LatestQuoteResponse>();
  
  console.log(`Fetching quotes for: ${portfolio.map(p => p.cnpj).join(', ')}`);
  
  // Fetch quotes for all funds
  for (const position of portfolio) {
    try {
      console.log(`Fetching quote for ${position.cnpj} (${position.name})...`);
      
      const quote = await fundAPI.getFundQuote(position.cnpj);
      
      if (quote) {
        quoteData.set(position.cnpj, quote);
        console.log(`${position.name}: R$ ${quote.ultima_cota.toFixed(6)} (${quote.variacao_percentual?.toFixed(2)}%)`);
      } else {
        console.log(`No quote data for ${position.name} (${position.cnpj})`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error fetching quote for ${position.cnpj}:`, error);
    }
  }
  
  let currentValue = 0;
  
  const details = portfolio.map((position) => {
    const quote = quoteData.get(position.cnpj);
    if (quote) {
      const quotas = position.quotas || position.shares || 0;
      const positionValue = quote.ultima_cota * quotas;
      currentValue += positionValue;
      
      return {
        cnpj: position.cnpj,
        name: position.name || position.fundName || '',
        currentQuote: quote.ultima_cota,
        position: positionValue,
        dailyChange: quote.variacao_dia * quotas,
        dailyChangePercent: quote.variacao_percentual
      };
    }
    return {
      cnpj: position.cnpj,
      name: position.name || position.fundName || '',
      currentQuote: null,
      position: 0,
      dailyChange: 0,
      dailyChangePercent: 0
    };
  });

  const totalCost = portfolio.reduce((sum, position) => sum + (position.investedAmount || 0), 0);
  const dailyPnL = details.reduce((sum, detail) => sum + detail.dailyChange, 0);
  const totalPnL = currentValue - totalCost;
  
  // Calculate daily percentage change based on previous day value
  const previousDayValue = currentValue - dailyPnL;
  const dailyPercentageChange = previousDayValue > 0 ? (dailyPnL / previousDayValue) * 100 : 0;
  const totalPercentageChange = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  console.log(`Returning portfolio with ${quoteData.size} funds with data`);
  
  return {
    currentValue,
    totalCost,
    dailyPnL,
    dailyPercentageChange,
    totalPnL,
    totalPercentageChange,
    details
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function calculatePositionWeight(positionValue: number, totalPortfolioValue: number): number {
  return totalPortfolioValue > 0 ? (positionValue / totalPortfolioValue) * 100 : 0;
}

export function analyzePortfolioRisk(portfolio: FundPosition[]): {
  diversificationScore: number;
  fundCount: number;
  largestPositionWeight: number;
  concentrationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
} {
  const fundCount = portfolio.length;
  
  if (fundCount === 0) {
    return {
      diversificationScore: 0,
      fundCount: 0,
      largestPositionWeight: 0,
      concentrationRisk: 'HIGH'
    };
  }

  const totalInvested = portfolio.reduce((sum, p) => sum + (p.investedAmount || 0), 0);
  const weights = portfolio.map(p => ((p.investedAmount || 0) / totalInvested) * 100);
  const largestPositionWeight = Math.max(...weights);
  
  // Simple diversification score based on number of funds and largest position
  let diversificationScore = Math.min(fundCount * 10, 100); // Max 100 points
  if (largestPositionWeight > 50) diversificationScore -= 30;
  else if (largestPositionWeight > 30) diversificationScore -= 15;
  
  let concentrationRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (largestPositionWeight > 50 || fundCount < 3) {
    concentrationRisk = 'HIGH';
  } else if (largestPositionWeight > 30 || fundCount < 5) {
    concentrationRisk = 'MEDIUM';
  }

  return {
    diversificationScore: Math.max(0, diversificationScore),
    fundCount,
    largestPositionWeight,
    concentrationRisk
  };
}
