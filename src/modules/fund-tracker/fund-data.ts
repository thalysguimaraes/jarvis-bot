import { FundPosition } from './types';

// Example fund portfolio - users should replace with their own positions
// You can load your fund portfolio from environment variables or external configuration
export const FUND_PORTFOLIO: FundPosition[] = JSON.parse(
  process.env.FUND_PORTFOLIO_DATA || 
  JSON.stringify([
    {
      cnpj: '00.000.000/0001-00',
      name: 'Example Fund A',
      quotas: 100,
      investedAmount: 10000,
      avgPrice: 100.0,
      purchaseDate: '2024-01-15'
    },
    {
      cnpj: '11.111.111/0001-11',
      name: 'Example Fund B',
      quotas: 50,
      investedAmount: 5000,
      avgPrice: 100.0,
      purchaseDate: '2024-02-10'
    }
  ])
);

// Helper function to validate CNPJ format
export function isValidCNPJ(cnpj: string): boolean {
  // Remove non-numeric characters
  const cleanCnpj = cnpj.replace(/[^\d]/g, '');
  
  // Check if it has 14 digits
  if (cleanCnpj.length !== 14) {
    return false;
  }
  
  // Basic CNPJ validation
  return true; // For now, just check length. Could implement full CNPJ validation if needed
}

// Helper function to format CNPJ
export function formatCNPJ(cnpj: string): string {
  const cleanCnpj = cnpj.replace(/[^\d]/g, '');
  if (cleanCnpj.length === 14) {
    return cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return cnpj;
}

// Helper function to clean CNPJ (remove formatting)
export function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}
