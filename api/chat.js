// /api/chat.js — IA Financeira + Lovable
// Versão inteligente, corrigida e otimizada – 2025
// Fluxo com interpretação semântica e apenas 1 bloco de edição durante confirmação

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

    // ======================================================================
    // 1) CONTINUAÇÃO DE CAMPO FALTANTE
    // ======================================================================
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

      return sendConfirmation(res, updated);
    }

    // ======================================================================
    // 2) EDIÇÃO INTELIGENTE DURANTE A CONFIRMAÇÃO
    // (ÚNICO BLOCO — BUG DE DUPLICAÇÃO CORRIGIDO)
    // ======================================================================
    if (pending && !missing) {
      const updated = { ...pending };
      const text = msgLower;

      // ---------------------------------------------------------------
      // (A) FREQUÊNCIA — interpreta curta e frases longas
      // ---------------------------------------------------------------
      const isFreqFixa =
        text === "fixa" ||
        text === "fixo" ||
        text.includes("é fixa") ||
        text.includes("frequência fixa") ||
        text.includes("frequencia fixa") ||
        text.includes("fix");

      const isFreqVariavel =
        text === "variável" ||
        text === "variavel" ||
        text.includes("é variável") ||
        text.includes("é variavel") ||
        text.includes("frequencia variavel") ||
        text.includes("freq variavel");

      if (isFreqFixa) {
        updated.frequency = "fixed";
        return sendConfirmation(res, updated);
      }

      if (isFreqVariavel) {
        updated.frequency = "variable";
        return sendConfirmation(res, updated);
      }

      // ---------------------------------------------------------------
      // (B) CATEGORIA — interpreta semântica completa
      // ---------------------------------------------------------------
      if (
        text.startsWith("categoria") ||
        text.includes("categoria é") ||
        text.includes("troca categoria") ||
        text.includes("muda categoria") ||
        text.includes("coloca categoria") ||
        text.includes("pra categoria")
      ) {
        const newCategory = text
          .replace("categoria é", "")
          .replace("categoria", "")
          .replace("muda", "")
          .replace("troca", "")
          .replace("coloca", "")
          .replace("pra", "")
          .replace("para", "")
          .trim();

        if (newCategory) {
          updated.category_name = newCategory;
          return sendConfirmation(res, updated);
        }
      }

      // Categoria enviada sozinha ("lar", "mercado", "salário")
      if (
        text.split(" ").length === 1 &&
        text.length <= 20 &&
        !["sim", "não", "nao", "ok"].includes(text)
      ) {
        updated.category_name = text;
        return sendConfirmation(res, updated);
      }

      // ---------------------------------------------------------------
      // (C) CONTA — só ativa se for realmente pedido
      // ---------------------------------------------------------------
      if (
        text.startsWith("conta") ||
        text.includes("troca conta") ||
        text.includes("muda conta") ||
        text.includes("usa conta") ||
        text.includes("é na conta") ||
        text.includes("é na") ||
        text.includes("coloca na conta")
      ) {
        const newAcc = text
          .replace("conta", "")
          .replace("é", "")
          .replace("na", "")
          .replace("troca", "")
          .replace("muda", "")
          .trim();

        if (newAcc.length > 0) {
          updated.account_name = newAcc;
          return sendConfirmation(res, updated);
        }
      }

      // Se o nome da carteira bater com algum wallet
      if (globalContext.wallets?.some(w => text.includes(w.name.toLowerCase()))) {
        const wallet = globalContext.wallets.find(w =>
          text.includes(w.name.toLowerCase())
        );
        updated.account_name = wallet.name;
        return sendConfirmation(res, updated);
      }

      // ---------------------------------------------------------------
      // (D) DESCRIÇÃO
      // ---------------------------------------------------------------
      if (
        text.startsWith("descrição") ||
        text.startsWith("descricao") ||
        text.includes("muda descrição") ||
        text.includes("troca descrição")
      ) {
        const newDesc = text
          .replace("descrição", "")
          .replace("descricao", "")
          .replace("muda", "")
          .replace("troca", "")
          .replace("é", "")
          .trim();

        if (newDesc) {
          updated.description = newDesc;
          return sendConfirmation(res, updated);
        }
      }

      // ---------------------------------------------------------------
      // (E) VALOR — interpreta números sozinhos
      // ---------------------------------------------------------------
      const numberRegex = /^[0-9]+([.,][0-9]+)?$/;
      if (numberRegex.test(text) || text.includes("valor")) {
        const rawValue = text.replace("valor", "").replace("é", "").trim();
        const n = Number(rawValue.replace(",", "."));

        if (!isNaN(n) && n > 0) {
          updated.amount = n;
          return sendConfirmation(res, updated);
        }

        return res.status(200).json({
          reply: "Me informe um valor válido 💰",
          action: "need_more_info",
          data: { missing_field: "amount", partial_data: updated }
        });
      }

      // continua para intents normais
    }

    // ======================================================================
    // 3) INTENÇÃO DO USUÁRIO
    // ======================================================================
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

    // ======================================================================
    // 4) NOVA TRANSAÇÃO
    // ======================================================================
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
      reply: "Ops! Eu tive um problema 😕",
      action: "error",
      details: String(err)
    });
  }
}

