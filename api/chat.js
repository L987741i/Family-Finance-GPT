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

  // Consultas
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

  if (/quanto recebi hoje|entrou hoje|receitas de hoje/.test(msg)) {
    return {
      type: "query",
      action: "query_received_today",
      reply: "Certo! Vou ver quanto entrou hoje 👀",
      data: {}
    };
  }

  if (/saldo|como estou financeiramente|minhas finanças/.test(msg)) {
    return {
      type: "query",
      action: "query_balance",
      reply: "Vou checar seu saldo geral 💼",
      data: {}
    };
  }

  if (/(paguei|gastei|comprei|usei|dei|recebi|entrou|ganhei)/.test(msg)) {
    return { type: "transaction" };
  }

  return { type: "general" };
}

// ===================== TRANSACTION EXTRACTION =====================

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
  const match = text.match(/(\d+)\s*x/);
  return match ? parseInt(match[1], 10) : null;
}

function detectPaymentMethod(text) {
  const msg = text.toLowerCase();
  if (/pix|d[eé]bito|debito|dinheiro|transfer/.test(msg)) return "account";
  if (/cart[aã]o/.test(msg) && detectInstallments(msg)) return "credit_card_installments";
  if (/cart[aã]o|cr[eé]dito/.test(msg)) return "credit_card_cash";
  return "account";
}

function detectCategory(description) {
  const desc = description.toLowerCase();

  if (/mercado|supermercado|ifood|almo[cç]o|restaurante|pizza|lanche/.test(desc))
    return "Alimentação";

  if (/uber|gasolina|combust[ií]vel|estacionamento|ped[aá]gio/.test(desc))
    return "Transporte";

  if (/luz|energia|[aá]gua|telefone|internet|netflix|spotify/.test(desc))
    return "Contas Mensais";

  if (/farm[aá]cia|rem[eé]dio|m[eé]dico|dentista/.test(desc))
    return "Saúde";

  if (/ração|pet|veterin[aá]rio/.test(desc))
    return "Pets";

  return "Outros";
}

function extractDescription(msg) {
  let text = msg
    .replace(/(paguei|gastei|comprei|usei|dei|recebi|entrou|ganhei)/g, "")
    .replace(/(\d+(\,\d+)?|\d+(\.\d+)?)/g, "")
    .replace(/(pix|debito|débito|crédito|credito|dinheiro|cartão|vezes|x)/g, "")
    .trim();

  if (!text) return "Lançamento";
  return text;
}

function naturalMissingMessage(field, partial) {
  if (field === "amount") {
    return partial.description
      ? `Perfeito! Quanto foi *${partial.description}*?`
      : "Perfeito! Qual foi o valor?";
  }
  if (field === "type") {
    return "Isso foi uma entrada (receita) ou uma saída (despesa)?";
  }
  if (field === "description") {
    return "Legal! Me diz agora o que foi essa transação (ex: mercado, uber, aluguel...).";
  }
  return "Pode me informar o que falta?";
}

function extractTransaction(message) {
  const type = detectType(message);
  const amount = detectAmount(message);
  const description = extractDescription(message);
  const payment_method = detectPaymentMethod(message);
  const installments = detectInstallments(message);
  const suggested_category_name = detectCategory(description);

  const partial = {
    type,
    amount,
    description,
    frequency: "variable",
    payment_method,
    installments,
    suggested_category_name
  };

  if (!amount) {
    return {
      needsMoreInfo: true,
      missingField: "amount",
      partial,
      reply: naturalMissingMessage("amount", partial)
    };
  }

  if (!type) {
    return {
      needsMoreInfo: true,
      missingField: "type",
      partial,
      reply: naturalMissingMessage("type", partial)
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

// ===================== MAIN HANDLER =====================

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const message = body.message || "";
    const context = body.context || null;

    const intent = detectIntent(message);

    if (intent.type === "cancel") {
      res.json({
        reply: "Sem problema, cancelei essa operação 👍",
        action: "cancelled"
      });
      return;
    }

    if (intent.type === "query") {
      res.json({
        reply: intent.reply,
        action: intent.action,
        data: intent.data || {}
      });
      return;
    }

    if (intent.type === "confirm") {
      if (!context || !context.pending_transaction) {
        res.json({
          reply: "Não encontrei nada pendente para confirmar 🤔",
          action: "error"
        });
        return;
      }

      res.json({
        reply: "Perfeito! Vou registrar isso pra você 🎯",
        action: "success",
        data: context.pending_transaction
      });
      return;
    }

    if (intent.type === "transaction") {
      const result = extractTransaction(message);

      if (result.needsMoreInfo) {
        res.json({
          reply: result.reply,
          action: "need_more_info",
          data: {
            missing_field: result.missingField,
            partial_data: result.partial
          }
        });
        return;
      }

      res.json({
        reply: result.confirmation,
        action: "awaiting_confirmation",
        data: result.fullData
      });
      return;
    }

    res.json({
      reply:
        "Sou seu assistente financeiro! Você pode me dizer coisas como:\n\n" +
        "• \"paguei 50 no mercado\"\n" +
        "• \"quanto gastei hoje?\"\n" +
        "• \"recebi 200 de salário\"\n" +
        "• \"qual o meu saldo?\"",
      action: "message"
    });
  } catch (error) {
    console.error("IA Error:", error);
    res.status(500).json({
      reply: "Houve um problema ao processar sua solicitação 😕",
      action: "error",
      details: String(error)
    });
  }
};
