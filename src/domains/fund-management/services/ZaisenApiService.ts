import { 
  FundSearchResult, 
  FundDetails, 
  LatestQuoteResponse, 
  ZaisenAPIResponse,
  FundQuote 
} from '../types';
import { ILogger } from '../../../core/logging/Logger';

export interface IFundApiService {
  searchFunds(query: string, limit?: number): Promise<FundSearchResult[]>;
  getFundDetails(cnpj: string): Promise<FundDetails | null>;
  getLatestQuote(cnpj: string): Promise<LatestQuoteResponse | null>;
  getMultipleQuotes(cnpjs: string[]): Promise<Map<string, FundQuote>>;
}

export class ZaisenApiService implements IFundApiService {
  private baseUrl: string;

  constructor(
    baseUrl: string,
    private apiKey: string,
    private logger: ILogger
  ) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  private async makeRequest<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          url.searchParams.append(key, value);
        }
      });
    }

    try {
      this.logger.debug('Making Zaisen API request', { endpoint, params });
      
      const response = await fetch(url.toString(), {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      this.logger.debug('Zaisen API response received', { endpoint });
      
      return data as T;
    } catch (error) {
      this.logger.error('Zaisen API request failed', error as Error, { endpoint });
      throw error;
    }
  }

  async searchFunds(query: string, limit: number = 20): Promise<FundSearchResult[]> {
    try {
      const response = await this.makeRequest<ZaisenAPIResponse<FundSearchResult>>(
        '/api/v1/fundos',
        {
          nome: query,
          limit: limit.toString(),
        }
      );

      const funds = response.funds || [];
      this.logger.info('Fund search completed', { query, resultCount: funds.length });
      
      return funds;
    } catch (error) {
      this.logger.error('Error searching funds', error as Error, { query });
      throw error;
    }
  }

  async getFundDetails(cnpj: string): Promise<FundDetails | null> {
    try {
      const cleanCnpj = this.cleanCnpj(cnpj);
      const response = await this.makeRequest<FundDetails>(
        `/api/v1/fundos/${cleanCnpj}`
      );
      
      this.logger.info('Fund details retrieved', { cnpj: cleanCnpj });
      return response;
    } catch (error) {
      this.logger.error('Error getting fund details', error as Error, { cnpj });
      return null;
    }
  }

  async getLatestQuote(cnpj: string): Promise<LatestQuoteResponse | null> {
    try {
      const cleanCnpj = this.cleanCnpj(cnpj);
      const response = await this.makeRequest<LatestQuoteResponse>(
        `/api/v1/fundos/${cleanCnpj}/cota/latest`
      );
      
      this.logger.info('Latest quote retrieved', { 
        cnpj: cleanCnpj, 
        quote: response.ultima_cota 
      });
      
      return response;
    } catch (error) {
      this.logger.error('Error getting latest quote', error as Error, { cnpj });
      return null;
    }
  }

  async getMultipleQuotes(cnpjs: string[]): Promise<Map<string, FundQuote>> {
    const quotes = new Map<string, FundQuote>();
    
    // Fetch quotes in parallel with error handling for individual failures
    const results = await Promise.allSettled(
      cnpjs.map(cnpj => this.getLatestQuote(cnpj))
    );
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const quote = result.value;
        quotes.set(cnpjs[index], {
          cnpj: cnpjs[index],
          name: quote.nome,
          lastQuote: quote.ultima_cota,
          quoteDate: quote.data_ultima_cota,
          dailyChange: quote.variacao_dia,
          dailyChangePercent: quote.variacao_percentual
        });
      } else {
        this.logger.warn('Failed to get quote for fund', { 
          cnpj: cnpjs[index],
          reason: result.status === 'rejected' ? result.reason : 'No data'
        });
      }
    });
    
    this.logger.info('Multiple quotes retrieved', { 
      requested: cnpjs.length, 
      retrieved: quotes.size 
    });
    
    return quotes;
  }

  private cleanCnpj(cnpj: string): string {
    // Remove all non-numeric characters
    return cnpj.replace(/\D/g, '');
  }

  validateCnpj(cnpj: string): boolean {
    const cleaned = this.cleanCnpj(cnpj);
    
    // CNPJ must have exactly 14 digits
    if (cleaned.length !== 14) {
      return false;
    }
    
    // Check if all digits are the same
    if (/^(\d)\1+$/.test(cleaned)) {
      return false;
    }
    
    // CNPJ validation algorithm
    let sum = 0;
    let pos = 5;
    
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cleaned[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(cleaned[12])) {
      return false;
    }
    
    sum = 0;
    pos = 6;
    
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cleaned[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(cleaned[13])) {
      return false;
    }
    
    return true;
  }
}