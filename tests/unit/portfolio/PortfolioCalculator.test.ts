import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PortfolioCalculator } from '../../../src/domains/portfolio/services/PortfolioCalculator';
import { IStockApiService } from '../../../src/domains/portfolio/services/StockApiService';
import { ILogger } from '../../../src/core/logging/Logger';
import { PortfolioItem, StockData } from '../../../src/domains/portfolio/types';

describe('PortfolioCalculator', () => {
  let calculator: PortfolioCalculator;
  let mockStockApi: IStockApiService;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    mockStockApi = {
      fetchPrices: vi.fn()
    };

    calculator = new PortfolioCalculator(mockStockApi, mockLogger);
  });

  describe('calculatePortfolioValue', () => {
    it('should return empty portfolio for empty input', async () => {
      const result = await calculator.calculatePortfolioValue([]);
      
      expect(result).toEqual({
        currentValue: 0,
        previousCloseValue: 0,
        totalCost: 0,
        dailyPnL: 0,
        dailyPercentageChange: 0,
        totalPnL: 0,
        totalPercentageChange: 0,
        details: []
      });
      
      expect(mockStockApi.fetchPrices).not.toHaveBeenCalled();
    });

    it('should calculate portfolio values correctly', async () => {
      const portfolio: PortfolioItem[] = [
        { ticker: 'PETR4', shares: 100, avgPrice: 35.00 },
        { ticker: 'VALE3', shares: 50, avgPrice: 80.00 }
      ];

      const stockData = new Map<string, StockData>([
        ['PETR4', {
          price: 38.50,
          previousClose: 37.80,
          change: 0.70,
          changePercent: 1.85
        }],
        ['VALE3', {
          price: 85.20,
          previousClose: 84.00,
          change: 1.20,
          changePercent: 1.43
        }]
      ]);

      vi.mocked(mockStockApi.fetchPrices).mockResolvedValueOnce(stockData);

      const result = await calculator.calculatePortfolioValue(portfolio);
      
      // Current value: (38.50 * 100) + (85.20 * 50) = 3850 + 4260 = 8110
      expect(result.currentValue).toBe(8110);
      
      // Previous close value: (37.80 * 100) + (84.00 * 50) = 3780 + 4200 = 7980
      expect(result.previousCloseValue).toBe(7980);
      
      // Total cost: (35.00 * 100) + (80.00 * 50) = 3500 + 4000 = 7500
      expect(result.totalCost).toBe(7500);
      
      // Daily P&L: 8110 - 7980 = 130
      expect(result.dailyPnL).toBe(130);
      
      // Daily percentage: (130 / 7980) * 100 ≈ 1.63
      expect(result.dailyPercentageChange).toBeCloseTo(1.63, 2);
      
      // Total P&L: 8110 - 7500 = 610
      expect(result.totalPnL).toBe(610);
      
      // Total percentage: (610 / 7500) * 100 ≈ 8.13
      expect(result.totalPercentageChange).toBeCloseTo(8.13, 2);
      
      expect(result.details).toHaveLength(2);
      expect(result.details[0]).toEqual({
        ticker: 'PETR4',
        currentPrice: 38.50,
        position: 3850,
        dailyChange: 70, // 0.70 * 100
        dailyChangePercent: 1.85
      });
    });

    it('should handle missing price data gracefully', async () => {
      const portfolio: PortfolioItem[] = [
        { ticker: 'PETR4', shares: 100, avgPrice: 35.00 },
        { ticker: 'INVALID', shares: 50, avgPrice: 10.00 }
      ];

      const stockData = new Map<string, StockData>([
        ['PETR4', {
          price: 38.50,
          previousClose: 37.80,
          change: 0.70,
          changePercent: 1.85
        }]
      ]);

      vi.mocked(mockStockApi.fetchPrices).mockResolvedValueOnce(stockData);

      const result = await calculator.calculatePortfolioValue(portfolio);
      
      // Only PETR4 should contribute to value
      expect(result.currentValue).toBe(3850);
      expect(result.details[1]).toEqual({
        ticker: 'INVALID',
        currentPrice: null,
        position: 0,
        dailyChange: 0,
        dailyChangePercent: 0
      });
      
      expect(mockLogger.warn).toHaveBeenCalledWith('No price data for ticker', { ticker: 'INVALID' });
    });

    it('should handle API errors properly', async () => {
      const portfolio: PortfolioItem[] = [
        { ticker: 'PETR4', shares: 100, avgPrice: 35.00 }
      ];

      const error = new Error('API Error');
      vi.mocked(mockStockApi.fetchPrices).mockRejectedValueOnce(error);

      await expect(calculator.calculatePortfolioValue(portfolio)).rejects.toThrow('API Error');
      expect(mockLogger.error).toHaveBeenCalledWith('Portfolio calculation failed', error);
    });

    it('should handle zero previous close value', async () => {
      const portfolio: PortfolioItem[] = [
        { ticker: 'NEW', shares: 100, avgPrice: 10.00 }
      ];

      const stockData = new Map<string, StockData>([
        ['NEW', {
          price: 15.00,
          previousClose: 0,
          change: 15.00,
          changePercent: 0
        }]
      ]);

      vi.mocked(mockStockApi.fetchPrices).mockResolvedValueOnce(stockData);

      const result = await calculator.calculatePortfolioValue(portfolio);
      
      expect(result.currentValue).toBe(1500);
      expect(result.previousCloseValue).toBe(0);
      expect(result.dailyPercentageChange).toBe(0); // Should handle division by zero
    });
  });
});