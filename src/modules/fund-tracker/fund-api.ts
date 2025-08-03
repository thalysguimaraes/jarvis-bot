import { FundSearchResult, FundDetails, LatestQuoteResponse, ZaisenAPIResponse } from './types';

export class ZaisenFundAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.apiKey = apiKey;
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

    const response = await fetch(url.toString(), {
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async searchFunds(query: string, limit: number = 20): Promise<FundSearchResult[]> {
    try {
      // Use the working /fundos endpoint instead of /fundos/search
      const response = await this.makeRequest<ZaisenAPIResponse<FundSearchResult>>(
        '/api/v1/fundos',
        {
          nome: query,
          limit: limit.toString(),
        }
      );

      return response.funds || [];
    } catch (error) {
      console.error('Error searching funds:', error);
      throw new Error(`Failed to search funds: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFundQuote(cnpj: string): Promise<LatestQuoteResponse | null> {
    try {
      const cleanCnpj = cnpj.replace(/[^\d]/g, '');
      const formattedCnpj = cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

      const response = await this.makeRequest<LatestQuoteResponse>(
        `/api/v1/fundos/${formattedCnpj}/ultima-cota`
      );

      return response;
    } catch (error) {
      console.error(`Error fetching quote for CNPJ ${cnpj}:`, error);
      return null;
    }
  }

  async getFundDetails(cnpj: string): Promise<FundDetails | null> {
    try {
      const cleanCnpj = cnpj.replace(/[^\d]/g, '');
      const formattedCnpj = cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

      const response = await this.makeRequest<FundDetails>(
        `/api/v1/fundos/${formattedCnpj}`,
        {
          include_latest_quota: 'true',
        }
      );

      return response;
    } catch (error) {
      console.error(`Error fetching details for CNPJ ${cnpj}:`, error);
      return null;
    }
  }

  async searchFundsByCNPJ(cnpj: string): Promise<FundSearchResult[]> {
    try {
      const cleanCnpj = cnpj.replace(/[^\d]/g, '');
      const formattedCnpj = cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

      // Use the working /fundos endpoint instead of /fundos/search
      const response = await this.makeRequest<ZaisenAPIResponse<FundSearchResult>>(
        '/api/v1/fundos',
        {
          cnpj: formattedCnpj,
          limit: '1',
        }
      );

      return response.funds || [];
    } catch (error) {
      console.error(`Error searching fund by CNPJ ${cnpj}:`, error);
      throw new Error(`Failed to search fund by CNPJ: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchFundsByClass(className: string, limit: number = 50): Promise<FundSearchResult[]> {
    try {
      // Use the working /fundos endpoint instead of /fundos/search
      const response = await this.makeRequest<ZaisenAPIResponse<FundSearchResult>>(
        '/api/v1/fundos',
        {
          classe: className,
          limit: limit.toString(),
        }
      );

      return response.funds || [];
    } catch (error) {
      console.error(`Error searching funds by class ${className}:`, error);
      throw new Error(`Failed to search funds by class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchFundsByManager(managerName: string, limit: number = 50): Promise<FundSearchResult[]> {
    try {
      // Use the working /fundos endpoint instead of /fundos/search
      const response = await this.makeRequest<ZaisenAPIResponse<FundSearchResult>>(
        '/api/v1/fundos',
        {
          gestor: managerName,
          limit: limit.toString(),
        }
      );

      return response.funds || [];
    } catch (error) {
      console.error(`Error searching funds by manager ${managerName}:`, error);
      throw new Error(`Failed to search funds by manager: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export async function createFundAPI(): Promise<ZaisenFundAPI> {
  const baseUrl = process.env.ZAISEN_API_URL;
  const apiKey = process.env.ZAISEN_API_KEY;

  if (!baseUrl) {
    throw new Error('ZAISEN_API_URL environment variable is required');
  }

  if (!apiKey) {
    throw new Error('ZAISEN_API_KEY environment variable is required');
  }

  return new ZaisenFundAPI(baseUrl, apiKey);
}
