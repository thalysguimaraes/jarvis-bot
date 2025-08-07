export interface FundPosition {
  id?: string;
  cnpj: string;
  name: string;
  quotas: number;
  avgPrice: number;
  purchaseDate?: string;
  currentQuotaValue?: number;
  currentValue?: number;
  performance?: number;
  performancePercent?: number;
}

export interface UserFundPortfolio {
  userId: string;
  positions: FundPosition[];
  totalInvested: number;
  currentValue: number;
  totalPerformance: number;
  totalPerformancePercent: number;
  lastUpdated: string;
}

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

export interface FundQuote {
  cnpj: string;
  name: string;
  lastQuote: number;
  quoteDate: string;
  dailyChange?: number;
  dailyChangePercent?: number;
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

export interface ZaisenAPIResponse<T> {
  funds?: T[];
  total?: number;
  limit?: number;
  offset?: number;
  has_next?: boolean;
}

export interface FundCommand {
  type: 'add' | 'remove' | 'list' | 'update';
  cnpj?: string;
  quotas?: number;
  avgPrice?: number;
}

export interface FundConfig {
  zaisenApiUrl: string;
  zaisenApiKey: string;
}