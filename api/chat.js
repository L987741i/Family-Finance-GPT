import OpenAI from "openai";

/**
 * =============  DETECÇÃO DE INTENÇÃO (INTENTS)  ===================
 * Registra transação? Consulta? Pergunta genérica? Pedido de relatório?
 */
function detectIntent(message) {
  const msg = message.toLowerCase();

  // PEDIDOS DE CONSULTA
  if (/quanto gastei hoje|gastei hoje|meus gastos hoje|gastei muito hoje/i.test(msg))
    return "query_spent_today";

  if (/quanto gastei essa semana|gastos da semana|meu semanal/i.test(msg))
    return "query_spent_week";

  if (/quanto gastei esse mês|gastos do mês|meu mensal/i.test(msg))
    return "query_spent_month";

  if (/quanto recebi hoje|quanto entrou hoje|recebi hoje/i.test(msg))
    return "query_received_today";

  if (/saldo|meu saldo|qual saldo/i.test(msg))
    return "query_balance";

  // Confirmação
  if (/^sim$|confirmo|pode registrar/i.test(msg))
    return "confirm";

  // Cancelamento
  if (/cancelar|cancela|esquece/i.test(msg))
    return "cancel";

  // Se contém verbos de transação → tentativa de registro
  if (/paguei|gastei|comprei|dei|usei|pix|transferi|recebi|entrou/i.test(msg))
    return "transaction";

  return "general_question";
}

/**
 * =============  EXTRAÇÃO DE TRANSAÇÃO (EXISTENTE)  ===================
 */
function detectCategory(text) {
  const mapping = [
    { regex: /(mercado|supermercado|padaria|ifood|almoço|restaurante|pizza)/i, c: "Alimentação" },
    { regex: /(uber|99|gasolina|combustível|estacionamento)/i, c: "Transporte" },
    { regex: /(netflix|spotify|disney|assinatura|internet|água|luz)/i, c: "Contas Mensais" },
    { regex: /(farmácia|remédio|consulta|dentista|exame)/i, c: "Saúde" },
    { regex: /(ração|pet|veterinário)/i, c: "Pets" }
  ];
  for (const m of mapping) if (m.regex.test(text)) return m.c;
  return null;
}

function detectAmount(text) {
  const match = text.replace(",", ".").match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function detectType(text) {
  if (/recebi|entrou|ganhei|salário/i.test(text)) return "income";
  return "expense";
}

function detectInstallments(text) {
  const match = text.match(/(\d+)[xX]/);
  return match ? parseInt(match[1], 10) : null;
}

function detectPayment(text) {
  if (/pix|débito|dinheiro|transfer/i.test(text)) return "account";
  if (/cartão/i.test(text) && detectInstallments(text)) return "credit_card_installments";
  if (/cartão|crédito/i.test(text)) return "credit_card_cash";
  return "account";
}

function detectFrequency(text) {
  if (/mensalidade|assinatura|plano|fixo/i.test(text)) return "fixed";
  return "variable";
}

function extractDescription(text) {
  return text
    .replace(/\d+x?/gi, "")
    .replace(/pix|débito|crédito|dinheiro|transferência/gi, "")
    .trim();
}

const naturalMissingMessages = {
  amount: desc => `Ótimo! Quanto foi *${desc || "essa transação"}*?`,
  description: () => "Perfeito! Qual foi a descrição dessa transação?"
};

/**
 * ==================== HANDLER PRINCIPAL ====================
 */
export default async function handler(req, res) {
  const { message, history, context } = req.body;

  if (!message) {
    return res.status(200).json({
      reply: "Pode repetir? Não consegui entender 😊",
      action: "error"
    });
  }

  const intent = detectIntent(message);

  /**
   * =============== CANCELAR ===============
   */
  if (intent === "cancel") {
    return res.status(200).json({
      reply: "Certo! Ação cancelada 👍",
      action: "cancelled"
    });
  }

  /**
   * =============== CONSULTAS (NOVA FUNÇÃO) ===============
   * A API NÃO consulta o banco — o LOVABLE faz isso.
   * Então devolvemos apenas a ação e os filtros.
   */
  if (intent.startsWith("query_")) {
    const now = new Date();

    if (intent === "query_spent_today") {
      return res.status(200).json({
        reply: "Claro! Vou verificar quanto você gastou hoje 💰",
        action: "query_spent_today",
        data: {
          date: now.toISOString().substring(0, 10)
        }
      });
    }

    if (intent === "query_spent_week") {
      return res.status(200).json({
        reply: "Sem problemas! Vou calcular seus gastos da semana 🗓️",
        action: "query_spent_week"
      });
    }

    if (intent === "query_spent_month") {
      return res.status(200).json({
        reply: "Vou ver quanto saiu no mês atual 📊",
        action: "query_spent_month",
        data: {
          month: now.getMonth() + 1,
          year: now.getFullYear()
        }
      });
    }

    if (intent === "query_received_today") {
      return res.status(200).json({
        reply: "Beleza! Vou ver quanto entrou hoje 👀",
        action: "query_received_today",
        data: {
          date: now.toISOString().substring(0, 10)
        }
      });
    }

    if (intent === "query_balance") {
      return res.status(200).json({
        reply: "Certo! Vou consultar seu saldo geral 💼",
        action: "query_balance"
      });
    }
  }

  /**
   * =============== SE FOR CONFIRMAÇÃO ===============
   */
  if (intent === "confirm") {
    const data = context?.pending_transaction;

    if (!data) {
      return res.status(200).json({
        reply: "Não achei nenhuma transação para confirmar 🤔",
        action: "error"
      });
    }

    return res.status(200).json({
      reply: "Perfeito! Transação registrada com sucesso 🎉",
      action: "success",
      data
    });
  }

  /**
   * =============== REGISTRO DE TRANSAÇÃO ===============
   */
  if (intent === "transaction") {
    const extracted = {
      type: detectType(message),
      amount: detectAmount(message),
      description: extractDescription(message),
      frequency: detectFrequency(message),
      payment_method: detectPayment(message),
      installments: detectInstallments(message),
      suggested_category_name: detectCategory(message)
    };

    const missing = [];
    if (!extracted.amount) missing.push("amount");
    if (!extracted.description || extracted.description.length < 2) missing.push("description");

    if (missing.length > 0) {
      const mf = missing[0];
      return res.status(200).json({
        reply: naturalMissingMessages[mf](extracted.description),
        action: "need_more_info",
        data: {
          missing_fields: missing,
          partial_data: extracted
        }
      });
    }

    const confirmMsg =
      `Entendi! Vamos confirmar:\n\n` +
      `• ${extracted.type === "income" ? "🟢 Receita" : "🔴 Despesa"}\n` +
      `• 💰 R$ ${extracted.amount.toFixed(2)}\n` +
      `• 📝 ${extracted.description}\n` +
      `• 📁 Categoria: ${extracted.suggested_category_name || "Não detectada"}\n` +
      (extracted.installments ? `• 🔢 Parcelas: ${extracted.installments}x\n` : "") +
      `\nPosso registrar?`;

    return res.status(200).json({
      reply: confirmMsg,
      action: "awaiting_confirmation",
      data: extracted
    });
  }

  /**
   * =============== PERGUNTA GERAL (IA) ===============
   * Caso o usuário pergunte algo que não é transação nem relatório.
   */
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Responda como um assistente financeiro amigável." },
      { role: "user", content: message }
    ]
  });

  return res.status(200).json({
    reply: completion.choices[0].message.content,
    action: "message"
  });
}
