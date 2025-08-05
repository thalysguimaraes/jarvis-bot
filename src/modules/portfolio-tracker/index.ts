import { calculatePortfolioValue } from './calculator';
import { formatPortfolioMessage } from './message-formatter';
import { sendWhatsAppMessage } from './whatsapp-sender';
import { calculateFundPortfolioValue, ZaisenFundAPI } from '../fund-tracker';
import { loadFundPortfolioData } from '../fund-tracker/fund-data';

export interface PortfolioConfig {
  brapiToken: string;
  zApiInstanceId: string;
  zApiInstanceToken: string;
  zApiSecurityToken: string;
  whatsappNumber: string;
  zaisenApiUrl?: string;
  zaisenApiKey?: string;
}

export interface CombinedPortfolioData {
  stocks: any;
  funds: any;
  hasFunds: boolean;
}

export class PortfolioTracker {
  constructor(private config: PortfolioConfig) {}

  async sendDailyReport(portfolioDataEnv?: string, fundPortfolioDataEnv?: string): Promise<void> {
    try {
      console.log('Starting portfolio calculation...');
      
      const portfolioData = await this.getCombinedPortfolioData(portfolioDataEnv, fundPortfolioDataEnv);
      const message = formatPortfolioMessage(portfolioData.stocks, portfolioData.funds, portfolioData.hasFunds);
      
      await sendWhatsAppMessage(
        this.config.zApiInstanceId,
        this.config.zApiInstanceToken,
        this.config.zApiSecurityToken,
        this.config.whatsappNumber,
        message
      );
      
      console.log('Portfolio WhatsApp message sent successfully');
    } catch (error) {
      console.error('Error sending portfolio report:', error);
      throw error;
    }
  }

  async getPortfolioData(portfolioData?: string) {
    return calculatePortfolioValue(this.config.brapiToken, portfolioData);
  }

  async getFundPortfolioData(fundPortfolioData?: string) {
    if (!this.config.zaisenApiUrl || !this.config.zaisenApiKey) {
      console.log('Fund tracking disabled - missing Zaisen API configuration');
      return null;
    }

    try {
      const fundPortfolio = loadFundPortfolioData(fundPortfolioData);
      const fundAPI = new ZaisenFundAPI(this.config.zaisenApiUrl, this.config.zaisenApiKey);
      return await calculateFundPortfolioValue(fundPortfolio, fundAPI);
    } catch (error) {
      console.error('Error calculating fund portfolio:', error);
      return null;
    }
  }

  async getCombinedPortfolioData(portfolioData?: string, fundPortfolioData?: string): Promise<CombinedPortfolioData> {
    const [stocksData, fundsData] = await Promise.all([
      calculatePortfolioValue(this.config.brapiToken, portfolioData),
      this.getFundPortfolioData(fundPortfolioData)
    ]);

    return {
      stocks: stocksData,
      funds: fundsData,
      hasFunds: fundsData !== null
    };
  }

  isFundTrackingEnabled(): boolean {
    return !!(this.config.zaisenApiUrl && this.config.zaisenApiKey);
  }
}

export * from './types';
export * from './calculator';
export * from './message-formatter';
export * from './whatsapp-sender';
