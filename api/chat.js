import OpenAI from 'openai';

// Configuração do Cliente OpenAI
// Certifique-se de ter a variável OPENAI_API_KEY no seu .env.local no Vercel
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Constrói o Prompt de Sistema Dinâmico
 * Injeta os dados reais do usuário (contas, cartões, categorias) nas instruções da IA
 */
const generateSystemPrompt = (context) => {
  const { 
    user_name, 
    accounts = [], 
    credit_cards = [], 
    categories = [],
    current_date 
  } = context;

  // Formata listas para a IA entender o que está disponível
  const accountList = accounts.map(a => `- ${a.name} (ID: ${a.id}, Tipo: ${a.type})`).join('\n');
  const cardList = credit_cards.map(c => `- ${c.name} (ID: ${c.id})`).join('\n');
  const categoryList = categories.map(c => `- ${c.name} (ID: ${c.id}, Tipo: ${c.type})`).join('\n');

  return `
Você é a IA do "Family Finance", um assistente financeiro pessoal, empático e extremamente organizado.
O usuário se chama ${user_name}.
Data atual: ${current_date} (Use esta data como default se o usuário não especificar outra).

### OBJETIVO
Seu objetivo é interpretar linguagem natural e transformar em transações financeiras estruturadas (JSON), seguindo regras rígidas de banco de dados.

### CONTEXTO ATUAL DO USUÁRIO (Dados Reais - USE APENAS ESTES IDs)
CONTAS/CARTEIRAS DISPONÍVEIS:
${accountList}

CARTÕES DE CRÉDITO DISPONÍVEIS:
${cardList}

CATEGORIAS DISPONÍVEIS:
${categoryList}

### REGRAS DE OURO
1. **Nunca invente IDs**. Se o usuário falar "Nubank" e você não achar na lista acima, pergunte ou use o ID mais provável se a similaridade for óbvia.
2. **Confirmação Obrigatória**: Antes de salvar (action: 'success'), você deve montar o json completo e pedir confirmação (action: 'awaiting_confirmation').
3. **Falta de Dados**: Se faltar conta, valor ou descrição, pergunte (action: 'need_more_info').
4. **Categoria**: Tente inferir a categoria pelo contexto (Ex: "McDonalds" -> Alimentação).

### ESTADOS E AÇÕES DE RESPOSTA (JSON OBRIGATÓRIO)
Sua resposta deve ser SEMPRE um objeto JSON estrito com esta estrutura:
{
  "action": "need_more_info" | "awaiting_confirmation" | "success" | "cancelled" | "query_balance",
  "reply": "Texto amigável para o usuário (use emojis)",
  "data": { ... payload da transação ... }
}

#### 1. ACTION: need_more_info
Use quando faltar: Valor, Descrição ou Conta/Cartão de origem.
Exemplo: Usuário disse "Gastei 50 reais".
Retorno:
{
  "action": "need_more_info",
  "reply": "Entendido! Esses R$ 50,00 saíram de qual conta? (Dinheiro, Nubank...)?",
  "data": { "missing_field": "account_id" }
}

#### 2. ACTION: awaiting_confirmation
Use quando tiver todos os dados. Mostre o resumo.
Exemplo:
{
  "action": "awaiting_confirmation",
  "reply": "Confirma o lançamento?\n\n🛒 Mercado\n💰 R$ 50,00\n💳 Conta: Nubank\n📂 Categoria: Alimentação\n\nResponda Sim ou Não.",
  "data": {
    "type": "expense",
    "amount": 50.00,
    "description": "Mercado",
    "frequency": "variable",
    "payment_method": "account", // ou 'credit_card_cash' ou 'credit_card_installments'
    "account_id": "uuid-real-da-conta", 
    "category_id": "uuid-real-da-categoria",
    "date": "YYYY-MM-DD"
  }
}

#### 3. ACTION: success
Use APENAS quando o usuário responder "Sim", "Confirma", "Ok" APÓS o estado de 'awaiting_confirmation'.
{
  "action": "success",
  "reply": "Feito! Lançamento salvo com sucesso. ✅",
  "data": { ...mesmo objeto data confirmado... }
}

#### 4. LOGICA DE CARTÃO DE CRÉDITO
- Se for à vista no crédito: payment_method = 'credit_card_cash', requer 'card_id'.
- Se for parcelado: payment_method = 'credit_card_installments', requer 'card_id', 'installments' (número) e 'amount' (valor TOTAL da compra).

### EXEMPLOS DE FLUXO

Usuario: "Comprei uma TV de 2000 em 10x no Visa"
IA Identifica: Card "Visa" na lista, valor 2000, parcelas 10.
Ação: awaiting_confirmation.

Usuario: "Não, foram 12x"
IA Identifica: Correção. Mantém o resto, altera parcelas para 12.
Ação: awaiting_confirmation.
`;
};

export default async function handler(req, res) {
  // Configuração para CORS (Opcional, dependendo de como você chama o backend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Recebe os dados do Front-end
    // message: O texto novo do usuário
    // history: O histórico recente de mensagens (array de {role, content})
    // context: O objeto com accounts, cards, user_name, etc.
    const { message, history, context } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 2. Prepara o System Prompt com os dados do usuário
    const systemInstruction = generateSystemPrompt(context || {});

    // 3. Monta a lista de mensagens para a OpenAI
    const messagesPayload = [
      { role: "system", content: systemInstruction },
      ...(history || []), // Histórico anterior (opcional)
      { role: "user", content: message } // Mensagem atual
    ];

    // 4. Chamada à API da OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Ou "gpt-3.5-turbo" para economizar, ou "gpt-4o" para máxima inteligência
      messages: messagesPayload,
      temperature: 0.3, // Baixa temperatura para ser mais preciso e menos "criativo" com dados
      response_format: { type: "json_object" }, // FORÇA O RETORNO JSON
    });

    // 5. Processa a resposta
    const aiResponseContent = completion.choices[0].message.content;
    
    // Tenta fazer o parse do JSON retornado pela IA
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponseContent);
    } catch (e) {
      console.error("Erro ao fazer parse do JSON da IA:", aiResponseContent);
      // Fallback em caso de erro grave da IA
      parsedResponse = {
        action: "need_more_info",
        reply: "Desculpe, não entendi. Poderia repetir o valor e a conta?",
        data: {}
      };
    }

    // 6. Retorna para o Front-end
    return res.status(200).json(parsedResponse);

  } catch (error) {
    console.error('Error in Chat.js:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message 
    });
  }
}
