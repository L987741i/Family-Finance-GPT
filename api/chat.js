// /api/chat.js — versão completa, humanizada e com confirmação personalizada
// IA Externa para o Lovable — compatível com Vercel (ESM)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { message, history, context } = req.body || {};

    globalContext = context || {}; // ← usado nas funções internas

    if (!message || typeof message !== "string") {
      return res.status(200).json({
        reply: "Não consegui entender certinho 🤔\nPode tentar explicar de outro jeito?",
        action: "message",
      });
    }

    const intent = detectIntent(message);

    // ============================
    //        CANCELAR
    // ============================
    if (intent.type === "cancel") {
      return res.status(200).json({
        reply: "Tudo certo 👍\nO que você quiser cancelar, está cancelado!",
        action: "cancelled",
      });
    }

    // ============================
    //   CONFIRMAR TRANSAÇÃO
    // ============================
    if (intent.type === "confirm") {
      const pending = context?.pending_transaction;

      if (!pending) {
        return res.status(200).json({
          reply: "Não encontrei nada para confirmar 🤔\nO que você gostaria de registrar?",
          action: "message",
        });
      }

      return res.status(200).json({
        reply: "Perfeito! Vou registrar isso agora 🚀",
        action: "success",
        data: pending,
      });
    }

    // ============================
    //         CONSULTAS
    // ============================
    if (intent.type === "query") {
      return res.status(200).json({
        reply: intent.reply,
        action: intent.action,
        data: intent.data || {},
      });
    }

    // ============================
    //     NOVA TRANSAÇÃO
    // ============================
    if (intent.type === "transaction") {
      const parsed = extractTransaction(message);

      if (parsed.needsMoreInfo) {
        return res.status(200).json({
          reply: parsed.reply,
          action: "need_more_info",
          data: {
            missing_field: parsed.missingField,
            partial_data: parsed.partial,
          },
        });
      }

      return res.status(200).json({
        reply: parsed.confirmation,
        action: "awaiting_confirmation",
        data: parsed.fullData,
      });
    }

    // ============================
    //      RESPOSTA GENÉRICA
    // ============================
    return res.status(200).json({
      reply:
        "Oi! Eu sou sua assistente financeira 💼✨\n" +
        "Posso registrar gastos, entradas e consultar suas finanças.\n\n" +
        "Experimente dizer:\n" +
        "• “gastei 50 no mercado 🛒”\n" +
        "• “recebi 200 de salário 💰”\n" +
        "• “quanto gastei hoje?” 📅\n" +
        "• “qual meu saldo?” 📊",
      action: "message",
    });
  } catch (err) {
    console.error("Erro na IA externa:", err);

    return res.status(500).json({
      reply: "Ops! Tive um erro técnico 😕\nPode tentar novamente?",
      action: "error",
      details: String(err),
    });
  }
}

// ====================================================================
//                   DETECÇÃO DE INTENÇÃO
// ====================================================================

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
      reply: "Claro! Vou conferir seus gastos de hoje 💸📅",
    };
  }

  if (/gastei na semana|gastos da semana/.test(msg)) {
    return {
      type: "query",
      action: "query_spent_week",
      reply: "Um momento! Vou ver seus gastos da semana 🗓️📊",
    };
  }

  if (/gastei no mês|gastos do mês|este mês/.test(msg)) {
    const now = new Date();
    return {
      type: "query",
      action: "query_spent_month",
      reply: "Vou verificar como está seu mês financeiro 📆💰",
      data: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
    };
  }

  if (/recebi hoje|entrada hoje/.test(msg)) {
    return {
      type: "query",
      action: "query_received_today",
      reply: "Beleza! Vou ver quanto entrou hoje 👀💵",
    };
  }

  if (/saldo|como estou financeiramente|minhas finanças/.test(msg)) {
    return {
      type: "query",
      action: "query_balance",
      reply: "Vou calcular seu saldo geral agora mesmo 📊✨",
    };
  }

  if (/(paguei|gastei|comprei|usei|dei|custou|recebi|entrou|ganhei)/.test(msg)) {
    return { type: "transaction" };
  }

  return { type: "general" };
}

// ====================================================================
//                   PROCESSAR TRANSAÇÃO
// ====================================================================

let globalContext = {};

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

  const categories = globalContext?.categories || [];
  const wallets = globalContext?.wallets || [];

  const suggested_category_name = inferCategory(description, categories) || null;
  const suggested_wallet_name = inferWallet(description, wallets) || null;

  const partial = {
    type,
    amount,
    description,
    payment_method,
    installments,
    category_name: suggested_category_name,
    account_name: suggested_wallet_name,
    frequency: "variable",
  };

  if (!amount) {
    return {
      needsMoreInfo: true,
      missingField: "amount",
      reply: `Perfeito! Quanto foi *${description}*? 💵`,
      partial,
    };
  }

  if (!type) {
    return {
      needsMoreInfo: true,
      missingField: "type",
      reply: "Foi entrada ou saída? 🤔",
      partial,
    };
  }

  const isExpense = type === "expense";
  const emojiType = isExpense ? "🔴 *Despesa*" : "🟢 *Receita*";

  const today = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  const confirmation =
`${emojiType} | 📅 Variável
💰 *Valor*: R$ ${amount.toFixed(2)}
📝 *Descrição*: ${description}
💳 *Conta*: ${suggested_wallet_name || "Selecionar"}
📁 *Categoria*: ${suggested_category_name || "Selecionar"}
_${today}_

Confirma o lançamento? Responda *SIM* ou *NÃO*.`;


  return {
    needsMoreInfo: false,
    fullData: partial,
    confirmation,
  };
}

// ====================================================================
//                        HELPERS
// ====================================================================

function inferDescription(msg) {
  return msg
    .replace(/(paguei|gastei|comprei|usei|dei|recebi|ganhei|entrou)/g, "")
    .replace(/(\d+[.,]?\d*)/g, "")
    .replace(/(pix|debito|débito|crédito|credito|vezes|parcel|cartão)/g, "")
    .trim() || "Lançamento";
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

function inferCategory(desc, categories) {
  if (!categories || categories.length === 0) return null;
  const name = desc.toLowerCase();
  const found = categories.find((c) =>
    name.includes(c.name.toLowerCase())
  );
  return found ? found.name : null;
}

function inferWallet(desc, wallets) {
  if (!wallets || wallets.length === 0) return null;
  const name = desc.toLowerCase();
  const found = wallets.find((w) =>
    name.includes(w.name.toLowerCase())
  );
  return found ? found.name : null;
}
