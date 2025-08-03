import { ClassificationResult, ClassificationContext } from './types';

export class TranscriptionClassifier {
  private openAiApiKey: string;
  private confidenceThreshold: number;

  constructor(openAiApiKey: string, confidenceThreshold = 0.8) {
    this.openAiApiKey = openAiApiKey;
    this.confidenceThreshold = confidenceThreshold;
  }

  async classify(context: ClassificationContext): Promise<ClassificationResult> {
    try {
      const aiResult = await this.aiClassify(context.transcription);
      
      if (aiResult.confidence >= this.confidenceThreshold) {
        return aiResult;
      }
      
      const keywordResult = this.keywordClassify(context.transcription);
      
      return {
        type: aiResult.type,
        confidence: (aiResult.confidence + keywordResult.confidence) / 2,
        reasoning: `AI: ${aiResult.reasoning}, Keywords: ${keywordResult.reasoning}`
      };
    } catch (error) {
      console.error('AI classification failed, using keyword fallback:', error);
      return this.keywordClassify(context.transcription);
    }
  }

  private async aiClassify(transcription: string): Promise<ClassificationResult> {
    const systemPrompt = `You are a classifier that determines the type of a transcription. Options:

1. TASK - General action item to be done
2. NOTE - Information, thought, or observation to remember
3. FUND_ADD - Adding funds/cotas to investment portfolio
4. FUND_REMOVE - Removing/selling funds/cotas from portfolio  
5. FUND_QUOTE - Getting current price/quote of a fund
6. FUND_PORTFOLIO - Portfolio summary or overview request
7. FUND_UPDATE - Updating existing fund positions

TASK examples:
- "Comprar leite amanhã"
- "Ligar para o dentista"
- "Pagar conta de luz"

NOTE examples:
- "Ideia para o projeto novo"
- "Lembrete que o João gosta de café"

FUND_ADD examples:
- "Adicionar 100 cotas do fundo Bradesco FIA"
- "Comprei 50 cotas do XP Ações"
- "Investi 1000 reais no fundo Verde"

FUND_REMOVE examples:
- "Vendi 50 cotas do XP Ações"
- "Remover o fundo Bradesco da carteira"
- "Resgatar 200 cotas do fundo Itaú"

FUND_QUOTE examples:
- "Qual a cota do PETR11?"
- "Preço atual do fundo XP Ações"
- "Cotação do Bradesco FIA hoje"

FUND_PORTFOLIO examples:
- "Meu portfolio de fundos"
- "Resumo da carteira"
- "Como está minha carteira de investimentos"

FUND_UPDATE examples:
- "Atualizar quantidade do fundo Verde para 150 cotas"
- "Modificar posição no Bradesco FIA"

Respond with JSON only: {"type": "task"|"note"|"fund_add"|"fund_remove"|"fund_quote"|"fund_portfolio"|"fund_update", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openAiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Classify this transcription: "${transcription}"` }
        ],
        temperature: 0.3,
        max_tokens: 150,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const result = JSON.parse(data.choices[0].message.content);
    
    return {
      type: result.type as 'task' | 'note' | 'fund_add' | 'fund_remove' | 'fund_quote' | 'fund_portfolio' | 'fund_update',
      confidence: result.confidence || 0.5,
      reasoning: result.reasoning || 'AI classification'
    };
  }

  private keywordClassify(transcription: string): ClassificationResult {
    const lowerText = transcription.toLowerCase();
    
    const taskKeywords = [
      'fazer', 'preciso', 'tenho que', 'lembrar de', 'comprar', 
      'pagar', 'ligar', 'enviar', 'marcar', 'agendar', 'terminar',
      'completar', 'resolver', 'consertar', 'preparar', 'organizar'
    ];
    
    const noteKeywords = [
      'ideia', 'pensei', 'observei', 'notei', 'lembrete sobre',
      'informação', 'descobri', 'aprendi', 'interessante', 'curioso',
      'reflexão', 'insight', 'dica', 'sugestão'
    ];
    
    // Check for fund keywords first
    let fundAddScore = 0;
    let fundRemoveScore = 0;
    let fundQuoteScore = 0;
    let fundPortfolioScore = 0;
    let fundUpdateScore = 0;
    
    // Strong action verbs get priority scoring
    const strongActionVerbs = {
      add: ['adicionar', 'comprei', 'investi', 'aplicar', 'aportar'],
      remove: ['vendi', 'vender', 'remover', 'resgatar', 'liquidar'],
      update: ['atualizar', 'modificar', 'alterar', 'mudar'],
      quote: ['qual', 'preço', 'cotação', 'quanto'],
      portfolio: ['portfolio', 'carteira', 'resumo', 'posições']
    };
    
    // Check for strong action verbs first (higher priority)
    Object.entries(strongActionVerbs).forEach(([action, verbs]) => {
      verbs.forEach(verb => {
        if (lowerText.includes(verb)) {
          switch (action) {
            case 'add': fundAddScore += 3; break;
            case 'remove': fundRemoveScore += 3; break;
            case 'update': fundUpdateScore += 3; break;
            case 'quote': fundQuoteScore += 3; break;
            case 'portfolio': fundPortfolioScore += 3; break;
          }
        }
      });
    });
    
    // Then check for weaker supporting keywords
    const supportingKeywords = {
      add: ['cotas do'],
      quote: ['cota', 'valor', 'hoje'],
      portfolio: ['fundos', 'investimentos']
    };
    
    Object.entries(supportingKeywords).forEach(([action, keywords]) => {
      keywords.forEach(keyword => {
        if (lowerText.includes(keyword)) {
          switch (action) {
            case 'add': fundAddScore += 1; break;
            case 'quote': fundQuoteScore += 1; break;
            case 'portfolio': fundPortfolioScore += 1; break;
          }
        }
      });
    });
    
    // Fund-specific patterns
    const fundNamePattern = /\b(fundo|fia|fii|fidc|etf|bradesco|itau|santander|bb|xp|btg|nubank|inter|petr\d+|vale\d+|itub\d+|bbdc\d+|cotas?)\b/i;
    const isFundRelated = fundNamePattern.test(lowerText);
    
    // Special boosting for specific patterns
    if (isFundRelated) {
      // Boost all fund scores when fund-related terms are detected
      if (fundAddScore > 0) fundAddScore += 2;
      if (fundRemoveScore > 0) fundRemoveScore += 2;
      if (fundQuoteScore > 0) fundQuoteScore += 2;
      if (fundPortfolioScore > 0) fundPortfolioScore += 2;
      if (fundUpdateScore > 0) fundUpdateScore += 2;
    }
    
    // Additional specific patterns
    if (/\b(atualizar|modificar|alterar|mudar)\b.*\b(fundo|quantidade|posição)\b/i.test(lowerText)) {
      fundUpdateScore += 3;
    }
    
    if (/\b(qual|preço|cotação|cota|valor)\b.*\b(fundo|\w+\d+)\b/i.test(lowerText)) {
      fundQuoteScore += 2;
    }
    
    // Determine fund classification
    const fundScores = {
      fund_add: fundAddScore,
      fund_remove: fundRemoveScore,
      fund_quote: fundQuoteScore,
      fund_portfolio: fundPortfolioScore,
      fund_update: fundUpdateScore
    };
    
    const maxFundScore = Math.max(...Object.values(fundScores));
    
    if (maxFundScore > 0) {
      const fundType = Object.keys(fundScores).find(key => 
        fundScores[key as keyof typeof fundScores] === maxFundScore
      ) as 'fund_add' | 'fund_remove' | 'fund_quote' | 'fund_portfolio' | 'fund_update';
      
      return {
        type: fundType,
        confidence: Math.min(0.9, maxFundScore / 3),
        reasoning: `Fund keywords detected: ${fundType.replace('fund_', '')}`
      };
    }
    
    // Fall back to task/note classification
    let taskScore = 0;
    let noteScore = 0;
    
    taskKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) taskScore++;
    });
    
    noteKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) noteScore++;
    });
    
    const futureTimeRegex = /\b(amanhã|depois|próxim[oa]|semana que vem|mês que vem|hoje|mais tarde)\b/;
    if (futureTimeRegex.test(lowerText)) {
      taskScore += 2;
    }
    
    const actionVerbRegex = /^(preciso|tenho que|vou|devo|posso)/;
    if (actionVerbRegex.test(lowerText)) {
      taskScore += 2;
    }
    
    const totalScore = taskScore + noteScore || 1;
    const taskProbability = taskScore / totalScore;
    
    return {
      type: taskProbability > 0.5 ? 'task' : 'note',
      confidence: Math.abs(taskProbability - 0.5) * 2,
      reasoning: `Task keywords: ${taskScore}, Note keywords: ${noteScore}`
    };
  }

  isHighConfidence(result: ClassificationResult): boolean {
    return result.confidence >= this.confidenceThreshold;
  }
}