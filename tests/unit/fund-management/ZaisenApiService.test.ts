import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZaisenApiService } from '../../../src/domains/fund-management/services/ZaisenApiService';
import { ILogger } from '../../../src/core/logging/Logger';

// Mock fetch globally
global.fetch = vi.fn();

describe('ZaisenApiService', () => {
  let service: ZaisenApiService;
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    service = new ZaisenApiService('https://api.zaisen.com', 'test-key', mockLogger);
    vi.clearAllMocks();
  });

  describe('searchFunds', () => {
    it('should search funds successfully', async () => {
      const mockResponse = {
        funds: [
          {
            cnpj: '11111111111111',
            nome: 'Test Fund 1',
            classe: 'Ações',
            situacao: 'Em funcionamento',
            administrador: 'Admin 1',
            gestor: 'Manager 1',
            patrimonio_liquido: 1000000
          }
        ],
        total: 1
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await service.searchFunds('Test', 10);
      
      expect(result).toHaveLength(1);
      expect(result[0].nome).toBe('Test Fund 1');
      expect(fetch).toHaveBeenCalledWith(
        'https://api.zaisen.com/api/v1/fundos?nome=Test&limit=10',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-key'
          })
        })
      );
    });

    it('should handle API errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(service.searchFunds('Test')).rejects.toThrow('API request failed: 401 Unauthorized');
    });
  });

  describe('getLatestQuote', () => {
    it('should get latest quote successfully', async () => {
      const mockQuote = {
        cnpj: '11111111111111',
        nome: 'Test Fund',
        ultima_cota: 150.25,
        data_ultima_cota: '2024-01-10',
        variacao_dia: 1.50,
        variacao_percentual: 1.01,
        patrimonio_liquido: 5000000,
        numero_cotistas: 1000
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuote
      });

      const result = await service.getLatestQuote('11.111.111/1111-11');
      
      expect(result).toEqual(mockQuote);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.zaisen.com/api/v1/fundos/11111111111111/cota/latest',
        expect.any(Object)
      );
    });

    it('should return null on error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getLatestQuote('11111111111111');
      
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getMultipleQuotes', () => {
    it('should fetch multiple quotes in parallel', async () => {
      const mockQuote1 = {
        cnpj: '11111111111111',
        nome: 'Fund 1',
        ultima_cota: 100.00,
        data_ultima_cota: '2024-01-10',
        variacao_dia: 1.00,
        variacao_percentual: 1.00,
        patrimonio_liquido: 1000000,
        numero_cotistas: 100
      };

      const mockQuote2 = {
        cnpj: '22222222222222',
        nome: 'Fund 2',
        ultima_cota: 200.00,
        data_ultima_cota: '2024-01-10',
        variacao_dia: -2.00,
        variacao_percentual: -0.99,
        patrimonio_liquido: 2000000,
        numero_cotistas: 200
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockQuote1
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockQuote2
        });

      const result = await service.getMultipleQuotes(['11111111111111', '22222222222222']);
      
      expect(result.size).toBe(2);
      expect(result.get('11111111111111')).toEqual({
        cnpj: '11111111111111',
        name: 'Fund 1',
        lastQuote: 100.00,
        quoteDate: '2024-01-10',
        dailyChange: 1.00,
        dailyChangePercent: 1.00
      });
    });

    it('should handle partial failures gracefully', async () => {
      const mockQuote = {
        cnpj: '11111111111111',
        nome: 'Fund 1',
        ultima_cota: 100.00,
        data_ultima_cota: '2024-01-10',
        variacao_dia: 1.00,
        variacao_percentual: 1.00,
        patrimonio_liquido: 1000000,
        numero_cotistas: 100
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockQuote
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await service.getMultipleQuotes(['11111111111111', '22222222222222']);
      
      expect(result.size).toBe(1);
      expect(result.has('11111111111111')).toBe(true);
      expect(result.has('22222222222222')).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('validateCnpj', () => {
    it('should validate valid CNPJ', () => {
      expect(service.validateCnpj('11.222.333/0001-81')).toBe(true);
      expect(service.validateCnpj('11222333000181')).toBe(true);
    });

    it('should reject invalid CNPJ', () => {
      expect(service.validateCnpj('00000000000000')).toBe(false); // All same digits
      expect(service.validateCnpj('12345678901234')).toBe(false); // Invalid check digits
      expect(service.validateCnpj('123')).toBe(false); // Too short
      expect(service.validateCnpj('123456789012345')).toBe(false); // Too long
    });

    it('should clean CNPJ format', () => {
      const cleaned = (service as any).cleanCnpj('11.222.333/0001-81');
      expect(cleaned).toBe('11222333000181');
    });
  });
});