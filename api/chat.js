import OpenAI from "openai";

/**
 * Mapeamento de palavras-chave para categorização automática
 */
const categoryMapping = [
  { regex: /(mercado|supermercado|padaria|ifood|almoço|restaurante|pizza|lanche)/i, category: "Alimentação" },
  { regex: /(uber|99|gasolina|combustível|estacionamento|pedágio)/i, category: "Transporte" },
  { regex: /(netflix|spotify|disney|prime|assinatura|mensalidade|luz|água|gás|internet)/i, category: "Contas Mensais" },
  { regex: /(farmácia|remédio|dentista|consulta|hospital|exame)/i, category: "Saúde" },
  { regex: /(ração|pet|veterinário)/i, category: "Pets" },
  { regex: /(aluguel|iptu|financiamento|condomínio)/i, category: "Moradia" }
];

/**
 * Detectar categoria por palavras-chave
 */
function detectCategory(text) {
  for (const item of categoryMapping) {
    if (item.regex.test(text)) return item.category;
  }
  return null;
}

/**
 * Detecta parcelamento
 */
function detectInstallments(text) {
  const match = text.match(/(\d+)[xX]/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Detecta valor R$ 50, 50 reais, 120 etc.
 */
function detectAmount(text) {
  const match = text.replace(",", ".").match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Detecta tipo de transação (income ou expense)
 */
function detectType(text) {
  if (/recebi|ganhei|entrou|salário|caixa positivo/i.test(text)) return "income";
  return "expense";
}

/**
 * Detecta método de pagamento
 */
function detectPaymentMethod(text) {
  if (/pix|débito|dinheiro|transfer/i.test(text)) return "account";
  if (/cartão/i.test(text) && detectInstallments(text)) return "credit_card_installments";
  if (/cartão|crédito/i.test(text)) return "credit_card_cash";
  return "account";
}

/**
 * Detecta frequência (fixo x variável)
 */
function detectFrequency(text) {
  if (/mensalidade|aluguel|plano|assinatura|fixo/i.test(text)) return "fixed";
  return "variable";
}

/**
 * Remove palavras irrelevantes da descrição
 */
function extractDescription(text) {
  return text
    .replace(/\d+x?/gi, "")
    .replace(/pix|débito|crédito|dinheiro|transferência/gi, "")
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  try {
    const { message, history, context } = req.body;

    if (!message) {
      return res.status(400).json({
        reply: "Não consegui entender sua mensagem. Pode repetir?",
        action: "error"
      });
    }

    // Cancelamento
    if (/cancelar|cancela|esquece/i.test(message)) {
      return res.status(200).json({
        reply: "Tudo bem, ação cancelada 👍",
        action: "cancelled"
      });
    }

    /**
     * 1. TENTAR EXTRAIR OS DADOS DA TRANSAÇÃO
     */
    const extracted = {
      type: detectType(message),
      amount: detectAmount(message),
      description: extractDescription(message),
      frequency: detectFrequency(message),
      payment_method: detectPaymentMethod(message),
      installments: detectInstallments(message),
      suggested_category_name: detectCategory(message)
    };

    /**
     * Campos obrigatórios
     */
    const missingFields = [];

    if (!extracted.amount) missingFields.push("amount");
    if (!extracted.description || extracted.description.length < 2)
      missingFields.push("description");

    if (missingFields.length > 0) {
      return res.status(200).json({
        reply: `Estou quase lá! Falta: ${missingFields.join(", ")}. Pode me informar?`,
        action: "need_more_info",
        data: {
          missing_fields: missingFields,
          partial_data: extracted
        }
      });
    }

    /**
     * 2. FORMAR MENSAGEM DE CONFIRMAÇÃO
     */
    const confirmationText =
      `🔎 *Confirme a transação*\n\n` +
      `• Tipo: ${extracted.type === "income" ? "Receita" : "Despesa"}\n` +
      `• Valor: R$ ${extracted.amount.toFixed(2)}\n` +
      `• Descrição: ${extracted.description}\n` +
      `• Categoria sugerida: ${extracted.suggested_category_name || "Não detectada"}\n` +
      `• Pagamento: ${extracted.payment_method}\n` +
      (extracted.installments ? `• Parcelas: ${extracted.installments}x\n` : "") +
      `\nConfirma? (sim / não)`;

    /**
     * 3. Se usuário disse "sim", registrar
     */
    if (/^sim$|pode registrar|confirmo/i.test(message)) {
      return res.status(200).json({
        reply: "Prontinho! Lançamento registrado com sucesso 🎯",
        action: "success",
        data: extracted
      });
    }

    /**
     * 4. Caso contrário, mandar confirmação
     */
    return res.status(200).json({
      reply: confirmationText,
      action: "awaiting_confirmation",
      data: extracted
    });

  } catch (error) {
    console.error("Erro na API ChatGPT:", error);
    return res.status(500).json({
      reply: "Ops! Tive um problema ao processar seu pedido.",
      action: "error",
      details: error.message
    });
  }
}
