// /api/chat.js

// ===================== INTENT DETECTION =====================

function detectIntent(message) {
  const msg = (message || "").toLowerCase().trim();

  if (!msg) return { type: "unknown" };

  // Cancelar
  if (/(cancelar|cancela|esquece|deixa pra lá|deixa pra la)/.test(msg)) {
    return { type: "cancel" };
  }

  // Confirmar
  if (/^(sim|pode|ok|confirmo|pode registrar)$/.test(msg)) {
    return { type: "confirm" };
  }

  // Consultas – gastos
  if (/quanto gastei hoje|gastei hoje|meus gastos hoje/.test(msg)) {
    return {
      type: "query",
      action: "query_spent_today",
      reply: "Claro! Vou verificar quanto você gastou hoje 💰",
      data: {}
    };
  }

  if (/quanto gastei essa semana|gastos da semana|gastei na semana/.test(msg)) {
    return {
      type: "query",
      action: "query_spent_week",
      reply: "Beleza! Vou ver seus gastos desta semana 🗓️",
      data: {}
    };
  }

  if (/quanto gastei esse mês|quanto gastei no mês|gastos do mês|gastei no mês/.test(msg)) {
    const now = new Date();
    return {
      type: "query",
      action: "query_spent_month",
      reply: "Vou conferir quanto você gastou neste mês 📊",
      data: {
        month: now.getMonth() + 1,
        year: now.getFullYear()
      }
    };
  }

  // Consultas – receitas
  if (/quanto recebi hoje|entrou hoje|receitas de hoje/.test(msg)) {
    return {
      type: "query",
      action: "query_received_today",
      reply: "Certo! Vou ver quanto entrou hoje 👀",
      data: {}
    };
  }

  // Consulta – saldo
  if (/saldo|como estou financeiramente|minhas finanças/.test(msg)) {
    return {
      type: "query",
      action: "query_balance",
      reply: "Vou checar seu saldo geral 💼",
      data: {}
    };
  }

  // Frases típicas de lançamento
  if (/(paguei|gastei|comprei|usei|dei|recebi|entrou|ganhei)/.test(msg)) {
    return { type: "transaction" };
  }

  return { type: "general" };
}

// ===================== TRANSACTION PARSING =====================

