/**
 * Timezone utility for consistent date/time handling in São Paulo timezone (GMT-3)
 */

/**
 * Get current date/time in São Paulo timezone
 */
export function getSaoPauloNow(): Date {
  return new Date();
}

/**
 * Format date in Brazilian format (DD/MM/YYYY)
 */
export function formatBrazilianDate(date: Date = new Date()): string {
  return date.toLocaleDateString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });
}

/**
 * Format time in Brazilian format (HH:MM)
 */
export function formatBrazilianTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', 
    minute: '2-digit'
  });
}

/**
 * Format date and time in Brazilian format
 */
export function formatBrazilianDateTime(date: Date = new Date()): string {
  return `${formatBrazilianDate(date)} às ${formatBrazilianTime(date)}`;
}

/**
 * Get ISO string in São Paulo timezone
 * Note: This still returns UTC ISO format but represents the correct São Paulo time
 */
export function getSaoPauloISOString(): string {
  const now = new Date();
  // Get São Paulo offset (-3 hours from UTC)
  const saoPauloOffset = -3 * 60; // in minutes
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const saoPauloTime = new Date(utcTime + (saoPauloOffset * 60000));
  return saoPauloTime.toISOString();
}

/**
 * Format number in Brazilian currency format
 */
export function formatBrazilianCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

/**
 * Check if current time is within business hours in São Paulo (9 AM - 6 PM)
 */
export function isBusinessHours(): boolean {
  const now = new Date();
  const saoPauloHour = parseInt(
    now.toLocaleTimeString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false
    }).split(':')[0]
  );
  return saoPauloHour >= 9 && saoPauloHour < 18;
}

/**
 * Get current hour in São Paulo timezone
 */
export function getSaoPauloHour(): number {
  const now = new Date();
  return parseInt(
    now.toLocaleTimeString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false
    }).split(':')[0]
  );
}