//
// ======================================================================
// FUNÇÕES AUXILIARES
// ======================================================================
function sendConfirmation(res, data) {
  return res.status(200).json({
    reply: formatConfirmation(data),
    action: "awaiting_confirmation",
    data
  });
}

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
      reply: "Conferindo seus gastos do mês 📊",
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
// ======================================================================
// PROCESSAMENTO DA TRANSAÇÃO
// ======================================================================
function extractTransaction(msg) {
  const wallets = globalContext.wallets || [];
  const categories = globalContext.categories || [];

  // Detectar tipo da transação
  const type =
    /(recebi|ganhei|entrou)/.test(msg)
      ? "income"
      : /(paguei|gastei|comprei|custou|transferi|enviei)/.test(msg)
      ? "expense"
      : null;

  // Detectar valor
  const amountMatch = msg.match(/(\d+[.,]?\d*)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(",", ".")) : null;

  // Criar descrição automaticamente
  const description = inferDescription(msg);

  // Tentar identificar conta e categoria
  const account = inferWallet(description, wallets);
  const { category, suggestions } = guessCategory(description, categories);

  // Construir objeto parcial
  const partial = {
    type,
    amount,
    description,
    account_name: account,
    category_name: category,
    frequency: "variable"
  };

  // ------------------------------
  // Faltou VALOR
  // ------------------------------
  if (!amount) {
    return {
      needsMoreInfo: true,
      missingField: "amount",
      reply: `Qual foi o valor de *${description}*? 💰`,
      partial
    };
  }

  // ------------------------------
  // Faltou tipo (não sei se é despesa ou receita)
  // ------------------------------
  if (!type) {
    return {
      needsMoreInfo: true,
      missingField: "type",
      reply: `Isso foi *entrada* ou *saída*?`,
      partial
    };
  }

  // ------------------------------
  // Faltou conta
  // ------------------------------
  if (!account) {
    const list = wallets.map(w => `• ${w.name}`).join("\n");
    return {
      needsMoreInfo: true,
      missingField: "account_name",
      reply: `Certo! Agora me diga de qual conta saiu ou entrou:\n\n${list}`,
      partial
    };
  }

  // ------------------------------
  // Faltou categoria
  // ------------------------------
  if (!category) {
    // Se houver sugestões, pergunta entre elas
    if (suggestions && suggestions.length >= 2) {
      return {
        needsMoreInfo: true,
        missingField: "category_name",
        reply: `A categoria desse lançamento é *${suggestions[0]}* ou *${suggestions[1]}*?`,
        partial
      };
    }

    const list = categories.map(c => `• ${c.name}`).join("\n");
    return {
      needsMoreInfo: true,
      missingField: "category_name",
      reply: `Escolha uma categoria:\n\n${list}`,
      partial
    };
  }

  // ------------------------------
  // Tudo OK → Transação completa!
  // ------------------------------
  const fullData = { ...partial };

  return {
    needsMoreInfo: false,
    fullData,
    confirmation: formatConfirmation(fullData)
  };
}


//
// ======================================================================
// CONFIRMAÇÃO FORMATADA
// ======================================================================
function formatConfirmation(data) {
  const amount = Number(data.amount);
  const emoji = data.type === "expense" ? "🔴 Despesa" : "🟢 Receita";
  const freq = data.frequency === "fixed" ? "Fixa" : "Variável";
  const today = new Date().toLocaleDateString("pt-BR");

  return `${emoji} | 📅 ${freq}
💰 Valor: R$ ${amount.toFixed(2)}
📝 Descrição: ${data.description}
💳 Conta: ${data.account_name}
📁 Categoria: ${data.category_name}
_${today}_

Confirma o lançamento? Responda SIM ou NÃO.`;
}
