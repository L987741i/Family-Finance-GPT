// /api/chat.js — IA Financeira integrada ao Lovable
// Versão com categorização automática baseada nas categorias do usuário
// Compatível com Vercel (ESM)

let globalContext = {};

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

    // ======================================================
    // 1) CONTINUAÇÃO (quando falta campo)
    // ======================================================
    if (pending && missing) {
      const updated = { ...pending };

      if (missing === "amount") {
        const parsed = Number(message.replace(",", "."));
        if (!parsed || isNaN(parsed)) {
          return res.status(200).json({
            reply: "Informe um valor numérico válido 💰",
            action: "need_more_info",
            data: {
              missing_field: "amount",
              partial_data: updated
            }
          });
        }
        updated.amount = parsed;
      }

      if (missing === "account_name") {
        updated.account_name = message.trim().toLowerCase();
      }

      if (missing === "category_name") {
        updated.category_name = message.trim().toLowerCase();
      }

      const confirmation = formatConfirmation(updated);

      return res.status(200).json({
        reply: confirmation,
        action: "awaiting_confirmation",
        data: updated
      });
    }

    // ======================================================
    // 2) DETECTAR INTENÇÃO
    // ======================================================

    const intent = detectIntent(message);

    if (intent.type === "cancel") {
      return res.status(200).json({
        reply: "Tudo certo 👍 Operação cancelada!",
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

    // ======================================================
    // 3) NOVA TRANSAÇÃO
    // ======================================================
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

  } catch (error) {
    console.error("Erro na IA:", error);
    return res.status(500).json({
      reply: "Tive um problema inesperado 😕 Tente novamente.",
      action: "error",
      details: String(error)
    });
  }
}

//
// ======================================================
// DETECÇÃO DE INTENÇÃO
// ======================================================
//

function detectIntent(msg) {
  msg = msg.toLowerCase().trim();

  if (/^(cancelar|cancela|esquece|deixa pra lá)$/.test(msg)) {
    return { type: "cancel" };
  }

  if (/^(sim|pode|ok|confirmo)$/.test(msg)) {
    return { type: "confirm" };
  }

  if (/quanto gastei hoje/.test(msg)) {
    return {
      type: "query",
      action: "query_spent_today",
      reply: "Vou verificar seus gastos de hoje 💸"
    };
  }

  if (/gastei na semana/.test(msg)) {
    return {
      type: "query",
      action: "query_spent_week",
      reply: "Vou conferir sua semana financeira 📅"
    };
  }

  if (/gastei no mês/.test(msg)) {
    const now = new Date();
    return {
      type: "query",
      action: "query_spent_month",
      reply: "Consultando gastos do mês 📊",
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

//
// ======================================================
// PROCESSAMENTO DE TRANSAÇÕES
// ======================================================
//

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
  const amount = amountMatch ? Number(amountMatch[1].replace(",", ".")) : null;

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

  if (!category) {
    const list = categories.map(c => `• ${c.name}`).join("\n");
    return {
      needsMoreInfo: true,
      missingField: "category_name",
      reply: `Certo! Agora escolha uma categoria:\n\n${list}`,
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

//
// ======================================================
// FORMATAÇÃO DA CONFIRMAÇÃO
// ======================================================
//

function formatConfirmation(data) {
  if (!data.amount || isNaN(Number(data.amount))) {
    return `Só mais uma coisa 😉\nQual é o *valor* do lançamento?\n\nExemplos: 20, 35.90, 120`;
  }

  const amount = Number(data.amount);
  const emoji = data.type === "expense" ? "🔴 *Despesa*" : "🟢 *Receita*";
  const today = new Date().toLocaleDateString("pt-BR");

  return `${emoji} | 📅 Variável
💰 *Valor*: R$ ${amount.toFixed(2)}
📝 *Descrição*: ${data.description}
💳 *Conta*: ${data.account_name}
📁 *Categoria*: ${data.category_name}
_${today}_

Confirma o lançamento? Responda *SIM* ou *NÃO*.`;
}

//
// ======================================================
// HELPERS: DESCRIÇÃO / CONTA / CATEGORIA
// ======================================================
//

function inferDescription(msg) {
  return msg
    .replace(/(paguei|gastei|comprei|recebi|ganhei|entrou)/g, "")
    .replace(/(\d+[.,]?\d*)/g, "")
    .trim() || "Lançamento";
}

function inferWallet(desc, wallets) {
  const d = desc.toLowerCase();
  return wallets.find(w => d.includes(w.name.toLowerCase()))?.name || null;
}

/**
 * INFERÊNCIA DE CATEGORIA — versão inteligente
 * Usa:
 * 1) correspondência direta
 * 2) palavras-chave mapeadas
 * 3) fallback por similaridade parcial
 */
function inferCategory(desc, categories) {
  if (!categories || categories.length === 0) return null;

  const text = desc.toLowerCase();

  // 1) MATCH DIRETO
  const direct = categories.find(c => text.includes(c.name.toLowerCase()));
  if (direct) return direct.name;

  // 2) PALAVRAS-CHAVE → CATEGORIA
  const keywordMap = [
    { words: ["pão", "lanche", "comida", "almoço", "jantar", "feira", "mercado"], cat: "Alimentação" },
    { words: ["uber", "ônibus", "gasolina", "combustível"], cat: "Transporte" },
    { words: ["luz", "água", "internet", "telefone"], cat: "Contas Essenciais" },
    { words: ["remédio", "farmácia", "dor"], cat: "Saúde" },
    { words: ["roupa", "camisa", "sapato"], cat: "Vestuário" },
    { words: ["curso", "escola", "apostila"], cat: "Educação" },
    { words: ["cinema", "viagem", "lazer"], cat: "Lazer" }
  ];

  for (const group of keywordMap) {
    if (group.words.some(w => text.includes(w))) {
      const found = categories.find(c => c.name.toLowerCase() === group.cat.toLowerCase());
      if (found) return found.name;
    }
  }

  // 3) FALLBACK → pega primeira categoria do tipo "expense"
  const fallback = categories.find(c => c.type === "expense");
  return fallback ? fallback.name : null;
}
