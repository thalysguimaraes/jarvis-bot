# Fund Tracker Module

Brazilian investment fund portfolio tracking via voice commands and Zaisen Helper API integration.

## Features

- 🎙️ **Voice Commands**: Manage fund portfolio through Portuguese WhatsApp voice messages
- 💰 **Real-time Quotes**: Live fund quotes from CVM via Zaisen API
- 📊 **Portfolio Tracking**: Complete fund portfolio management with performance metrics
- 📱 **WhatsApp Integration**: Seamless voice-to-action fund management
- 🇧🇷 **Brazilian Funds**: Support for all Brazilian investment funds (28,716+ funds)

## Voice Commands (Portuguese)

### Add Funds
- *"Adicionar 100 cotas do fundo Bradesco FIA"*
- *"Comprei 50 cotas do XP Ações por 150 reais cada"*
- *"Investir no PETR11 com 200 cotas"*

### Remove Funds
- *"Vendi 50 cotas do Bradesco FIA"*
- *"Remover todo o investimento do XP Ações"*
- *"Sair completamente do PETR11"*

### Get Quotes
- *"Qual a cota do PETR11?"*
- *"Cotação do fundo XP Ações"*
- *"Preço atual do Bradesco FIA"*

### Portfolio Management
- *"Meu portfolio de fundos"*
- *"Como estão meus fundos hoje?"*
- *"Relatório dos fundos"*

### Update Positions
- *"Atualizar XP Ações para 150 cotas"*
- *"Mudei a quantidade do Bradesco para 200 cotas"*

## API Integration

### Zaisen Helper API Endpoints Used

- **Search Funds**: `GET /api/v1/fundos/search?nome={name}`
- **Fund Details**: `GET /api/v1/fundos/{cnpj}`
- **Latest Quote**: `GET /api/v1/fundos/{cnpj}/ultima-cota`

### Environment Variables

```env
ZAISEN_API_URL=https://your-zaisen-api.com
ZAISEN_API_KEY=your-api-key
```

## Module Structure

```
src/modules/fund-tracker/
├── index.ts              # Main exports
├── types.ts              # TypeScript interfaces
├── fund-api.ts           # Zaisen API client
├── calculator.ts         # Portfolio calculations
├── storage.ts            # KV storage management
├── fund-data.ts          # Sample data and utilities
└── README.md            # This file
```

## Usage Example

```typescript
import { KVFundStorage, ZaisenFundAPI, calculateFundPortfolio } from './modules/fund-tracker';

// Initialize services
const storage = new KVFundStorage(env.USER_CONFIGS);
const api = new ZaisenFundAPI(env.ZAISEN_API_URL, env.ZAISEN_API_KEY);

// Add fund to portfolio
await storage.addFundPosition('user123', {
  cnpj: '00.000.000/0001-91',
  name: 'BRADESCO FIA EXEMPLO',
  quotas: 100,
  avgPrice: 150.50,
  investedAmount: 15050,
  purchaseDate: new Date().toISOString()
});

// Get portfolio performance
const portfolio = await storage.getFundPortfolio('user123');
const performance = await calculateFundPortfolio(portfolio, api);
```

## Integration Points

### With Portfolio Tracker
- Combined daily reports (stocks + funds)
- Unified performance metrics
- Single WhatsApp message format

### With Classification System
- Fund-specific command recognition
- Portuguese language support
- Context-aware classification

### With Audio Processor
- Voice command parsing
- Natural language understanding
- Error handling and user feedback

## Data Storage

User fund portfolios are stored in Cloudflare KV with the key pattern:
```
fund-portfolio:{userId}
```

Portfolio data includes:
- Fund positions with quantities and prices
- Performance metrics and calculations
- Last updated timestamps
- Total invested amounts and current values

## Error Handling

- **API Failures**: Graceful fallback with user notification
- **Invalid CNPJs**: Automatic search and suggestion
- **Missing Data**: Clear error messages in Portuguese
- **Rate Limiting**: Automatic retry with exponential backoff

## Performance Features

- **Parallel API Calls**: Multiple fund quotes fetched simultaneously
- **Caching**: KV storage for portfolio data persistence
- **Rate Limiting**: Prevents API overload
- **Batch Operations**: Efficient portfolio calculations
