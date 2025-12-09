// /api/chat.js — IA Financeira + Lovable
// Versão 2025 — Revisada, inteligente e estável

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

    if (!message || typeof message !== "string") {
      return res.status(200).json({
        reply: "Não entendi 🤔 pode repetir?",
        action: "message"
      });
    }

    const msgLower = message.toLowerCase().trim();

    // ======================================================================
    // 1) CONTINUAÇÃO DE CAMPO FALTANTE (quando a IA pediu algo específico)
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

      if (missing === "type") {
        // entrada / saída
        if (msgLower.includes("entrada") || msgLower.includes("receita")) {
          updated.type = "income";
        } else if (
          msgLower.includes("saída") ||
          msgLower.includes("saida") ||
          msgLower.includes("despesa")
        ) {
          updated.type = "expense";
        } else {
          return res.status(200).json({
            reply: "Isso foi *entrada* ou *saída*? 🤔",
            action: "need_more_info",
            data: { missing_field: "type", partial_data: updated }
          });
        }
      }

      return sendConfirmation(res, updated);
    }

    // ======================================================================
    // 2) EDIÇÃO INTELIGENTE DURANTE A CONFIRMAÇÃO
    // (APENAS 1 BLOCO, SEM DUPLICAÇÃO)
    // ======================================================================
    if (pending && !missing) {
      const updated = { ...pending };
      const text = msgLower;

      // ---------------------------------------------------------------
      // (A) FREQUÊNCIA — fixa / variável (frases curtas e longas)
      // ---------------------------------------------------------------
      const isFreqFixa =
        text === "fixa" ||
        text === "fixo" ||
        text.includes("é fixa") ||
        text.includes("frequência fixa") ||
        text.includes("frequencia fixa");

      const isFreqVariavel =
        text === "variável" ||
        text === "variavel" ||
        text.includes("é variável") ||
        text.includes("é variavel") ||
        text.includes("frequencia variavel") ||
        text.includes("frequência variável");

      if (isFreqFixa) {
        updated.frequency = "fixed";
        return sendConfirmation(res, updated);
      }

      if (isFreqVariavel) {
        updated.frequency = "variable";
        return sendConfirmation(res, updated);
      }

      // ---------------------------------------------------------------
      // (B) MUDAR CATEGORIA — semântica
      // ---------------------------------------------------------------
      if (
        text.startsWith("categoria") ||
        text.includes("categoria é") ||
        text.includes("muda categoria") ||
        text.includes("troca categoria") ||
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
      // (C) MUDAR CONTA
      // ---------------------------------------------------------------
      if (
        text.startsWith("conta") ||
        text.includes("troca conta") ||
        text.includes("muda conta") ||
        text.includes("usa conta") ||
        text.includes("coloca na conta") ||
        text.includes("é na conta")
      ) {
        const newAcc = text
          .replace("conta", "")
          .replace("troca", "")
          .replace("muda", "")
          .replace("usa", "")
          .replace("coloca", "")
          .replace("na conta", "")
          .replace("é", "")
          .trim();

        if (newAcc) {
          updated.account_name = newAcc;
          return sendConfirmation(res, updated);
        }
      }

      // ---------------------------------------------------------------
      // (D) MUDAR DESCRIÇÃO
      // ---------------------------------------------------------------
      if (
        text.startsWith("descrição") ||
        text.startsWith("descricao") ||
        text.includes("muda descrição") ||
        text.includes("muda descricao") ||
        text.includes("troca descrição") ||
        text.includes("troca descricao")
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
      // (E) MUDAR VALOR
      // ---------------------------------------------------------------
      const numberRegex = /^[0-9]+([.,][0-9]+)?$/;
      if (numberRegex.test(text) || text.includes("valor")) {
        const raw = text.replace("valor", "").replace("é", "").trim();
        const n = Number(raw.replace(",", "."));

        if (!isNaN(n) && n > 0) {
          updated.amount = n;
          return sendConfirmation(res, updated);
        }

        return res.status(200).json({
          reply: "Informe um valor válido 💰",
          action: "need_more_info",
          data: { missing_field: "amount", partial_data: updated }
        });
      }
      // se não for edição, segue o fluxo para intenção (sim, cancelar, etc.)
    }

    // ======================================================================
    // 3) INTENÇÃO DO USUÁRIO (confirmar, cancelar, consultas, etc.)
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
    console.error("Erro na IA Financeira:", err);
    return res.status(500).json({
      reply: "Ops! Tive um problema técnico 😕 Tenta de novo em instantes.",
      action: "error"
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

  if (/(paguei|gastei|comprei|recebi|ganhei|entrou|transferi|enviei)/.test(msg))
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

  const type =
    /(recebi|ganhei|entrou)/.test(msg)
      ? "income"
      : /(paguei|gastei|comprei|custou|transferi|enviei)/.test(msg)
      ? "expense"
      : null;

  const amountMatch = msg.match(/(\d+[.,]?\d*)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(",", ".")) : null;

  const description = inferDescription(msg);

  const account = inferWallet(description, wallets);
  const { category, suggestions } = guessCategory(description, categories);

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
      reply: "Isso foi *entrada* ou *saída*? 🤔",
      partial
    };
  }

  if (!account) {
    const list = wallets.map(w => `• ${w.name}`).join("\n");
    return {
      needsMoreInfo: true,
      missingField: "account_name",
      reply: `Certo! Agora me diga de qual conta saiu ou entrou:\n\n${list}`,
      partial
    };
  }

  if (!category) {
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

  const fullData = { ...partial };

  return {
    needsMoreInfo: false,
    fullData,
    confirmation: formatConfirmation(fullData)
  };
}

//
// ======================================================================
// INTELIGÊNCIA DE CATEGORIAS
// ======================================================================

function guessCategory(desc, categories) {
  if (!categories || categories.length === 0) {
    return { category: null, suggestions: [] };
  }

  const text = desc.toLowerCase();

  // 1) Match direto com nome exato de categoria
  const direct = categories.find(c =>
    text.includes(String(c.name).toLowerCase())
  );
  if (direct) return { category: direct.name, suggestions: [] };

  // 2) Mapa de palavras-chave → categorias
  const map = [
    { cat: "Aluguel", words: ["aluguel", "aluguel da casa", "aluguer"] },
    { cat: "Condomínio", words: ["condomínio", "condominio"] },
    { cat: "IPTU", words: ["iptu"] },

    { cat: "Supermercado", words: ["mercado", "supermercado", "compra do mês", "compras do mes"] },
    { cat: "Padaria", words: ["padaria", "pão", "pao"] },
    { cat: "Delivery", words: ["ifood", "delivery", "lanche", "lanchinho", "restaurante"] },

    { cat: "Combustível", words: ["gasolina", "combustível", "combustivel", "etanol"] },
    { cat: "Ônibus / Trem / Metrô", words: ["ônibus", "onibus", "trem", "metrô", "metro", "passagem"] },
    { cat: "Uber / 99", words: ["uber", "99", "corrida"] },

    { cat: "Energia", words: ["energia", "luz", "eletricidade"] },
    { cat: "Água", words: ["água", "agua", "conta de agua"] },
    { cat: "Gás", words: ["gás", "gas", "botijão"] },
    { cat: "Internet", words: ["internet", "wifi"] },
    { cat: "Plano de celular", words: ["plano de celular", "recarga", "telefone"] },
    { cat: "Streaming (Netflix, Prime, etc.)", words: ["netflix", "prime video", "disney", "spotify"] },

    { cat: "Farmácia", words: ["farmácia", "farmacia", "remédio", "remedio"] },
    { cat: "Psicólogo / Terapia", words: ["psicólogo", "psicologo", "terapia", "terapeuta"] },
    { cat: "Dentista", words: ["dentista"] },

    { cat: "Educação", words: ["escola", "mensalidade escolar", "faculdade", "curso", "material escolar"] },
    { cat: "Academia / Esportes", words: ["academia", "musculação", "treino", "esporte"] },

    { cat: "Roupas", words: ["roupa", "camisa", "calça", "calca", "vestido", "blusa"] },
    { cat: "Calçados", words: ["tênis", "tenis", "sapato", "sandália", "sandalia"] },

    { cat: "Dízimo", words: ["dízimo", "dizimo"] },
    { cat: "Oferta", words: ["oferta", "ofertinha"] },

    { cat: "Ração", words: ["ração", "racao"] },
    { cat: "Petshop", words: ["petshop", "banho e tosa"] },

    // Entradas
    { cat: "Salário", words: ["salário", "salario", "meu salário", "meu salario"] },
    { cat: "Extra", words: ["extra", "bico", "freelancer", "freela"] },
    { cat: "Venda", words: ["venda", "vendi"] },
    { cat: "Empréstimo", words: ["empréstimo", "emprestimo"] }
  ];

  const candidates = [];

  for (const item of map) {
    if (item.words.some(w => text.includes(w))) {
      const found = categories.find(
        c => String(c.name).toLowerCase() === item.cat.toLowerCase()
      );
      if (found) candidates.push(found.name);
    }
  }

  if (candidates.length === 0) return { category: null, suggestions: [] };
  if (candidates.length === 1) return { category: candidates[0], suggestions: [] };

  // Ambíguo → deixar o usuário escolher
  return { category: null, suggestions: [...new Set(candidates)] };
}

//
// ======================================================================
// CONFIRMAÇÃO FORMATADA
// ======================================================================

function formatConfirmation(data) {
  const amount = Number(data.amount || 0);
  const emoji = data.type === "expense" ? "🔴 Despesa" : "🟢 Receita";
  const freq = data.frequency === "fixed" ? "Fixa" : "Variável";
  const today = new Date().toLocaleDateString("pt-BR");

  return `${emoji} | 📅 ${freq}
💰 Valor: R$ ${amount.toFixed(2)}
📝 Descrição: ${data.description || "-"}
💳 Conta: ${data.account_name || "-"}
📁 Categoria: ${data.category_name || "-"}
_${today}_

Confirma o lançamento? Responda *SIM* ou *NÃO*.`;
}

//
// ======================================================================
// OUTROS AJUDANTES
// ======================================================================

function inferDescription(msg) {
  return (
    msg
      .replace(/(paguei|gastei|comprei|recebi|ganhei|entrou|transferi|enviei)/g, "")
      .replace(/(\d+[.,]?\d*)/g, "")
      .trim() || "Lançamento"
  );
}

function inferWallet(desc, wallets) {
  if (!wallets || wallets.length === 0) return null;
  const d = desc.toLowerCase();
  const found = wallets.find(w =>
    d.includes(String(w.name).toLowerCase())
  );
  return found ? found.name : null;
}
