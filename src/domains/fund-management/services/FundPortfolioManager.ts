import { FundPosition, UserFundPortfolio } from '../types';
import { IStorageService } from '../../../core/services/interfaces/IStorageService';
import { ILogger } from '../../../core/logging/Logger';

export interface IFundPortfolioManager {
  getUserPortfolio(userId: string): Promise<UserFundPortfolio>;
  addPosition(userId: string, position: FundPosition): Promise<UserFundPortfolio>;
  removePosition(userId: string, cnpj: string): Promise<UserFundPortfolio>;
  updatePosition(userId: string, cnpj: string, updates: Partial<FundPosition>): Promise<UserFundPortfolio>;
  savePortfolio(portfolio: UserFundPortfolio): Promise<void>;
}

export class FundPortfolioManager implements IFundPortfolioManager {
  private readonly STORAGE_PREFIX = 'fund-portfolio';
  private readonly STORAGE_TTL = 86400 * 365; // 1 year

  constructor(
    private storage: IStorageService,
    private logger: ILogger
  ) {}

  async getUserPortfolio(userId: string): Promise<UserFundPortfolio> {
    try {
      const stored = await this.storage.get<string>(this.STORAGE_PREFIX, userId);
      
      if (stored) {
        const portfolio = JSON.parse(stored) as UserFundPortfolio;
        this.logger.debug('Portfolio loaded from storage', { 
          userId, 
          positionCount: portfolio.positions.length 
        });
        return portfolio;
      }
      
      // Return empty portfolio if none exists
      return this.createEmptyPortfolio(userId);
    } catch (error) {
      this.logger.error('Failed to load portfolio', error as Error, { userId });
      return this.createEmptyPortfolio(userId);
    }
  }

  async addPosition(userId: string, position: FundPosition): Promise<UserFundPortfolio> {
    const portfolio = await this.getUserPortfolio(userId);
    
    // Check if position already exists
    const existingIndex = portfolio.positions.findIndex(p => p.cnpj === position.cnpj);
    
    if (existingIndex >= 0) {
      // Update existing position (add to quotas)
      const existing = portfolio.positions[existingIndex];
      const totalQuotas = existing.quotas + position.quotas;
      const totalCost = (existing.quotas * existing.avgPrice) + (position.quotas * position.avgPrice);
      
      portfolio.positions[existingIndex] = {
        ...existing,
        quotas: totalQuotas,
        avgPrice: totalCost / totalQuotas,
        purchaseDate: position.purchaseDate || existing.purchaseDate
      };
      
      this.logger.info('Updated existing fund position', { 
        userId, 
        cnpj: position.cnpj,
        newQuotas: totalQuotas 
      });
    } else {
      // Add new position
      position.id = this.generateId();
      position.purchaseDate = position.purchaseDate || new Date().toISOString();
      portfolio.positions.push(position);
      
      this.logger.info('Added new fund position', { 
        userId, 
        cnpj: position.cnpj,
        quotas: position.quotas 
      });
    }
    
    // Update portfolio metadata
    this.updatePortfolioMetadata(portfolio);
    
    // Save to storage
    await this.savePortfolio(portfolio);
    
    return portfolio;
  }

  async removePosition(userId: string, cnpj: string): Promise<UserFundPortfolio> {
    const portfolio = await this.getUserPortfolio(userId);
    
    const initialLength = portfolio.positions.length;
    portfolio.positions = portfolio.positions.filter(p => p.cnpj !== cnpj);
    
    if (portfolio.positions.length < initialLength) {
      this.logger.info('Removed fund position', { userId, cnpj });
      this.updatePortfolioMetadata(portfolio);
      await this.savePortfolio(portfolio);
    } else {
      this.logger.warn('Position not found for removal', { userId, cnpj });
    }
    
    return portfolio;
  }

  async updatePosition(
    userId: string, 
    cnpj: string, 
    updates: Partial<FundPosition>
  ): Promise<UserFundPortfolio> {
    const portfolio = await this.getUserPortfolio(userId);
    
    const positionIndex = portfolio.positions.findIndex(p => p.cnpj === cnpj);
    
    if (positionIndex >= 0) {
      portfolio.positions[positionIndex] = {
        ...portfolio.positions[positionIndex],
        ...updates,
        cnpj // Ensure CNPJ is not changed
      };
      
      this.logger.info('Updated fund position', { userId, cnpj, updates });
      this.updatePortfolioMetadata(portfolio);
      await this.savePortfolio(portfolio);
    } else {
      this.logger.warn('Position not found for update', { userId, cnpj });
    }
    
    return portfolio;
  }

  async savePortfolio(portfolio: UserFundPortfolio): Promise<void> {
    try {
      await this.storage.put(
        this.STORAGE_PREFIX,
        portfolio.userId,
        JSON.stringify(portfolio),
        { ttl: this.STORAGE_TTL }
      );
      
      this.logger.debug('Portfolio saved to storage', { 
        userId: portfolio.userId,
        positionCount: portfolio.positions.length 
      });
    } catch (error) {
      this.logger.error('Failed to save portfolio', error as Error, { 
        userId: portfolio.userId 
      });
      throw error;
    }
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

  private updatePortfolioMetadata(portfolio: UserFundPortfolio): void {
    // Calculate totals from positions
    portfolio.totalInvested = portfolio.positions.reduce(
      (sum, p) => sum + (p.quotas * p.avgPrice), 
      0
    );
    
    portfolio.currentValue = portfolio.positions.reduce(
      (sum, p) => sum + (p.currentValue || (p.quotas * p.avgPrice)), 
      0
    );
    
    portfolio.totalPerformance = portfolio.currentValue - portfolio.totalInvested;
    portfolio.totalPerformancePercent = portfolio.totalInvested > 0
      ? (portfolio.totalPerformance / portfolio.totalInvested) * 100
      : 0;
    
    portfolio.lastUpdated = new Date().toISOString();
  }

  // private getStorageKey(userId: string): string {
  //   return `${this.STORAGE_PREFIX}:${userId}`;
  // }

  private generateId(): string {
    return `fund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}