function detectAmount(text) {
  if (!text) return null;
  const match = text.replace(",", ".").match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function detectType(text) {
  const msg = text.toLowerCase();
  if (/(recebi|entrou|ganhei|salário|salario)/.test(msg)) return "income";
  if (/(paguei|gastei|comprei|usei|pago|custou)/.test(msg)) return "expense";
  return null;
}

function detectInstallments(text) {
  if (!text) return null;
  const match = text.match(/(\d+)\s*x/);
  return match ? parseInt(match[1], 10) : null;
}

function detectPaymentMethod(text) {
  const msg = text.toLowerCase();
  if (/pix|d[eé]bito|debito|dinheiro|esp[eé]cie|transfer/.test(msg)) return "account";
  if (/cart[aã]o/.test(msg) && detectInstallments(msg)) return "credit_card_installments";
  if (/cart[aã]o|cr[eé]dito/.test(msg)) return "credit_card_cash";
  return "account";
}

function detectCategory(description) {
  if (!description) return null;
  const desc = description.toLowerCase();

  if (/mercado|supermercado|ifood|almo[cç]o|restaurante|pizza|lanche|comida/.test(desc))
    return "Alimentação";

  if (/uber|99|gasolina|combust[ií]vel|estacionamento|ped[aá]gio|transporte/.test(desc))
    return "Transporte";

  if (/luz|energia|[aá]gua|telefone|celular|internet|netflix|spotify|disney|assinatura/.test(desc))
    return "Contas Mensais";

  if (/farm[aá]cia|rem[eé]dio|m[eé]dico|dentista|exame|hospital/.test(desc))
    return "Saúde";

  if (/ração|racao|pet|veterin[aá]rio/.test(desc))
    return "Pets";

  return "Outros";
}

function extractDescription(message) {
  if (!message) return "Lançamento";
  const msg = message.toLowerCase();

  let desc = msg
    .replace(/(paguei|gastei|comprei|usei|dei|recebi|entrou|ganhei)/g, "")
    .replace(/(no |na |em )/g, "")
    .replace(/(\d+(\,\d+)?|\d+(\.\d+)?)/g, "")
    .replace(/(pix|d[eé]bito|debito|cr[eé]dito|dinheiro|cart[aã]o|vezes|x)/g, "")
    .trim();

  if (!desc) return "Lançamento";
  return desc;
}

function naturalMissingMessage(field, partial) {
  switch (field) {
    case "amount":
      return partial.description
        ? `Perfeito! Quanto foi *${partial.description}*?`
        : "Perfeito! Qual foi o valor?";
    case "type":
      return "Isso foi uma entrada (receita) ou uma saída (despesa)?";
    case "description":
      return "Legal! Me diz agora o que foi essa transação (ex: mercado, uber, aluguel...).";
    default:
      return "Pode me informar o que falta?";
  }
}

function extractTransaction(message) {
  const type = detectType(message);
  const amount = detectAmount(message);
  const description = extractDescription(message);
  const payment_method = detectPaymentMethod(message);
  const installments = detectInstallments(message);
  const suggested_category_name = detectCategory(description);
  const frequency = "variable";

  const partial = {
    type,
    amount,
    description,
    frequency,
    payment_method,
    installments,
    suggested_category_name
  };

  const missing = [];
  if (!amount) missing.push("amount");
  if (!type) missing.push("type");
  if (!description || description.length < 2) missing.push("description");

  if (missing.length > 0) {
    const first = missing[0];
    return {
      needsMoreInfo: true,
      missingField: first,
      partial,
      reply: naturalMissingMessage(first, partial)
    };
  }

  const fullData = partial;

  const confirmation =
    `Entendi! Vamos confirmar:\n\n` +
    `• Tipo: ${type === "expense" ? "Despesa" : "Receita"}\n` +
    `• Valor: R$ ${amount.toFixed(2)}\n` +
    `• Descrição: ${description}\n` +
    `• Categoria sugerida: ${suggested_category_name}\n` +
    (installments ? `• Parcelado em ${installments}x\n` : "") +
    `\nPosso registrar esse lançamento?`;

  return {
    needsMoreInfo: false,
    fullData,
    confirmation
  };
}

// ===================== HANDLER PRINCIPAL =====================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const { message, history, context } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(200).json({
        reply: "Não entendi muito bem. Pode me explicar com mais detalhes? 😊",
        action: "error"
      });
      return;
    }

    const intent = detectIntent(message);

    // 1) CANCELAR
    if (intent.type === "cancel") {
      res.status(200).json({
        reply: "Sem problema, cancelei essa operação 👍",
        action: "cancelled"
      });
      return;
    }

    // 2) CONSULTAS (RELATÓRIO / SALDO)
    if (intent.type === "query") {
      res.status(200).json({
        reply: intent.reply,
        action: intent.action,
        data: intent.data || {}
      });
      return;
    }

    // 3) CONFIRMAÇÃO – depende do contexto enviado pelo Lovable
    if (intent.type === "confirm") {
      const pending = context && context.pending_transaction;

      if (!pending) {
        res.status(200).json({
          reply: "Não encontrei nenhum lançamento pendente para confirmar 🤔. Me conta de novo o que você quer registrar?",
          action: "error"
        });
        return;
      }

      res.status(200).json({
        reply: "Perfeito! Vou registrar esse lançamento pra você 🎯",
        action: "success",
        data: pending
      });
      return;
    }

    // 4) TRANSAÇÃO – registrar entrada/saída
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

    // 5) PERGUNTA GERAL – resposta simples, sem ação especial
    res.status(200).json({
      reply: "Sou seu assistente financeiro. Você pode me perguntar coisas como:\n\n" +
             "• \"paguei 50 no mercado\"\n" +
             "• \"quanto gastei hoje?\"\n" +
             "• \"recebi 200 de salário\"\n" +
             "• \"qual o meu saldo?\"",
      action: "message"
    });
  } catch (error) {
    console.error("Erro na IA externa:", error);
    res.status(500).json({
      reply: "Tive um problema para processar sua solicitação agora 😕. Tente reformular sua frase.",
      action: "error",
      details: String(error)
    });
  }
}
