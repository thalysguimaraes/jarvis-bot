import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FundCalculator } from '../../../src/domains/fund-management/services/FundCalculator';
import { IFundApiService } from '../../../src/domains/fund-management/services/ZaisenApiService';
import { ILogger } from '../../../src/core/logging/Logger';
import { FundPosition, FundQuote } from '../../../src/domains/fund-management/types';

describe('FundCalculator', () => {
  let calculator: FundCalculator;
  let mockFundApi: IFundApiService;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    mockFundApi = {
      searchFunds: vi.fn(),
      getFundDetails: vi.fn(),
      getLatestQuote: vi.fn(),
      getMultipleQuotes: vi.fn()
    };

    calculator = new FundCalculator(mockFundApi, mockLogger);
  });

  describe('calculatePortfolioValue', () => {
    it('should return empty portfolio for empty positions', async () => {
      const result = await calculator.calculatePortfolioValue([]);
      
      expect(result).toEqual({
        totalInvested: 0,
        currentValue: 0,
        totalPerformance: 0,
        totalPerformancePercent: 0,
        positions: []
      });
      
      expect(mockFundApi.getMultipleQuotes).not.toHaveBeenCalled();
    });

    it('should calculate portfolio values correctly', async () => {
      const positions: FundPosition[] = [
        {
          cnpj: '11111111111111',
          name: 'Fund 1',
          quotas: 100,
          avgPrice: 50.00
        },
        {
          cnpj: '22222222222222',
          name: 'Fund 2',
          quotas: 200,
          avgPrice: 25.00
        }
      ];

      const quotes = new Map<string, FundQuote>([
        ['11111111111111', {
          cnpj: '11111111111111',
          name: 'Fund 1',
          lastQuote: 55.00,
          quoteDate: '2024-01-10'
        }],
        ['22222222222222', {
          cnpj: '22222222222222',
          name: 'Fund 2',
          lastQuote: 30.00,
          quoteDate: '2024-01-10'
        }]
      ]);

      vi.mocked(mockFundApi.getMultipleQuotes).mockResolvedValueOnce(quotes);

      const result = await calculator.calculatePortfolioValue(positions);
      
      // Total invested: (100 * 50) + (200 * 25) = 5000 + 5000 = 10000
      expect(result.totalInvested).toBe(10000);
      
      // Current value: (100 * 55) + (200 * 30) = 5500 + 6000 = 11500
      expect(result.currentValue).toBe(11500);
      
      // Total performance: 11500 - 10000 = 1500
      expect(result.totalPerformance).toBe(1500);
      
      // Total performance %: (1500 / 10000) * 100 = 15
      expect(result.totalPerformancePercent).toBe(15);
      
      expect(result.positions).toHaveLength(2);
      expect(result.positions[0]).toEqual({
        cnpj: '11111111111111',
        name: 'Fund 1',
        quotas: 100,
        avgPrice: 50.00,
        currentQuotaValue: 55.00,
        currentValue: 5500,
        performance: 500,
        performancePercent: 10
      });
    });

    it('should handle missing quotes gracefully', async () => {
      const positions: FundPosition[] = [
        {
          cnpj: '11111111111111',
          name: 'Fund 1',
          quotas: 100,
          avgPrice: 50.00,
          currentQuotaValue: 52.00 // Has previous value
        },
        {
          cnpj: '22222222222222',
          name: 'Fund 2',
          quotas: 200,
          avgPrice: 25.00 // No previous value
        }
      ];

      const quotes = new Map<string, FundQuote>([
        ['11111111111111', {
          cnpj: '11111111111111',
          name: 'Fund 1',
          lastQuote: 55.00,
          quoteDate: '2024-01-10'
        }]
        // Fund 2 quote missing
      ]);

      vi.mocked(mockFundApi.getMultipleQuotes).mockResolvedValueOnce(quotes);

      const result = await calculator.calculatePortfolioValue(positions);
      
      // Fund 1: 100 * 55 = 5500
      // Fund 2: 200 * 25 (using avg price as fallback) = 5000
      expect(result.currentValue).toBe(10500);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No quote available for fund',
        { cnpj: '22222222222222', name: 'Fund 2' }
      );
    });

    it('should handle negative performance', async () => {
      const positions: FundPosition[] = [
        {
          cnpj: '11111111111111',
          name: 'Fund 1',
          quotas: 100,
          avgPrice: 60.00
        }
      ];

      const quotes = new Map<string, FundQuote>([
        ['11111111111111', {
          cnpj: '11111111111111',
          name: 'Fund 1',
          lastQuote: 50.00, // Lower than avg price
          quoteDate: '2024-01-10'
        }]
      ]);

      vi.mocked(mockFundApi.getMultipleQuotes).mockResolvedValueOnce(quotes);

      const result = await calculator.calculatePortfolioValue(positions);
      
      expect(result.totalInvested).toBe(6000);
      expect(result.currentValue).toBe(5000);
      expect(result.totalPerformance).toBe(-1000);
      expect(result.totalPerformancePercent).toBeCloseTo(-16.67, 2);
    });

    it('should handle API errors', async () => {
      const positions: FundPosition[] = [
        {
          cnpj: '11111111111111',
          name: 'Fund 1',
          quotas: 100,
          avgPrice: 50.00
        }
      ];

      const error = new Error('API Error');
      vi.mocked(mockFundApi.getMultipleQuotes).mockRejectedValueOnce(error);

      await expect(calculator.calculatePortfolioValue(positions)).rejects.toThrow('API Error');
      expect(mockLogger.error).toHaveBeenCalledWith('Fund portfolio calculation failed', error);
    });
  });
});