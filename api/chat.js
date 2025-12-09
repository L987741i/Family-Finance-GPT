// /api/chat.js — IA completa integrada com Lovable
// Compatível com Vercel (ESM)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, context } = req.body || {};

    globalContext = context || {};
    const pending = context?.pending_transaction || null;
    const missing = context?.missing_field || null;

    if (!message) {
      return res.status(200).json({
        reply: "Não entendi muito bem 🤔\nPode repetir?",
        action: "message"
      });
    }

    // ===============================
    // 1) CONTINUAÇÃO DE INFORMAÇÃO
    // ===============================
    if (pending && missing) {
      const updated = { ...pending };

      // preenche campo faltante
      if (missing === "account_name") {
        updated.account_name = message.toLowerCase();
      }
      if (missing === "category_name") {
        updated.category_name = message.toLowerCase();
      }
      if (missing === "amount") {
        updated.amount = parseFloat(message.replace(",", "."));
      }

      const confirmation = formatConfirmation(updated);

      return res.status(200).json({
        reply: confirmation,
        action: "awaiting_confirmation",
        data: updated
      });
    }

    // ===============================
    // 2) DETECÇÃO DE INTENÇÃO
    // ===============================
    const intent = detectIntent(message);

    if (intent.type === "cancel") {
      return res.status(200).json({
        reply: "Tudo certo 👍\nOperação cancelada!",
        action: "cancelled"
      });
    }

    if (intent.type === "confirm") {
      if (!pending) {
        return res.status(200).json({
          reply: "Não encontrei nada para confirmar 🤔",
          action: "message"
        });
      }

      return res.status(200).json({
        reply: "Perfeito! Registrando agora 🚀",
        action: "success",
        data: pending
      });
    }

    if (intent.type === "query") {
      return res.status(200).json({
        reply: intent.reply,
        action: intent.action,
        data: intent.data || {}
      });
    }

    // ===============================
    // 3) PROCESSAR TRANSAÇÃO NOVA
    // ===============================
    const parsed = extractTransaction(message);

    if (parsed.needsMoreInfo) {
      return res.status(200).json({
        reply: parsed.reply,
        action: "need_more_info",
        data: {
          missing_field: parsed.missingField,
          partial_data: parsed.partial
        }
      });
    }

    return res.status(200).json({
      reply: parsed.confirmation,
      action: "awaiting_confirmation",
      data: parsed.fullData
    });

  } catch (err) {
    console.error("Erro:", err);
    return res.status(500).json({
      reply: "Tive um problema técnico 😕\nPode tentar novamente?",
      action: "error",
      details: String(err)
    });
  }
}


// ========================================================================
// INTENT DETECTION
// ========================================================================

function detectIntent(msg) {
  msg = msg.toLowerCase().trim();

  if (/(cancelar|cancela|esquece|deixa pra lá)/.test(msg)) {
    return { type: "cancel" };
  }

  if (/^(sim|pode|ok|confirmo)$/.test(msg)) {
    return { type: "confirm" };
  }

  if (/quanto gastei hoje/.test(msg)) {
    return {
      type: "query",
      action: "query_spent_today",
      reply: "Já vou ver seus gastos de hoje 💸"
    };
  }

  if (/(gastei na semana|gastos da semana)/.test(msg)) {
    return {
      type: "query",
      action: "query_spent_week",
      reply: "Vou ver sua semana financeira 📅"
    };
  }

  if (/(gastei no mês|gastos do mês)/.test(msg)) {
    const now = new Date();
    return {
      type: "query",
      action: "query_spent_month",
      reply: "Conferindo seus gastos do mês 📊",
      data: { month: now.getMonth() + 1, year: now.getFullYear() }
    };
  }

  if (/saldo/.test(msg)) {
    return {
      type: "query",
      action: "query_balance",
      reply: "Calculando seu saldo geral 💼"
    };
  }

  if (/(paguei|gastei|comprei|recebi|ganhei|entrou)/.test(msg)) {
    return { type: "transaction" };
  }

  return { type: "general" };
}


// ========================================================================
// PROCESSAMENTO DE TRANSAÇÕES
// ========================================================================

function extractTransaction(message) {
  const msg = message.toLowerCase();
  const wallets = globalContext.wallets || [];
  const categories = globalContext.categories || [];

  const type =
    /(recebi|ganhei|entrou)/.test(msg)
      ? "income"
      : /(paguei|gastei|comprei|custou)/.test(msg)
      ? "expense"
      : null;

  const amountMatch = msg.match(/(\d+[.,]?\d*)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : null;

  const description = inferDescription(msg);
  const account = inferWallet(description, wallets);
  const category = inferCategory(description, categories);

  const partial = {
    type,
    amount,
    description,
    account_name: account,
    category_name: category,
    frequency: "variable"
  };

  if (!amount) {
    return {
      needsMoreInfo: true,
      missingField: "amount",
      reply: `Qual foi o valor de *${description}*? 💰`,
      partial
    };
  }

  if (!type) {
    return {
      needsMoreInfo: true,
      missingField: "type",
      reply: "Isso foi entrada ou saída? 🤔",
      partial
    };
  }

  if (!account) {
    const list = wallets.map(w => `• ${w.name}`).join("\n");
    return {
      needsMoreInfo: true,
      missingField: "account_name",
      reply: `Só mais uma coisa 😉 Qual conta você usou?\n\nContas disponíveis:\n${list}`,
      partial
    };
  }

  const fullData = partial;

  return {
    needsMoreInfo: false,
    fullData,
    confirmation: formatConfirmation(fullData)
  };
}


// ========================================================================
// FORMATAÇÃO DA CONFIRMAÇÃO
// ========================================================================

function formatConfirmation(data) {
  const emoji = data.type === "expense" ? "🔴 *Despesa*" : "🟢 *Receita*";

  const today = new Date().toLocaleDateString("pt-BR");

  return `${emoji} | 📅 Variável
💰 *Valor*: R$ ${data.amount.toFixed(2)}
📝 *Descrição*: ${data.description}
💳 *Conta*: ${data.account_name}
📁 *Categoria*: ${data.category_name || "Selecionar"}
_${today}_

Confirma o lançamento? Responda *SIM* ou *NÃO*.`;
}


// ========================================================================
// HELPERS
// ========================================================================

function inferDescription(msg) {
  return msg
    .replace(/(paguei|gastei|comprei|recebi|ganhei|entrou)/g, "")
    .replace(/(\d+[.,]?\d*)/g, "")
    .trim() || "Lançamento";
}

function inferWallet(desc, wallets) {
  desc = desc.toLowerCase();
  return wallets.find(w => desc.includes(w.name.toLowerCase()))?.name || null;
}

function inferCategory(desc, categories) {
  desc = desc.toLowerCase();
  return categories.find(c => desc.includes(c.name.toLowerCase()))?.name || null;
}

let globalContext = {};
