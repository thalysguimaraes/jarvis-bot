import { Env } from '@/types/env';
import { ZApiWebhookPayload } from '@/services/whatsapp/types';
import { processAudioMessage } from '@/modules/audio/processor';
import { KVFundStorage } from '@/modules/fund-tracker/storage';
import { ZaisenFundAPI } from '@/modules/fund-tracker/fund-api';
import { FundPosition } from '@/modules/fund-tracker/types';

export class AudioProcessor {
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
  }
  
  public async handleAudioMessage(payload: ZApiWebhookPayload): Promise<void> {
    try {
      if (!payload.audio) {
        console.log('Invalid audio message received');
        return;
      }
      
      const userPhone = payload.from || payload.phone || payload.senderNumber;
      
      // Send initial response
      await this.sendResponse(userPhone, '🎤 Áudio recebido! Processando transcrição...');
      const context = {
        env: this.env,
        userId: userPhone,
        todoistToken: this.env.TODOIST_API_TOKEN,
        zapiPayload: payload
      };
      
      await processAudioMessage(payload, context);
      
    } catch (error) {
      console.error('Error processing audio:', error);
      await this.sendResponse(
        payload.phone,
        '❌ Erro ao processar o áudio. Por favor, tente novamente.'
      );
    }
  }

  public async processFundCommand(
    transcription: string, 
    classification: string, 
    payload: ZApiWebhookPayload
  ): Promise<void> {
    try {
      const userId = payload.phone;
      
      // Initialize fund services
      const fundStorage = new KVFundStorage(this.env.USER_CONFIGS);
      let fundAPI: ZaisenFundAPI | null = null;
      
      // Only initialize API for operations that need it
      if (['fund_quote', 'fund_add'].includes(classification) && 
          this.env.ZAISEN_API_URL && this.env.ZAISEN_API_KEY) {
        fundAPI = new ZaisenFundAPI(this.env.ZAISEN_API_URL, this.env.ZAISEN_API_KEY);
      }

      switch (classification) {
        case 'fund_add':
          await this.handleFundAdd(transcription, userId, fundStorage, fundAPI);
          break;
        case 'fund_remove':
          await this.handleFundRemove(transcription, userId, fundStorage);
          break;
        case 'fund_quote':
          await this.handleFundQuote(transcription, userId, fundAPI);
          break;
        case 'fund_portfolio':
          await this.handleFundPortfolio(userId, fundStorage);
          break;
        case 'fund_update':
          await this.handleFundUpdate(transcription, userId, fundStorage);
          break;
        default:
          await this.sendResponse(
            payload.phone,
            '❌ Comando de fundo não reconhecido.'
          );
      }
    } catch (error) {
      console.error('Error processing fund command:', error);
      await this.sendResponse(
        payload.phone,
        '❌ Erro ao processar comando de fundo. Tente novamente ou seja mais específico.'
      );
    }
  }

  private async handleFundAdd(
    transcription: string,
    userId: string,
    fundStorage: KVFundStorage,
    fundAPI: ZaisenFundAPI | null
  ): Promise<void> {
    await this.sendResponse(userId, '📈 Processando adição de fundo...');

    try {
      const fundData = this.parseFundAddCommand(transcription);
      
      if (!fundData.name && !fundData.cnpj) {
        await this.sendResponse(
          userId,
          '❌ Não consegui identificar o nome ou CNPJ do fundo. Fale algo como: "Adicionar 100 cotas do fundo XYZ que comprei por 50 reais cada"'
        );
        return;
      }

      if (!fundData.quantity || fundData.quantity <= 0) {
        await this.sendResponse(
          userId,
          '❌ Quantidade de cotas não identificada. Especifique quantas cotas foram compradas.'
        );
        return;
      }

      // If we have a fund name but no CNPJ, try to find it via API
      if (!fundData.cnpj && fundData.name && fundAPI) {
        const searchResults = await fundAPI.searchFunds(fundData.name, 5);
        
        if (searchResults.length === 0) {
          await this.sendResponse(
            userId,
            `❌ Não encontrei o fundo "${fundData.name}". Tente usar o CNPJ ou verificar o nome.`
          );
          return;
        }

        if (searchResults.length === 1) {
          fundData.cnpj = searchResults[0].cnpj;
          fundData.name = searchResults[0].nome;
        } else {
          const options = searchResults.slice(0, 3)
            .map((fund, index) => `${index + 1}. ${fund.nome} (${fund.cnpj})`)
            .join('\n');
          
          await this.sendResponse(
            userId,
            `🔍 Encontrei ${searchResults.length} fundos com nome similar:\n\n${options}\n\nPor favor, especifique o CNPJ ou nome completo.`
          );
          return;
        }
      }

      // Calculate average price if not provided
      if (!fundData.avgPrice && fundData.totalAmount) {
        fundData.avgPrice = fundData.totalAmount / fundData.quantity;
      } else if (!fundData.avgPrice) {
        await this.sendResponse(
          userId,
          '❌ Preço por cota não identificado. Fale algo como: "comprei por 50 reais cada" ou "investimento total foi 5000 reais"'
        );
        return;
      }

      const position: FundPosition = {
        cnpj: fundData.cnpj!,
        name: fundData.name!,
        quotas: fundData.quantity,
        avgPrice: fundData.avgPrice,
        investedAmount: fundData.quantity * fundData.avgPrice,
        purchaseDate: new Date().toISOString()
      };

      await fundStorage.addFundPosition(userId, position);

      await this.sendResponse(
        userId,
        `✅ Fundo adicionado ao seu portfólio!\n\n📊 ${position.name}\n💰 ${position.quotas} cotas a R$ ${position.avgPrice.toFixed(2)}\n💵 Total investido: R$ ${(position.investedAmount || 0).toFixed(2)}`
      );

    } catch (error) {
      console.error('Error adding fund:', error);
      await this.sendResponse(
        userId,
        '❌ Erro ao adicionar fundo. Verifique os dados e tente novamente.'
      );
    }
  }

  private async handleFundRemove(
    transcription: string,
    userId: string,
    fundStorage: KVFundStorage
  ): Promise<void> {
    await this.sendResponse(userId, '📉 Processando remoção de fundo...');

    try {
      const removeData = this.parseFundRemoveCommand(transcription);
      
      if (!removeData.identifier) {
        await this.sendResponse(
          userId,
          '❌ Não consegui identificar qual fundo remover. Fale o nome ou CNPJ do fundo.'
        );
        return;
      }

      const portfolio = await fundStorage.getFundPortfolio(userId);
      
      // Find the position by name or CNPJ
      const position = portfolio.positions.find(p => 
        p.cnpj === removeData.identifier ||
        (p.name && removeData.identifier && p.name.toLowerCase().includes(removeData.identifier.toLowerCase()))
      );

      if (!position) {
        await this.sendResponse(
          userId,
          `❌ Fundo "${removeData.identifier}" não encontrado no seu portfólio.`
        );
        return;
      }

      if (removeData.quantity && removeData.quantity > 0) {
        // Partial removal
        const currentQuotas = position.quotas || 0;
        if (removeData.quantity >= currentQuotas) {
          // Remove completely
          await fundStorage.removeFundPosition(userId, position.cnpj);
          await this.sendResponse(
            userId,
            `✅ Fundo ${position.name} removido completamente do portfólio!`
          );
        } else {
          // Partial removal
          const newQuotas = currentQuotas - removeData.quantity;
          await fundStorage.updateFundPosition(userId, position.cnpj, newQuotas);
          await this.sendResponse(
            userId,
            `✅ Removidas ${removeData.quantity} cotas de ${position.name}.\nRestam ${newQuotas} cotas no portfólio.`
          );
        }
      } else {
        // Complete removal
        await fundStorage.removeFundPosition(userId, position.cnpj);
        await this.sendResponse(
          userId,
          `✅ Fundo ${position.name} removido completamente do portfólio!`
        );
      }

    } catch (error) {
      console.error('Error removing fund:', error);
      await this.sendResponse(
        userId,
        '❌ Erro ao remover fundo. Verifique os dados e tente novamente.'
      );
    }
  }

  private async handleFundQuote(
    transcription: string,
    userId: string,
    fundAPI: ZaisenFundAPI | null
  ): Promise<void> {
    await this.sendResponse(userId, '💰 Buscando cotação do fundo...');

    if (!fundAPI) {
      await this.sendResponse(
        userId,
        '❌ Serviço de cotações não configurado. Configure ZAISEN_API_URL e ZAISEN_API_KEY.'
      );
      return;
    }

    try {
      const fundIdentifier = this.parseFundQuoteCommand(transcription);
      
      if (!fundIdentifier) {
        await this.sendResponse(
          userId,
          '❌ Não consegui identificar qual fundo consultar. Fale o nome ou CNPJ do fundo.'
        );
        return;
      }

      let cnpj = fundIdentifier;
      
      // If it doesn't look like a CNPJ, search by name
      if (!/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(fundIdentifier.replace(/\s/g, ''))) {
        const searchResults = await fundAPI.searchFunds(fundIdentifier, 1);
        
        if (searchResults.length === 0) {
          await this.sendResponse(
            userId,
            `❌ Fundo "${fundIdentifier}" não encontrado.`
          );
          return;
        }
        
        cnpj = searchResults[0].cnpj;
      }

      const quote = await fundAPI.getFundQuote(cnpj);
      
      if (!quote) {
        await this.sendResponse(
          userId,
          '❌ Não consegui buscar a cotação deste fundo. Verifique o CNPJ ou nome.'
        );
        return;
      }

      const changeIcon = quote.variacao_dia >= 0 ? '📈' : '📉';
      const changeText = quote.variacao_dia >= 0 ? '+' : '';
      
      await this.sendResponse(
        userId,
        `💰 Cotação atual:\n\n📊 ${quote.nome}\n💵 R$ ${quote.ultima_cota.toFixed(6)}\n📅 ${new Date(quote.data_ultima_cota).toLocaleDateString('pt-BR')}\n${changeIcon} ${changeText}${quote.variacao_percentual.toFixed(2)}% (R$ ${changeText}${quote.variacao_dia.toFixed(6)})`
      );

    } catch (error) {
      console.error('Error fetching fund quote:', error);
      await this.sendResponse(
        userId,
        '❌ Erro ao buscar cotação. Tente novamente ou verifique o nome/CNPJ do fundo.'
      );
    }
  }

  private async handleFundPortfolio(
    userId: string,
    fundStorage: KVFundStorage
  ): Promise<void> {
    await this.sendResponse(userId, '📊 Carregando seu portfólio de fundos...');

    try {
      const portfolio = await fundStorage.getFundPortfolio(userId);
      
      if (portfolio.positions.length === 0) {
        await this.sendResponse(
          userId,
          '📊 Seu portfólio está vazio.\n\nPara adicionar um fundo, fale algo como: "Adicionar 100 cotas do fundo XYZ que comprei por 50 reais cada"'
        );
        return;
      }

      let message = `📊 SEU PORTFÓLIO DE FUNDOS\n\n`;
      
      portfolio.positions.forEach((position, index) => {
        const name = position.name || position.fundName || 'Fundo sem nome';
        const quotas = position.quotas || position.shares || 0;
        const avgPrice = position.avgPrice || 0;
        const invested = position.investedAmount || (quotas * avgPrice);
        
        message += `${index + 1}. ${name}\n`;
        message += `   💰 ${quotas} cotas a R$ ${avgPrice.toFixed(2)}\n`;
        message += `   💵 Investido: R$ ${invested.toFixed(2)}\n`;
        
        if (position.currentValue && position.performance !== undefined) {
          const perfIcon = position.performance >= 0 ? '📈' : '📉';
          const perfText = position.performance >= 0 ? '+' : '';
          message += `   ${perfIcon} Atual: R$ ${position.currentValue.toFixed(2)} (${perfText}${position.performancePercent?.toFixed(2)}%)\n`;
        }
        
        message += `\n`;
      });

      message += `💼 RESUMO TOTAL:\n`;
      message += `💵 Total Investido: R$ ${portfolio.totalInvested.toFixed(2)}\n`;
      
      if (portfolio.currentValue > 0 && portfolio.totalPerformance !== 0) {
        const totalPerfIcon = portfolio.totalPerformance >= 0 ? '📈' : '📉';
        const totalPerfText = portfolio.totalPerformance >= 0 ? '+' : '';
        message += `💰 Valor Atual: R$ ${portfolio.currentValue.toFixed(2)}\n`;
        message += `${totalPerfIcon} Performance: ${totalPerfText}R$ ${portfolio.totalPerformance.toFixed(2)} (${totalPerfText}${portfolio.totalPerformancePercent.toFixed(2)}%)\n`;
      }
      
      message += `\n🕐 Atualizado: ${new Date(portfolio.lastUpdated).toLocaleString('pt-BR')}`;

      await this.sendResponse(userId, message);

    } catch (error) {
      console.error('Error fetching portfolio:', error);
      await this.sendResponse(
        userId,
        '❌ Erro ao carregar portfólio. Tente novamente.'
      );
    }
  }

  private async handleFundUpdate(
    transcription: string,
    userId: string,
    fundStorage: KVFundStorage
  ): Promise<void> {
    await this.sendResponse(userId, '🔄 Processando atualização de posição...');

    try {
      const updateData = this.parseFundUpdateCommand(transcription);
      
      if (!updateData.identifier) {
        await this.sendResponse(
          userId,
          '❌ Não consegui identificar qual fundo atualizar. Fale o nome ou CNPJ do fundo.'
        );
        return;
      }

      const portfolio = await fundStorage.getFundPortfolio(userId);
      
      // Find the position by name or CNPJ
      const position = portfolio.positions.find(p => 
        p.cnpj === updateData.identifier ||
        (p.name && updateData.identifier && p.name.toLowerCase().includes(updateData.identifier.toLowerCase()))
      );

      if (!position) {
        await this.sendResponse(
          userId,
          `❌ Fundo "${updateData.identifier}" não encontrado no seu portfólio.`
        );
        return;
      }

      if (updateData.newQuantity !== undefined) {
        await fundStorage.updateFundPosition(
          userId, 
          position.cnpj, 
          updateData.newQuantity, 
          updateData.newAvgPrice
        );
        
        let message = `✅ Posição atualizada!\n\n📊 ${position.name}\n💰 Nova quantidade: ${updateData.newQuantity} cotas`;
        
        if (updateData.newAvgPrice !== undefined) {
          message += `\n💵 Novo preço médio: R$ ${updateData.newAvgPrice.toFixed(2)}`;
        }
        
        await this.sendResponse(userId, message);
      } else {
        await this.sendResponse(
          userId,
          '❌ Não consegui identificar os novos valores. Fale algo como: "Atualizar fundo XYZ para 150 cotas" ou "Mudar preço médio do fundo XYZ para 55 reais"'
        );
      }

    } catch (error) {
      console.error('Error updating fund:', error);
      await this.sendResponse(
        userId,
        '❌ Erro ao atualizar posição. Verifique os dados e tente novamente.'
      );
    }
  }

  // Text parsing methods for Portuguese voice commands
  private parseFundAddCommand(transcription: string): {
    name?: string;
    cnpj?: string;
    quantity?: number;
    avgPrice?: number;
    totalAmount?: number;
  } {
    const text = transcription.toLowerCase();
    
    // Extract fund name (look for common patterns)
    let name: string | undefined;
    
    // Look for "fundo [name]" patterns
    const fundNameMatch = text.match(/(?:fundo|fund)\s+([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s+(?:que|cnpj|com|por|cotas|quotas)|\s*$)/i);
    if (fundNameMatch) {
      name = fundNameMatch[1].trim();
    }
    
    // Look for quoted fund names
    const quotedMatch = text.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      name = quotedMatch[1];
    }
    
    // Extract CNPJ
    let cnpj: string | undefined;
    const cnpjMatch = text.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
    if (cnpjMatch) {
      cnpj = cnpjMatch[1].replace(/[^\d]/g, '');
    }
    
    // Extract quantity
    let quantity: number | undefined;
    const quantityMatches = [
      text.match(/(\d+(?:\.\d+)?)\s*(?:cotas?|quotas?)/),
      text.match(/(?:comprei|comprar|adicionar)\s+(\d+(?:\.\d+)?)/),
      text.match(/(\d+(?:\.\d+)?)\s*(?:do|de)/),
    ];
    
    for (const match of quantityMatches) {
      if (match) {
        quantity = parseFloat(match[1]);
        break;
      }
    }
    
    // Extract average price
    let avgPrice: number | undefined;
    const priceMatches = [
      text.match(/(?:por|preço|custou|valor)\s+(?:de\s+)?(?:r\$\s*)?(\d+(?:[\.,]\d+)?)/),
      text.match(/(\d+(?:[\.,]\d+)?)\s*reais?\s+(?:cada|por\s+cota)/),
      text.match(/a\s+(?:r\$\s*)?(\d+(?:[\.,]\d+)?)/),
    ];
    
    for (const match of priceMatches) {
      if (match) {
        avgPrice = parseFloat(match[1].replace(',', '.'));
        break;
      }
    }
    
    // Extract total amount
    let totalAmount: number | undefined;
    const totalMatches = [
      text.match(/(?:total|investimento|investir|gastei|paguei)\s+(?:de\s+)?(?:r\$\s*)?(\d+(?:[\.,]\d+)?)/),
      text.match(/(\d+(?:[\.,]\d+)?)\s*reais?\s+(?:total|no\s+total)/),
    ];
    
    for (const match of totalMatches) {
      if (match) {
        totalAmount = parseFloat(match[1].replace(',', '.'));
        break;
      }
    }
    
    return { name, cnpj, quantity, avgPrice, totalAmount };
  }

  private parseFundRemoveCommand(transcription: string): {
    identifier?: string;
    quantity?: number;
  } {
    const text = transcription.toLowerCase();
    
    // Extract fund identifier (name or CNPJ)
    let identifier: string | undefined;
    
    // Look for "fundo [name]" or "do [name]" patterns
    const identifierMatches = [
      text.match(/(?:fundo|fund)\s+([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s+(?:que|cnpj|com|por|cotas|quotas|remover|vender)|\s*$)/i),
      text.match(/(?:remover|vender|tirar).*?(?:do|da|de)\s+([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s|$)/i),
      text.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/),
    ];
    
    for (const match of identifierMatches) {
      if (match) {
        identifier = match[1].trim();
        break;
      }
    }
    
    // Extract quantity to remove
    let quantity: number | undefined;
    const quantityMatches = [
      text.match(/(?:remover|vender|tirar)\s+(\d+(?:\.\d+)?)\s*(?:cotas?|quotas?)/),
      text.match(/(\d+(?:\.\d+)?)\s*(?:cotas?|quotas?).*?(?:do|da|de)/),
    ];
    
    for (const match of quantityMatches) {
      if (match) {
        quantity = parseFloat(match[1]);
        break;
      }
    }
    
    return { identifier, quantity };
  }

  private parseFundQuoteCommand(transcription: string): string | undefined {
    const text = transcription.toLowerCase();
    
    // Look for CNPJ first
    const cnpjMatch = text.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
    if (cnpjMatch) {
      return cnpjMatch[1];
    }
    
    // Look for fund name patterns
    const nameMatches = [
      text.match(/(?:cotação|cota|preço|valor).*?(?:do|da|de)\s+(?:fundo\s+)?([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s|$)/i),
      text.match(/(?:fundo|fund)\s+([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s+(?:cotação|cota|preço|valor)|\s*$)/i),
      text.match(/["']([^"']+)["']/),
    ];
    
    for (const match of nameMatches) {
      if (match) {
        return match[1].trim();
      }
    }
    
    return undefined;
  }

  private parseFundUpdateCommand(transcription: string): {
    identifier?: string;
    newQuantity?: number;
    newAvgPrice?: number;
  } {
    const text = transcription.toLowerCase();
    
    // Extract fund identifier
    let identifier: string | undefined;
    
    const identifierMatches = [
      text.match(/(?:atualizar|mudar|alterar).*?(?:do|da|de)\s+(?:fundo\s+)?([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s+(?:para|com|por)|\s|$)/i),
      text.match(/(?:fundo|fund)\s+([a-záàâãéèêíìîóòôõúùûç\s\w\d]+?)(?:\s+(?:para|com|por|atualizar)|\s*$)/i),
      text.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/),
    ];
    
    for (const match of identifierMatches) {
      if (match) {
        identifier = match[1].trim();
        break;
      }
    }
    
    // Extract new quantity
    let newQuantity: number | undefined;
    const quantityMatches = [
      text.match(/(?:para|com|por)\s+(\d+(?:\.\d+)?)\s*(?:cotas?|quotas?)/),
      text.match(/(\d+(?:\.\d+)?)\s*(?:cotas?|quotas?)/),
    ];
    
    for (const match of quantityMatches) {
      if (match) {
        newQuantity = parseFloat(match[1]);
        break;
      }
    }
    
    // Extract new average price
    let newAvgPrice: number | undefined;
    const priceMatches = [
      text.match(/(?:preço|valor|por)\s+(?:de\s+)?(?:r\$\s*)?(\d+(?:[\.,]\d+)?)/),
      text.match(/(\d+(?:[\.,]\d+)?)\s*reais?\s+(?:cada|por\s+cota)/),
    ];
    
    for (const match of priceMatches) {
      if (match) {
        newAvgPrice = parseFloat(match[1].replace(',', '.'));
        break;
      }
    }
    
    return { identifier, newQuantity, newAvgPrice };
  }
   
  private async sendResponse(to: string, message: string): Promise<void> {
    // Send response back via Z-API
    if (!this.env.Z_API_INSTANCE_ID || !this.env.Z_API_INSTANCE_TOKEN || !this.env.Z_API_SECURITY_TOKEN) {
      console.error('Z-API credentials not configured');
      return;
    }
    
    try {
      const url = `https://api.z-api.io/instances/${this.env.Z_API_INSTANCE_ID}/token/${this.env.Z_API_INSTANCE_TOKEN}/send-text`;
      const body = {
        phone: to,
        message
      };
      
      console.log('Sending Z-API message from AudioProcessor:', {
        url,
        to,
        messageLength: message.length,
        hasClientToken: !!this.env.Z_API_SECURITY_TOKEN
      });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.env.Z_API_SECURITY_TOKEN
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Z-API error response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`Z-API error: ${response.status} - ${errorText}`);
      }
      
      console.log('Z-API message sent successfully from AudioProcessor');
    } catch (error) {
      console.error('Error sending response via Z-API:', error);
    }
  }
}