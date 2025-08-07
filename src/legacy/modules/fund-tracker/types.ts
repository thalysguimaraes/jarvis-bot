// Fund position interface that supports both legacy and new formats
export interface FundPosition {
  id?: string;
  cnpj: string;
  // Support both legacy and new naming
  fundName?: string;
  name?: string;
  shares?: number;
  quotas?: number;
  investedAmount?: number;
  avgPrice: number;
  addedDate?: string;
  purchaseDate?: string;
  currentQuotaValue?: number;
  currentValue?: number;
  performance?: number;
  performancePercent?: number;
}

// Existing user fund portfolio interface for storage
export interface UserFundPortfolio {
  userId?: string;
  positions: FundPosition[];
  totalInvested: number;
  currentValue: number;
  totalPerformance: number;
  totalPerformancePercent: number;
  lastUpdated: string;
}

// Existing portfolio calculation interface
export interface FundPortfolioCalculation {
  totalInvested: number;
  currentValue: number;
  totalPerformance: number;
  totalPerformancePercent: number;
  positions: Array<{
    cnpj: string;
    name: string;
    quotas: number;
    avgPrice: number;
    currentQuotaValue: number;
    currentValue: number;
    performance: number;
    performancePercent: number;
  }>;
}

// New interfaces for API integration
export interface FundQuote {
  cnpj: string;
  name: string;
  lastQuote: number;
  quoteDate: string;
  dailyChange: number;
  dailyChangePercent: number;
}

export interface FundSearchResult {
  cnpj: string;
  nome: string;
  classe: string;
  situacao: string;
  administrador: string;
  gestor: string;
  patrimonio_liquido: number;
}

export interface FundDetails {
  cnpj: string;
  nome: string;
  classe: string;
  situacao: string;
  administrador: string;
  gestor: string;
  patrimonio_liquido: number;
  ultima_cota?: number;
  data_ultima_cota?: string;
  variacao_dia?: number;
  variacao_percentual?: number;
  patrimonio_liquido_atualizado?: number;
  numero_cotistas_atualizado?: number;
}

export interface FundCalculation {
  currentValue: number;
  totalCost: number;
  dailyPnL: number;
  dailyPercentageChange: number;
  totalPnL: number;
  totalPercentageChange: number;
  details: Array<{
    cnpj: string;
    name: string;
    currentQuote: number | null;
    position: number;
    dailyChange: number;
    dailyChangePercent: number;
  }>;
}

export interface ZaisenAPIResponse<T> {
  funds?: T[];
  total?: number;
  limit?: number;
  offset?: number;
  has_next?: boolean;
}

export interface LatestQuoteResponse {
  cnpj: string;
  nome: string;
  ultima_cota: number;
  data_ultima_cota: string;
  variacao_dia: number;
  variacao_percentual: number;
  patrimonio_liquido: number;
  numero_cotistas: number;
}
