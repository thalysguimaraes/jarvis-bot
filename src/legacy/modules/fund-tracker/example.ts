// Example usage of KVFundStorage
import { KVFundStorage } from './storage';
import { FundPosition } from './types';

export async function exampleUsage(kv: KVNamespace) {
  const storage = new KVFundStorage(kv);
  const userId = 'user123';
  
  // Example: Add a new fund position
  const newPosition: FundPosition = {
    cnpj: '00.017.024/0001-53',
    name: 'BRADESCO FIA',
    quotas: 1000,
    avgPrice: 150.25,
    investedAmount: 150250,
    purchaseDate: '2024-01-15'
  };
  
  await storage.addFundPosition(userId, newPosition);
  
  // Example: Get user's portfolio
  const portfolio = await storage.getFundPortfolio(userId);
  console.log('Portfolio:', portfolio);
  
  // Example: Update a position
  await storage.updateFundPosition(userId, '00.017.024/0001-53', 1500, 155.00);
  
  // Example: Remove a position
  await storage.removeFundPosition(userId, '00.017.024/0001-53');
  
  // Example: Get all user IDs with portfolios
  const allUsers = await storage.getAllUserPortfolios();
  console.log('Users with portfolios:', allUsers);
}

export async function legacyCompatibilityExample(kv: KVNamespace) {
  const storage = new KVFundStorage(kv);
  const userId = 'user456';
  
  // Example: Add position using legacy property names (shares, fundName, addedDate)
  const legacyPosition: FundPosition = {
    cnpj: '11.361.249/0001-00',
    fundName: 'ITAU ACAO',
    shares: 500,
    avgPrice: 200.80,
    addedDate: '2024-02-10'
  };
  
  await storage.addFundPosition(userId, legacyPosition);
  
  // The storage will normalize it to use consistent property names internally
  const portfolio = await storage.getFundPortfolio(userId);
  console.log('Portfolio with normalized properties:', portfolio);
}
