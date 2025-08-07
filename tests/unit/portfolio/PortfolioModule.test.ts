import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PortfolioModule } from '../../../src/domains/portfolio/PortfolioModule';
import { DependencyContainer } from '../../../src/core/services/ServiceRegistry';
import { IEventBus } from '../../../src/core/event-bus/EventBus';
import { ILogger } from '../../../src/core/logging/Logger';
import { IMessagingService } from '../../../src/core/services/messaging/IMessagingService';
import { IStorageService } from '../../../src/core/services/storage/IStorageService';
import { DomainEvent } from '../../../src/core/event-bus/DomainEvent';

describe('PortfolioModule', () => {
  let module: PortfolioModule;
  let mockContainer: DependencyContainer;
  let mockEventBus: IEventBus;
  let mockLogger: ILogger;
  let mockMessagingService: IMessagingService;
  let mockStorageService: IStorageService;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    // Mock event bus
    mockEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      unsubscribe: vi.fn(),
    } as any;

    // Mock messaging service
    mockMessagingService = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Mock storage service
    mockStorageService = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn(),
      list: vi.fn(),
    } as any;

    // Mock environment
    const mockEnv = {
      BRAPI_TOKEN: 'test-brapi-token',
      PORTFOLIO_WHATSAPP_NUMBER: '5511999999999',
      PORTFOLIO_DATA: JSON.stringify([
        { ticker: 'PETR4', shares: 100, avgPrice: 35.00 }
      ])
    };

    // Mock container
    mockContainer = {
      resolve: vi.fn((token: string) => {
        switch (token) {
          case 'ILogger': return mockLogger;
          case 'IEventBus': return mockEventBus;
          case 'IMessagingService': return mockMessagingService;
          case 'IStorageService': return mockStorageService;
          case 'env': return mockEnv;
          default: throw new Error(`Unknown token: ${token}`);
        }
      }),
    } as any;

    module = new PortfolioModule();
  });

  describe('initialization', () => {
    it('should initialize successfully with required configuration', async () => {
      await module.initialize(mockContainer);
      
      expect(module.status).toBe('ready');
      expect(mockContainer.resolve).toHaveBeenCalledWith('ILogger');
      expect(mockContainer.resolve).toHaveBeenCalledWith('IEventBus');
      expect(mockContainer.resolve).toHaveBeenCalledWith('IMessagingService');
      expect(mockContainer.resolve).toHaveBeenCalledWith('IStorageService');
      expect(mockLogger.info).toHaveBeenCalledWith('PortfolioModule initialized', {
        whatsappNumber: '5511999999999'
      });
    });

    it('should fail initialization without BRAPI_TOKEN', async () => {
      const invalidEnv = { PORTFOLIO_WHATSAPP_NUMBER: '5511999999999' };
      mockContainer.resolve = vi.fn((token: string) => {
        if (token === 'env') return invalidEnv;
        if (token === 'ILogger') return mockLogger;
        if (token === 'IEventBus') return mockEventBus;
        if (token === 'IMessagingService') return mockMessagingService;
        if (token === 'IStorageService') return mockStorageService;
        throw new Error(`Unknown token: ${token}`);
      }) as any;

      await expect(module.initialize(mockContainer)).rejects.toThrow('BRAPI_TOKEN is required');
    });

    it('should fail initialization without PORTFOLIO_WHATSAPP_NUMBER', async () => {
      const invalidEnv = { BRAPI_TOKEN: 'test-token' };
      mockContainer.resolve = vi.fn((token: string) => {
        if (token === 'env') return invalidEnv;
        if (token === 'ILogger') return mockLogger;
        if (token === 'IEventBus') return mockEventBus;
        if (token === 'IMessagingService') return mockMessagingService;
        if (token === 'IStorageService') return mockStorageService;
        throw new Error(`Unknown token: ${token}`);
      }) as any;

      await expect(module.initialize(mockContainer)).rejects.toThrow('PORTFOLIO_WHATSAPP_NUMBER is required');
    });

    it('should subscribe to correct events', async () => {
      await module.initialize(mockContainer);
      
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'portfolio.report_requested',
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'portfolio.update_requested',
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'scheduler.daily_portfolio_report',
        expect.any(Function)
      );
    });
  });

  describe('lifecycle', () => {
    beforeEach(async () => {
      await module.initialize(mockContainer);
    });

    it('should start successfully', async () => {
      await module.start();
      expect(mockLogger.info).toHaveBeenCalledWith('PortfolioModule started');
    });

    it('should stop successfully', async () => {
      await module.start();
      await module.stop();
      expect(mockLogger.info).toHaveBeenCalledWith('PortfolioModule stopped');
    });

    it('should dispose successfully', async () => {
      await module.dispose();
      expect(mockLogger.info).toHaveBeenCalledWith('PortfolioModule disposed');
      expect(module.status).toBe('disposed');
    });
  });

  describe('portfolio operations', () => {
    beforeEach(async () => {
      // Mock fetch for stock API calls
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{
            symbol: 'PETR4',
            regularMarketPrice: 38.50,
            regularMarketPreviousClose: 37.80,
            regularMarketChange: 0.70,
            regularMarketChangePercent: 1.85
          }]
        })
      });

      await module.initialize(mockContainer);
    });

    it('should update portfolio successfully', async () => {
      const portfolio = [
        { ticker: 'PETR4', shares: 100, avgPrice: 35.00 },
        { ticker: 'VALE3', shares: 50, avgPrice: 80.00 }
      ];

      await module.updatePortfolio('user123', portfolio);

      expect(mockStorageService.set).toHaveBeenCalledWith(
        'portfolio:user123',
        JSON.stringify(portfolio),
        { expirationTtl: 86400 * 30 }
      );

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'portfolio.updated',
          payload: expect.objectContaining({
            userId: 'user123',
            portfolioId: 'portfolio:user123'
          })
        })
      );
    });

    it('should get portfolio value', async () => {
      vi.mocked(mockStorageService.get).mockResolvedValueOnce(
        JSON.stringify([{ ticker: 'PETR4', shares: 100, avgPrice: 35.00 }])
      );

      const result = await module.getPortfolioValue('user123');

      expect(result).toHaveProperty('currentValue');
      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('dailyPnL');
      expect(result.details).toBeInstanceOf(Array);
    });
  });

  describe('health check', () => {
    beforeEach(async () => {
      await module.initialize(mockContainer);
    });

    it('should report healthy when API is available', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] })
      });

      const health = await module.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.status).toBe('ready');
      expect(health.metrics?.apiAvailable).toBe(true);
    });

    it('should report unhealthy when API is unavailable', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const health = await module.getHealth();

      expect(health.healthy).toBe(false);
      expect(health.errors).toContain('Stock API health check failed: Network error');
      expect(health.metrics?.apiAvailable).toBe(false);
    });
  });
});