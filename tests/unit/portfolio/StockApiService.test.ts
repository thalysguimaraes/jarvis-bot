import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrapiStockApiService } from '../../../src/domains/portfolio/services/StockApiService';
import { ILogger } from '../../../src/core/logging/Logger';
import { BrapiQuoteResponse } from '../../../src/domains/portfolio/types';

// Mock fetch globally
global.fetch = vi.fn();

describe('BrapiStockApiService', () => {
  let service: BrapiStockApiService;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    service = new BrapiStockApiService('test-token', mockLogger);
    vi.clearAllMocks();
  });

  describe('fetchPrices', () => {
    it('should return empty map for empty ticker list', async () => {
      const result = await service.fetchPrices([]);
      
      expect(result.size).toBe(0);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fetch and parse stock prices successfully', async () => {
      const mockResponse: BrapiQuoteResponse = {
        results: [
          {
            symbol: 'PETR4',
            longName: 'Petrobras',
            regularMarketPrice: 38.50,
            regularMarketPreviousClose: 37.80,
            regularMarketChange: 0.70,
            regularMarketChangePercent: 1.85,
            currency: 'BRL',
            regularMarketTime: '2024-01-10T18:00:00.000Z'
          },
          {
            symbol: 'VALE3',
            longName: 'Vale',
            regularMarketPrice: 85.20,
            regularMarketPreviousClose: 84.00,
            regularMarketChange: 1.20,
            regularMarketChangePercent: 1.43,
            currency: 'BRL',
            regularMarketTime: '2024-01-10T18:00:00.000Z'
          }
        ],
        requestedAt: '2024-01-10T18:00:00.000Z',
        took: '100ms'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await service.fetchPrices(['PETR4', 'VALE3']);
      
      expect(result.size).toBe(2);
      expect(result.get('PETR4')).toEqual({
        price: 38.50,
        previousClose: 37.80,
        change: 0.70,
        changePercent: 1.85
      });
      expect(result.get('VALE3')).toEqual({
        price: 85.20,
        previousClose: 84.00,
        change: 1.20,
        changePercent: 1.43
      });
      
      expect(fetch).toHaveBeenCalledWith(
        'https://brapi.dev/api/quote/PETR4,VALE3?token=test-token'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith('Fetching stock prices', { tickers: ['PETR4', 'VALE3'] });
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(service.fetchPrices(['PETR4'])).rejects.toThrow('Brapi API error: 500 Internal Server Error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      (global.fetch as any).mockRejectedValueOnce(networkError);

      await expect(service.fetchPrices(['PETR4'])).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to fetch stock prices',
        networkError,
        { tickers: ['PETR4'] }
      );
    });

    it('should handle empty results from API', async () => {
      const mockResponse: BrapiQuoteResponse = {
        results: [],
        requestedAt: '2024-01-10T18:00:00.000Z',
        took: '100ms'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await service.fetchPrices(['INVALID']);
      
      expect(result.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('No results from Brapi API', { tickers: ['INVALID'] });
    });
  });
});