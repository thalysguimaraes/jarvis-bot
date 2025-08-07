import { FundPosition, UserFundPortfolio } from './types';

export class KVFundStorage {
  private kv: KVNamespace;
  
  constructor(kv: KVNamespace) {
    this.kv = kv;
  }
  
  async saveFundPortfolio(userId: string, portfolio: UserFundPortfolio): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const portfolioKey = this.getPortfolioKey(userId);
    const portfolioWithTimestamp = {
      ...portfolio,
      userId,
      lastUpdated: new Date().toISOString()
    };
    
    await this.kv.put(portfolioKey, JSON.stringify(portfolioWithTimestamp));
    await this.updateUserIndex(userId);
  }
  
  async getFundPortfolio(userId: string): Promise<UserFundPortfolio> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const portfolioKey = this.getPortfolioKey(userId);
    const portfolioData = await this.kv.get(portfolioKey);
    
    if (!portfolioData) {
      return this.createEmptyPortfolio(userId);
    }
    
    try {
      const portfolio: UserFundPortfolio = JSON.parse(portfolioData);
      return this.validateAndFixPortfolio(portfolio, userId);
    } catch (error) {
      console.error('Error parsing portfolio data:', error);
      return this.createEmptyPortfolio(userId);
    }
  }
  
  async addFundPosition(userId: string, position: FundPosition): Promise<void> {
    if (!userId || !position) {
      throw new Error('User ID and position are required');
    }
    
    // Normalize the position to use consistent property names
    const normalizedPosition = this.normalizePosition(position);
    
    if (!normalizedPosition.cnpj || !normalizedPosition.name || (normalizedPosition.quotas || 0) <= 0) {
      throw new Error('Invalid position data');
    }
    
    const portfolio = await this.getFundPortfolio(userId);
    
    // Check if position already exists
    const existingIndex = portfolio.positions.findIndex(p => p.cnpj === normalizedPosition.cnpj);
    
    if (existingIndex >= 0) {
      // Update existing position by combining quotas and calculating new average price
      const existing = this.normalizePosition(portfolio.positions[existingIndex]);
      const totalQuotas = (existing.quotas || 0) + (normalizedPosition.quotas || 0);
      const totalInvested = (existing.investedAmount || 0) + (normalizedPosition.investedAmount || 0);
      const newAvgPrice = totalInvested / totalQuotas;
      
      portfolio.positions[existingIndex] = {
        ...existing,
        quotas: totalQuotas,
        investedAmount: totalInvested,
        avgPrice: newAvgPrice
      };
    } else {
      // Add new position
      const newPosition: FundPosition = {
        ...normalizedPosition,
        id: normalizedPosition.id || this.generatePositionId(normalizedPosition.cnpj),
        avgPrice: (normalizedPosition.investedAmount || 0) / (normalizedPosition.quotas || 1)
      };
      portfolio.positions.push(newPosition);
    }
    
    this.recalculatePortfolio(portfolio);
    await this.saveFundPortfolio(userId, portfolio);
  }
  
  async updateFundPosition(userId: string, cnpj: string, newShares: number, newAvgPrice?: number): Promise<void> {
    if (!userId || !cnpj) {
      throw new Error('User ID and CNPJ are required');
    }
    
    if (newShares < 0) {
      throw new Error('Shares cannot be negative');
    }
    
    const portfolio = await this.getFundPortfolio(userId);
    const positionIndex = portfolio.positions.findIndex(p => p.cnpj === cnpj);
    
    if (positionIndex === -1) {
      throw new Error('Position not found');
    }
    
    if (newShares === 0) {
      // Remove position if shares is 0
      portfolio.positions.splice(positionIndex, 1);
    } else {
      const position = portfolio.positions[positionIndex];
      position.quotas = newShares;
      
      if (newAvgPrice !== undefined) {
        position.avgPrice = newAvgPrice;
        position.investedAmount = newShares * newAvgPrice;
      }
    }
    
    this.recalculatePortfolio(portfolio);
    await this.saveFundPortfolio(userId, portfolio);
  }
  
  async removeFundPosition(userId: string, cnpj: string): Promise<void> {
    if (!userId || !cnpj) {
      throw new Error('User ID and CNPJ are required');
    }
    
    const portfolio = await this.getFundPortfolio(userId);
    const initialLength = portfolio.positions.length;
    
    portfolio.positions = portfolio.positions.filter(p => p.cnpj !== cnpj);
    
    if (portfolio.positions.length === initialLength) {
      throw new Error('Position not found');
    }
    
    this.recalculatePortfolio(portfolio);
    await this.saveFundPortfolio(userId, portfolio);
  }
  
  async getAllUserPortfolios(): Promise<string[]> {
    const indexKey = 'fund-portfolios:index';
    const indexData = await this.kv.get(indexKey);
    
    if (!indexData) {
      return [];
    }
    
    try {
      return JSON.parse(indexData);
    } catch (error) {
      console.error('Error parsing portfolios index:', error);
      return [];
    }
  }
  
  async deletePortfolio(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const portfolioKey = this.getPortfolioKey(userId);
    await this.kv.delete(portfolioKey);
    await this.removeFromUserIndex(userId);
  }
  
  // Helper methods
  private getPortfolioKey(userId: string): string {
    return `fund-portfolio:${userId}`;
  }
  
  private generatePositionId(cnpj: string): string {
    const timestamp = new Date().toISOString();
    return `fund-pos:${cnpj}:${timestamp}:${Math.random().toString(36).substr(2, 6)}`;
  }
  
  private createEmptyPortfolio(userId: string): UserFundPortfolio {
    return {
      userId,
      positions: [],
      totalInvested: 0,
      currentValue: 0,
      totalPerformance: 0,
      totalPerformancePercent: 0,
      lastUpdated: new Date().toISOString()
    };
  }
  
  private validateAndFixPortfolio(portfolio: UserFundPortfolio, userId: string): UserFundPortfolio {
    const validPortfolio: UserFundPortfolio = {
      userId,
      positions: Array.isArray(portfolio.positions) ? portfolio.positions : [],
      totalInvested: portfolio.totalInvested || 0,
      currentValue: portfolio.currentValue || 0,
      totalPerformance: portfolio.totalPerformance || 0,
      totalPerformancePercent: portfolio.totalPerformancePercent || 0,
      lastUpdated: portfolio.lastUpdated || new Date().toISOString()
    };
    
    // Normalize and validate positions
    validPortfolio.positions = validPortfolio.positions
      .map(position => this.normalizePosition(position))
      .filter(position => {
        const name = position.name || position.fundName;
        const quotas = position.quotas || position.shares || 0;
        const investedAmount = position.investedAmount || 0;
        
        return position.cnpj && 
               name && 
               typeof quotas === 'number' && 
               quotas > 0 &&
               typeof investedAmount === 'number' &&
               investedAmount > 0;
      });
    
    // Ensure each position has required fields
    validPortfolio.positions.forEach(position => {
      if (!position.id) {
        position.id = this.generatePositionId(position.cnpj);
      }
      const quotas = position.quotas || position.shares || 0;
      const investedAmount = position.investedAmount || 0;
      if (!position.avgPrice && quotas > 0) {
        position.avgPrice = investedAmount / quotas;
      }
    });
    
    return validPortfolio;
  }
  
  private recalculatePortfolio(portfolio: UserFundPortfolio): void {
    portfolio.totalInvested = portfolio.positions.reduce((sum, pos) => {
      const investedAmount = pos.investedAmount || 0;
      return sum + investedAmount;
    }, 0);
    
    // Current value calculation depends on having currentQuotaValue for each position
    let hasCurrentValues = true;
    portfolio.currentValue = 0;
    
    for (const position of portfolio.positions) {
      const quotas = position.quotas || position.shares || 0;
      const investedAmount = position.investedAmount || 0;
      
      if (position.currentQuotaValue !== undefined) {
        position.currentValue = quotas * position.currentQuotaValue;
        position.performance = position.currentValue - investedAmount;
        position.performancePercent = investedAmount > 0 
          ? (position.performance / investedAmount) * 100 
          : 0;
        portfolio.currentValue += position.currentValue;
      } else {
        hasCurrentValues = false;
        position.currentValue = investedAmount; // fallback
        position.performance = 0;
        position.performancePercent = 0;
        portfolio.currentValue += investedAmount;
      }
    }
    
    if (hasCurrentValues) {
      portfolio.totalPerformance = portfolio.currentValue - portfolio.totalInvested;
      portfolio.totalPerformancePercent = portfolio.totalInvested > 0 
        ? (portfolio.totalPerformance / portfolio.totalInvested) * 100 
        : 0;
    } else {
      portfolio.totalPerformance = 0;
      portfolio.totalPerformancePercent = 0;
    }
    
    portfolio.lastUpdated = new Date().toISOString();
  }
  
  private async updateUserIndex(userId: string): Promise<void> {
    const indexKey = 'fund-portfolios:index';
    const indexData = await this.kv.get(indexKey);
    
    let userIds: string[] = [];
    if (indexData) {
      try {
        userIds = JSON.parse(indexData);
      } catch (error) {
        console.error('Error parsing user index:', error);
        userIds = [];
      }
    }
    
    if (!userIds.includes(userId)) {
      userIds.push(userId);
      await this.kv.put(indexKey, JSON.stringify(userIds));
    }
  }
  
  private async removeFromUserIndex(userId: string): Promise<void> {
    const indexKey = 'fund-portfolios:index';
    const indexData = await this.kv.get(indexKey);
    
    if (!indexData) {
      return;
    }
    
    try {
      let userIds: string[] = JSON.parse(indexData);
      userIds = userIds.filter(id => id !== userId);
      await this.kv.put(indexKey, JSON.stringify(userIds));
    } catch (error) {
      console.error('Error updating user index:', error);
    }
  }
  
  private normalizePosition(position: FundPosition): FundPosition {
    // Normalize property names to support both legacy and new formats
    const name = position.name || position.fundName || '';
    const quotas = position.quotas || position.shares || 0;
    const purchaseDate = position.purchaseDate || position.addedDate || new Date().toISOString();
    const investedAmount = position.investedAmount || (quotas * position.avgPrice) || 0;
    
    return {
      ...position,
      name,
      fundName: name, // Keep both for compatibility
      quotas,
      shares: quotas, // Keep both for compatibility
      purchaseDate,
      addedDate: purchaseDate, // Keep both for compatibility
      investedAmount
    };
  }
}
