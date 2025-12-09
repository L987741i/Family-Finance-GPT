// /api/chat.js — versão com conta, data e personalidade ✨
// 100% compatível com Vercel (ESM)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { message, context } = req.body || {};

    if (!message || typeof message !== "string") {
      res.status(200).json({
        reply:
          "Hmm… não entendi muito bem 🤔\nPode explicar de outra forma pra eu te ajudar melhor?",
        action: "message"
      });
      return;
    }

    const intent = detectIntent(message);

    // ============================
    // CANCELAR
    // ============================
    if (intent.type === "cancel") {
      res.status(200).json({
        reply: "Tudo bem! Cancelado com sucesso 👍",
        action: "cancelled"
      });
      return;
    }

    // ============================
    // CONSULTAS (Lovable processa)
    // ============================
    if (intent.type === "query") {
      res.status(200).json({
        reply: intent.reply,
        action: intent.action,
        data: intent.data || {}
      });
      return;
    }

    // ============================
    // CONFIRMAR TRANSAÇÃO
    // ============================
    if (intent.type === "confirm") {
      const pending = context?.pending_transaction;

      if (!pending) {
        res.status(200).json({
          reply:
            "Poxa... não encontrei nada para confirmar 🤔\nPode me dizer de novo o que deseja registrar?",
          action: "message"
        });
        return;
      }

      res.status(200).json({
        reply: "Perfeito! Já vou registrar isso pra você agora mesmo 🚀",
        action: "success",
        data: pending
      });
      return;
    }

    // ============================
    // NOVA TRANSAÇÃO
    // ============================
    if (intent.type === "transaction") {
      const parsed = extractTransaction(message);

      if (parsed.needsMoreInfo) {
        res.status(200).json({
          reply: parsed.reply,
          action: "need_more_info",
          data: parsed.data
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

    // ============================
    // GENÉRICO
    // ============================
    res.status(200).json({
      reply:
        "Oi! ✨ Eu sou sua assistente financeira.\n\n" +
        "Pode me dizer coisas como:\n" +
        "• “paguei 50 no mercado” 🛒\n" +
        "• “recebi 200 de salário” 💼\n" +
        "• “quanto gastei hoje?” 📅\n" +
        "• “qual meu saldo?” 📊\n",
      action: "message"
    });

  } catch (err) {
    console.error("Erro IA externa:", err);

    res.status(500).json({
      reply:
        "Ops! Tive um probleminha aqui 😕\nPode tentar novamente, por favor?",
      action: "error",
      details: String(err)
    });
  }
}

// =============================================================
// CONFIGURAÇÕES PRINCIPAIS
// =============================================================

// Contas da família (editável)
const FAMILY_ACCOUNTS = ["carteira", "nubank", "bb", "itau", "caixa"];

// Detectar intenção
function detectIntent(message) {
  const msg = message.toLowerCase().trim();

  if (/(cancelar|cancela|esquece|deixa pra lá|deixa pra la)/.test(msg))
    return { type: "cancel" };

  if (/^(sim|pode|confirmo|ok|pode registrar)$/.test(msg))
    return { type: "confirm" };

  if (/quanto gastei hoje/.test(msg))
    return {
      type: "query",
      action: "query_spent_today",
      reply: "Claro! Vou ver quanto você gastou hoje 💸"
    };

  if (/gastos da semana|gastei na semana/.test(msg))
    return {
      type: "query",
      action: "query_spent_week",
      reply: "Beleza! Vou puxar seus gastos da semana 🗓️✨"
    };

  if (/gastei no mês|este mês/.test(msg)) {
    const now = new Date();
    return {
      type: "query",
      action: "query_spent_month",
      reply: "Um instante! Vou analisar seu mês financeiro 📊",
      data: { month: now.getMonth() + 1, year: now.getFullYear() }
    };
  }

  if (/recebi hoje/.test(msg))
    return {
      type: "query",
      action: "query_received_today",
      reply: "Wow! Vamos ver quanto entrou hoje 💵"
    };

  if (/saldo|minhas finanças/.test(msg))
    return {
      type: "query",
      action: "query_balance",
      reply: "Certo! Vou calcular seu saldo geral 💼✨"
    };

  if (/(paguei|gastei|comprei|usei|dei|recebi|ganhei|entrou)/.test(msg))
    return { type: "transaction" };

  return { type: "general" };
}

// =============================================================
// EXTRAÇÃO DA TRANSAÇÃO
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

  // 🔥 PEGANDO CARTEIRAS E CATEGORIAS DO CONTEXTO (enviadas pelo Lovable)
  const categories = globalContext?.categories || [];
  const wallets = globalContext?.wallets || [];

  const suggested_category_name = inferCategory(description, categories);
  const suggested_wallet_name = inferWallet(description, wallets);

  const partial = {
    type,
    amount,
    description,
    payment_method,
    installments,
    category_name: suggested_category_name,
    account_name: suggested_wallet_name,
    frequency: "variable"
  };

  // Falta valor
  if (!amount) {
    return {
      needsMoreInfo: true,
      missingField: "amount",
      reply: `Perfeito! Quanto foi *${description}*? 💵`,
      partial
    };
  }

  // Falta tipo
  if (!type) {
    return {
      needsMoreInfo: true,
      missingField: "type",
      reply: "Isso foi entrada ou saída? 🤔",
      partial
    };
  }

  // 📌 FORMATO DE CONFIRMAÇÃO PERSONALIZADO
  const isExpense = type === "expense";
  const emojiType = isExpense ? "🔴 *Despesa*" : "🟢 *Receita*";

  const today = new Date()
    .toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

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
    confirmation
  };
}

  // falta conta
  if (!account_name) {
    return {
      needsMoreInfo: true,
      reply:
        "Só pra finalizar… qual conta você usou? 💳\n\n" +
        `Opções: ${FAMILY_ACCOUNTS.join(", ")}`,
      data: {
        missing_field: "account_name",
        partial_data: { type, amount, description }
      }
    };
  }

  const fullData = {
    type,
    amount,
    description,
    payment_method,
    installments,
    account_name,
    date,
    frequency: "variable"
  };

  const confirmation =
    `Vamos conferir tudo certinho 👇\n\n` +
    `• Tipo: ${type === "expense" ? "Despesa 💸" : "Entrada 💰"}\n` +
    `• Valor: R$ ${amount.toFixed(2)}\n` +
    `• Descrição: ${description}\n` +
    `• Conta: ${account_name}\n` +
    `• Data: ${date}\n` +
    (installments ? `• Parcelas: ${installments}x\n` : "") +
    `\nPosso registrar? 😊`;

  return {
    needsMoreInfo: false,
    fullData,
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
    .replace(/(pix|debito|débito|credito|crédito|cartão)/g, "")
    .trim();

  return clean || "Lançamento";
}

function inferPaymentMethod(msg) {
  if (/pix|dinheiro|débito|debito/.test(msg)) return "account";
  if (/cart[aã]o/.test(msg) && /\d+x/.test(msg))
    return "credit_card_installments";
  if (/cart[aã]o|cr[eé]dito/.test(msg)) return "credit_card_cash";
  return "account";
}

function inferInstallments(msg) {
  const match = msg.match(/(\d+)x/);
  return match ? parseInt(match[1]) : null;
}

function inferAccount(msg) {
  for (const acc of FAMILY_ACCOUNTS) {
    if (msg.includes(acc)) return acc;
  }
  return null;
}

function inferDate(msg) {
  const now = new Date();

  if (msg.includes("hoje")) return now.toISOString().slice(0, 10);
  if (msg.includes("agora")) return now.toISOString().slice(0, 10);
  if (msg.includes("ontem")) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  return now.toISOString().slice(0, 10);
}
