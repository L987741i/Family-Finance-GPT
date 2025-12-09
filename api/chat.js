// /api/chat.js — IA Financeira + Lovable
// Versão completa com edição durante confirmação
// Compatível com Vercel Serverless (ESM)

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
        reply: "Não entendi 🤔 pode repetir?",
        action: "message"
      });
    }

    const msgLower = message.toLowerCase().trim();

    // ================================================================
    // 1) CONTINUAÇÃO DE CAMPO FALTANTE
    // ================================================================
    if (pending && missing) {
      const updated = { ...pending };

      if (missing === "amount") {
        const parsed = Number(message.replace(",", "."));
        if (!parsed || isNaN(parsed)) {
          return res.status(200).json({
            reply: "Me diga um valor válido 💰",
            action: "need_more_info",
            data: { missing_field: "amount", partial_data: updated }
          });
        }
        updated.amount = parsed;
      }

      if (missing === "account_name") {
        updated.account_name = msgLower;
      }

      if (missing === "category_name") {
        updated.category_name = msgLower;
      }

      const confirmation = formatConfirmation(updated);

      return res.status(200).json({
        reply: confirmation,
        action: "awaiting_confirmation",
        data: updated
      });
    }

    // ================================================================
    // 1.5) EDIÇÃO DURANTE A CONFIRMAÇÃO
    // ================================================================
    if (pending && !missing) {
      const updated = { ...pending };

      // ALTERAR CATEGORIA
      if (msgLower.includes("categoria")) {
        const newCat = msgLower
          .replace("categoria é", "")
          .replace("categoria", "")
          .trim();

        updated.category_name = newCat;

        const confirmation = formatConfirmation(updated);
        return res.status(200).json({
          reply: confirmation,
          action: "awaiting_confirmation",
          data: updated
        });
      }

      // ALTERAR CONTA
      if (msgLower.includes("conta")) {
        const newAcc = msgLower
          .replace("conta é", "")
          .replace("conta", "")
          .trim();

        updated.account_name = newAcc;

        const confirmation = formatConfirmation(updated);
        return res.status(200).json({
          reply: confirmation,
          action: "awaiting_confirmation",
          data: updated
        });
      }

      // ALTERAR VALOR
      if (msgLower.startsWith("valor")) {
        const num = Number(msgLower.replace("valor", "").replace("é", "").replace(",", ".").trim());
        if (!num || isNaN(num)) {
          return res.status(200).json({
            reply: "Informe um valor válido 💰",
            action: "need_more_info",
            data: { missing_field: "amount", partial_data: updated }
          });
        }

        updated.amount = num;

        const confirmation = formatConfirmation(updated);
        return res.status(200).json({
          reply: confirmation,
          action: "awaiting_confirmation",
          data: updated
        });
      }

      // ALTERAR DESCRIÇÃO
      if (msgLower.includes("descrição") || msgLower.includes("descricao")) {
        const newDesc = msgLower
          .replace("descrição é", "")
          .replace("descricao é", "")
          .replace("descrição", "")
          .replace("descricao", "")
          .trim();

        updated.description = newDesc;

        const confirmation = formatConfirmation(updated);
        return res.status(200).json({
          reply: confirmation,
          action: "awaiting_confirmation",
          data: updated
        });
      }
    }

    // ================================================================
    // 2) DETECÇÃO DE INTENÇÃO
    // ================================================================
    const intent = detectIntent(msgLower);

    if (intent.type === "cancel") {
      return res.status(200).json({
        reply: "Tudo certo 👍 operação cancelada!",
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

    // ================================================================
    // 3) NOVA TRANSAÇÃO
    // ================================================================
    const parsed = extractTransaction(msgLower);

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
      reply: "Ops! Tive um problema 😕 tente novamente.",
      action: "error",
      details: String(err)
    });
  }
}

//
// ================================================================
// INTENT DETECTION
// ================================================================
//

function detectIntent(msg) {
  if (/^(cancelar|cancela|esquece)$/.test(msg)) return { type: "cancel" };

  if (/^(sim|pode|ok|confirmo)$/.test(msg)) return { type: "confirm" };

  if (/quanto gastei hoje/.test(msg))
    return { type: "query", action: "query_spent_today", reply: "Verificando seus gastos de hoje 💸" };

  if (/gastei na semana/.test(msg))
    return { type: "query", action: "query_spent_week", reply: "Analisando seus gastos da semana 📅" };

  if (/gastei no mês/.test(msg)) {
    const now = new Date();
    return {
      type: "query",
      action: "query_spent_month",
      reply: "Conferindo seu mês financeiro 📊",
      data: { month: now.getMonth() + 1, year: now.getFullYear() }
    };
  }

  if (/saldo/.test(msg))
    return { type: "query", action: "query_balance", reply: "Calculando seu saldo geral 💼" };

  if (/(paguei|gastei|comprei|recebi|ganhei|entrou)/.test(msg))
    return { type: "transaction" };

  return { type: "general" };
}

//
// ================================================================
// PROCESSAMENTO DA TRANSAÇÃO
// ================================================================
//

function extractTransaction(msg) {
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
      reply: `Só mais uma coisa 😉 Qual conta você usou?\n\n${list}`,
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

  const fullData = { ...partial };

  return {
    needsMoreInfo: false,
    fullData,
    confirmation: formatConfirmation(fullData)
  };
}

//
// ================================================================
// CONFIRMAÇÃO FORMATADA
// ================================================================
//

function formatConfirmation(data) {
  if (!data.amount || isNaN(Number(data.amount))) {
    return `Me diga o valor desse lançamento 💰\nExemplo: 20, 35.90, 120`;
  }

  const amount = Number(data.amount);
  const emoji = data.type === "expense" ? "🔴 Despesa" : "🟢 Receita";
  const today = new Date().toLocaleDateString("pt-BR");

  return `${emoji} | 📅 Variável
💰 Valor: R$ ${amount.toFixed(2)}
📝 Descrição: ${data.description}
💳 Conta: ${data.account_name}
📁 Categoria: ${data.category_name}
_${today}_

Confirma o lançamento? Responda *SIM* ou *NÃO*.`;
}

//
// ================================================================
// HELPERS
// ================================================================
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

function inferCategory(desc, categories) {
  if (!categories || categories.length === 0) return null;

  const text = desc.toLowerCase();

  // MATCH DIRETO
  const direct = categories.find(c => text.includes(c.name.toLowerCase()));
  if (direct) return direct.name;

  // MAPA DE PALAVRAS-CHAVE
  const map = [
    { words: ["pão", "lanche", "comida", "almoço", "mercado"], cat: "Alimentação" },
    { words: ["uber", "gasolina", "combustível"], cat: "Transporte" },
    { words: ["luz", "água", "internet", "telefone"], cat: "Contas Essenciais" },
    { words: ["remédio", "farmácia"], cat: "Saúde" },
    { words: ["roupa", "camisa", "sapato"], cat: "Vestuário" },
    { words: ["curso", "escola"], cat: "Educação" }
  ];

  for (const g of map) {
    if (g.words.some(w => text.includes(w))) {
      const found = categories.find(c => c.name.toLowerCase() === g.cat.toLowerCase());
      if (found) return found.name;
    }
  }

  // fallback
  return categories.find(c => c.type === "expense")?.name || null;
}
