// /api/chat.js — versão 100% ESM compatível com Vercel Serverless

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { message, history, context } = req.body || {};

    if (!message || typeof message !== "string") {
      res.status(200).json({
        reply: "Não entendi muito bem. Pode explicar de outra forma?",
        action: "message"
      });
      return;
    }

    // Detectar intenção
    const intent = detectIntent(message);

    // CANCELAR
    if (intent.type === "cancel") {
      res.status(200).json({
        reply: "Tudo bem, operação cancelada 👍",
        action: "cancelled"
      });
      return;
    }

    // CONSULTAS (quem calcula é o Lovable)
    if (intent.type === "query") {
      res.status(200).json({
        reply: intent.reply,
        action: intent.action,
        data: intent.data || {}
      });
      return;
    }

    // CONFIRMAR TRANSAÇÃO
    if (intent.type === "confirm") {
      const pending = context?.pending_transaction;

      if (!pending) {
        res.status(200).json({
          reply: "Não encontrei nada para confirmar. Me diga novamente o que quer registrar 😊",
          action: "message"
        });
        return;
      }

      res.status(200).json({
        reply: "Perfeito! Vou registrar isso agora 🎯",
        action: "success",
        data: pending
      });
      return;
    }

    // TRANSAÇÃO NORMAL
    if (intent.type === "transaction") {
      const parsed = extractTransaction(message);

      if (parsed.needsMoreInfo) {
        res.status(200).json({
          reply: parsed.reply,
          action: "need_more_info",
          data: {
            missing_field: parsed.missingField,
            partial_data: parsed.partial
          }
        });
        return;
      }

      res.status(200).json({
        reply: parsed.confirmation,
        action: "awaiting_confirmation",
        data: parsed.fullData
      });
      return;
    }

    // MENSAGEM GENÉRICA
    res.status(200).json({
      reply:
        "Oi! Sou seu assistente financeiro. Você pode me enviar mensagens como:\n\n" +
        "• 'paguei 50 no mercado'\n" +
        "• 'quanto gastei hoje?'\n" +
        "• 'recebi 200 de salário'\n" +
        "• 'qual meu saldo?'",
      action: "message"
    });
  } catch (err) {
    console.error("Erro na IA externa:", err);
    res.status(500).json({
      reply: "Tive um problema técnico agora 😕. Pode tentar novamente?",
      action: "error",
      details: String(err)
    });
  }
}

// =============================================================
// INTENT DETECTION
// =============================================================
function detectIntent(message) {
  const msg = message.toLowerCase().trim();

  if (/(cancelar|cancela|esquece|deixa pra lá|deixa pra la)/.test(msg)) {
    return { type: "cancel" };
  }

  if (/^(sim|pode|ok|confirmo|pode registrar)$/.test(msg)) {
    return { type: "confirm" };
  }

  if (/quanto gastei hoje|gastei hoje/.test(msg)) {
    return {
      type: "query",
      action: "query_spent_today",
      reply: "Claro! Vou conferir quanto você gastou hoje 💰"
    };
  }

  if (/gastei na semana|gastos da semana/.test(msg)) {
    return {
      type: "query",
      action: "query_spent_week",
      reply: "Certo! Vou ver seus gastos desta semana 🗓️"
    };
  }

  if (/gastei no mês|gastos do mês|este mês/.test(msg)) {
    const now = new Date();
    return {
      type: "query",
      action: "query_spent_month",
      reply: "Vou verificar como está seu mês financeiro 📊",
      data: {
        month: now.getMonth() + 1,
        year: now.getFullYear()
      }
    };
  }

  if (/recebi hoje|entrada hoje/.test(msg)) {
    return {
      type: "query",
      action: "query_received_today",
      reply: "Beleza! Vou ver quanto entrou hoje 👀"
    };
  }

  if (/saldo|como estou financeiramente|minhas finanças/.test(msg)) {
    return {
      type: "query",
      action: "query_balance",
      reply: "Claro! Vou calcular seu saldo geral 💼"
    };
  }

  if (/(paguei|gastei|comprei|usei|recebi|ganhei|entrou)/.test(msg)) {
    return { type: "transaction" };
  }

  return { type: "general" };
}

// =============================================================
// TRANSACTION EXTRACTION
// =============================================================

function extractTransaction(message) {
  const msg = message.toLowerCase();

  const type =
    /(recebi|entrou|ganhei)/.test(msg)
      ? "income"
      : /(paguei|gastei|comprei|usei|dei|custou)/.test(msg)
      ? "expense"
      : null;

  const amountMatch = msg.match(/(\d+[.,]?\d*)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : null;

  const description = inferDescription(msg);
  const payment_method = inferPaymentMethod(msg);
  const installments = inferInstallments(msg);
  const suggested_category_name = inferCategory(description);

  const partial = {
    type,
    amount,
    description,
    payment_method,
    installments,
    suggested_category_name,
    frequency: "variable"
  };

  if (!amount) {
    return {
      needsMoreInfo: true,
      missingField: "amount",
      reply: `Perfeito! Quanto foi *${description}*?`,
      partial
    };
  }

  if (!type) {
    return {
      needsMoreInfo: true,
      missingField: "type",
      reply: "Isso foi entrada ou saída?",
      partial
    };
  }

  const confirmation =
    `Entendi! Vamos confirmar:\n\n` +
    `• Tipo: ${type === "expense" ? "Despesa" : "Receita"}\n` +
    `• Valor: R$ ${amount.toFixed(2)}\n` +
    `• Descrição: ${description}\n` +
    `• Categoria sugerida: ${suggested_category_name}\n` +
    (installments ? `• Parcelado em ${installments}x\n` : "") +
    `\nPosso registrar?`;

  return {
    needsMoreInfo: false,
    fullData: partial,
    confirmation
  };
}

// =============================================================
// HELPERS
// =============================================================

function inferDescription(msg) {
  const clean = msg
    .replace(/(paguei|gastei|comprei|usei|dei|recebi|ganhei|entrou)/g, "")
    .replace(/(\d+[.,]?\d*)/g, "")
    .replace(/(pix|debito|débito|crédito|credito|vezes|parcel|cartão)/g, "")
    .trim();

  return clean || "Lançamento";
}

function inferPaymentMethod(msg) {
  if (/pix|debito|débito|dinheiro/.test(msg)) return "account";
  if (/cart[aã]o/.test(msg) && /x/.test(msg)) return "credit_card_installments";
  if (/cart[aã]o|cr[eé]dito/.test(msg)) return "credit_card_cash";
  return "account";
}

function inferInstallments(msg) {
  const match = msg.match(/(\d+)x/);
  return match ? parseInt(match[1]) : null;
}

function inferCategory(desc) {
  if (/mercado|supermercado|ifood|almoço|restaurante/.test(desc)) return "Alimentação";
  if (/uber|gasolina|combustivel|estacionamento/.test(desc)) return "Transporte";
  if (/luz|agua|internet|celular|telefone/.test(desc)) return "Contas Mensais";
  if (/farmacia|remedio|hospital|dentista/.test(desc)) return "Saúde";
  return "Outros";
}
