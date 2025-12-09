// /api/chat.js — IA Financeira + Lovable
// Versão inteligente 2025 — interpretação contextual e semântica

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
   
// ================================================================
// EDIÇÃO INTELIGENTE DURANTE A CONFIRMAÇÃO (ÚNICO BLOCO)
// ================================================================
if (pending && !missing) {
  const updated = { ...pending };
  const text = msgLower;

  // FREQUÊNCIA — frases longas ou curtas
  if (
    text === "fixa" ||
    text === "fixo" ||
    text.includes("é fixa") ||
    text.includes("frequência fixa") ||
    text.includes("frequencia fixa")
  ) {
    updated.frequency = "fixed";
    return sendConfirmation(res, updated);
  }

  if (
    text === "variável" ||
    text === "variavel" ||
    text.includes("é variável") ||
    text.includes("é variavel") ||
    text.includes("frequencia variavel")
  ) {
    updated.frequency = "variable";
    return sendConfirmation(res, updated);
  }

  // ALTERAR CATEGORIA
  if (
    text.startsWith("categoria") ||
    text.includes("categoria é") ||
    text.includes("muda categoria") ||
    text.includes("troca categoria") ||
    text.includes("coloca categoria") ||
    text.includes("pra categoria")
  ) {
    const newCategory = text
      .replace("categoria", "")
      .replace("é", "")
      .replace("muda", "")
      .replace("troca", "")
      .replace("coloca", "")
      .replace("pra", "")
      .trim();

    updated.category_name = newCategory;
    return sendConfirmation(res, updated);
  }

  // Categoria enviada sozinha ("lar", "alimentação", etc.)
  if (
    text.split(" ").length === 1 &&
    text.length <= 20 &&
    !["sim", "não", "nao", "ok"].includes(text)
  ) {
    updated.category_name = text;
    return sendConfirmation(res, updated);
  }

  // ALTERAR CONTA — somente se começar com "conta"
  if (text.startsWith("conta")) {
    const newAcc = text
      .replace("conta", "")
      .replace("é", "")
      .replace("na", "")
      .trim();

    updated.account_name = newAcc;
    return sendConfirmation(res, updated);
  }

  // Reconhecer carteira pelo nome
  if (globalContext.wallets?.some(w => text.includes(w.name.toLowerCase()))) {
    const wallet = globalContext.wallets.find(w =>
      text.includes(w.name.toLowerCase())
    );
    updated.account_name = wallet.name;
    return sendConfirmation(res, updated);
  }

  // ALTERAR DESCRIÇÃO
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

    updated.description = newDesc;
    return sendConfirmation(res, updated);
  }

  // ALTERAR VALOR
  const numRegex = /^[0-9]+([.,][0-9]+)?$/;
  if (numRegex.test(text) || text.includes("valor")) {
    const raw = text.replace("valor", "").replace("é", "").trim();
    const n = Number(raw.replace(",", "."));

    if (!isNaN(n) && n > 0) {
      updated.amount = n;
      return sendConfirmation(res, updated);
    }
  }
}


    // ================================================================
    // 2) INTENÇÃO DO USUÁRIO
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
// FUNÇÕES AUXILIARES GERAIS
// ================================================================
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
    // Se tiver sugestões (ambíguo), pergunta entre elas
    if (suggestions && suggestions.length >= 2) {
      return {
        needsMoreInfo: true,
        missingField: "category_name",
        reply: `A categoria desse lançamento é: *${suggestions[0]}* ou *${suggestions[1]}*?`,
        partial
      };
    }

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
// INTELIGÊNCIA DE CATEGORIAS
// ================================================================
function guessCategory(desc, categories) {
  if (!categories || categories.length === 0) return { category: null, suggestions: [] };

  const text = desc.toLowerCase();

  // 1) Match direto pelo nome da categoria
  const direct = categories.find(c => text.includes(c.name.toLowerCase()));
  if (direct) return { category: direct.name, suggestions: [] };

  // 2) Mapa de palavras-chave → categorias (baseado na sua lista)
  const map = [
    { cat: "Moradia", words: ["aluguel", "condomínio", "condominio", "iptu", "prestação", "financiamento"] },
    { cat: "Aluguel", words: ["aluguel", "aluguer"] },
    { cat: "Condomínio", words: ["condomínio", "condominio"] },
    { cat: "IPTU", words: ["iptu"] },

    { cat: "Supermercado", words: ["mercado", "supermercado", "compra do mês", "compras do mes"] },
    { cat: "Padaria", words: ["padaria", "pão", "pao"] },
    { cat: "Delivery", words: ["ifood", "delivery", "lanchinho", "lanche", "restaurante"] },

    { cat: "Combustível", words: ["gasolina", "combustível", "combustivel", "etanol"] },
    { cat: "Ônibus / Trem / Metrô", words: ["ônibus", "onibus", "trem", "metrô", "metro", "passagem"] },
    { cat: "Uber / 99", words: ["uber", "99", "corrida"] },

    { cat: "Energia", words: ["energia", "luz", "eletricidade"] },
    { cat: "Água", words: ["água", "agua", "conta de agua"] },
    { cat: "Gás", words: ["gás", "gas", "botijão"] },
    { cat: "Internet", words: ["internet", "wifi"] },
    { cat: "Plano de celular", words: ["celular", "plano de celular", "telefone"] },
    { cat: "Streaming (Netflix, Prime, etc.)", words: ["netflix", "prime video", "disney", "spotify"] },

    { cat: "Plano de saúde", words: ["plano de saúde", "plano de saude"] },
    { cat: "Farmácia", words: ["remédio", "remedio", "farmácia", "farmacia"] },
    { cat: "Psicólogo / Terapia", words: ["psicólogo", "psicologo", "terapia", "terapeuta"] },
    { cat: "Dentista", words: ["dentista"] },

    { cat: "Educação", words: ["escola", "mensalidade escolar", "faculdade", "curso", "material escolar"] },
    { cat: "Academia / Esportes", words: ["academia", "musculação", "treino", "esporte"] },

    { cat: "Roupas", words: ["roupa", "camisa", "calça", "vestido", "blusa"] },
    { cat: "Calçados", words: ["tênis", "tenis", "sapato", "sandália", "sandalia"] },
    { cat: "Acessórios", words: ["relógio", "relogio", "corrente", "pulseira", "brinco"] },

    { cat: "Dízimo", words: ["dízimo", "dizimo"] },
    { cat: "Oferta", words: ["oferta", "ofertinha"] },
    { cat: "Missões", words: ["missões", "missoes"] },
    { cat: "Ajudas sociais", words: ["ajuda", "cesta básica", "cesta basica", "doação", "doacao"] },

    { cat: "Ração", words: ["ração", "racao"] },
    { cat: "Petshop", words: ["petshop", "banho e tosa"] },

    // ENTRADAS
    { cat: "Salário", words: ["salário", "salario", "meu salário", "meu salario"] },
    { cat: "Extra", words: ["extra", "bico", "freelancer", "freela"] },
    { cat: "Venda", words: ["venda", "vendi"] },
    { cat: "Empréstimo", words: ["empréstimo", "emprestimo"] }
  ];

  let candidates = [];

  for (const item of map) {
    if (item.words.some(w => text.includes(w))) {
      const found = categories.find(
        c => c.name.toLowerCase() === item.cat.toLowerCase()
      );
      if (found) {
        candidates.push(found.name);
      }
    }
  }

  // Nenhum match no mapa
  if (candidates.length === 0) {
    return { category: null, suggestions: [] };
  }

  // Um match claro
  if (candidates.length === 1) {
    return { category: candidates[0], suggestions: [] };
  }

  // Mais de um match → considerado ambíguo, devolve sugestões
  return { category: null, suggestions: [...new Set(candidates)] };
}

//
// ================================================================
// CONFIRMAÇÃO FORMATADA
// ================================================================
function formatConfirmation(data) {
  if (!data.amount || isNaN(Number(data.amount))) {
    return `Me diga o valor desse lançamento 💰\nExemplo: 20, 35.90, 120`;
  }

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

Confirma o lançamento? Responda *SIM* ou *NÃO*.`;
}

//
// ================================================================
// AJUDANTES
// ================================================================
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
