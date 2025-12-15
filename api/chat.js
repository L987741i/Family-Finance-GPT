// /api/chat.js — IA Financeira + Lovable
// Versão 2025 — Estável, com transcrição inteligente de edição

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

      if (missing === "type") {
        const norm = normalize(msgLower);
        if (norm.includes("entrada") || norm.includes("receita")) {
          updated.type = "income";
        } else if (
          norm.includes("saida") ||
          norm.includes("saída") ||
          norm.includes("despesa")
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
    // 2) EDIÇÃO INTELIGENTE DURANTE A CONFIRMAÇÃO (TRANSCRIÇÃO)
    // ======================================================================
    if (pending && !missing) {
      const updated = { ...pending };
      const edit = transcribeEdit(msgLower, pending, globalContext);

      if (edit) {
        updated[edit.field] = edit.value;
        return sendConfirmation(res, updated);
      }
      // se não for edição, segue pro fluxo de intenção (sim, cancelar, etc.)
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
    console.error("Erro na IA Financeira:", err);
    return res.status(500).json({
      reply: "Ops! Tive um problema técnico 😕 Tenta de novo em instantes.",
      action: "error"
    });
  }
}

//
// ======================================================================
// FUNÇÕES AUXILIARES PRINCIPAIS
// ======================================================================

function sendConfirmation(res, data) {
  return res.status(200).json({
    reply: formatConfirmation(data),
    action: "awaiting_confirmation",
    data
  });
}

function detectIntent(msg) {
  const norm = normalize(msg);

  // tratar SIM / NÃO como confirmação/cancelamento
  if (/^(sim|pode|ok|confirmo)$/.test(norm)) return { type: "confirm" };
  if (/^(nao|não|n)$/.test(norm) || /^(cancelar|cancela|esquece)$/.test(norm)) {
    return { type: "cancel" };
  }

  if (norm.includes("quanto gastei hoje"))
    return { type: "query", action: "query_spent_today", reply: "Verificando seus gastos de hoje 💸" };

  if (norm.includes("gastei na semana"))
    return { type: "query", action: "query_spent_week", reply: "Analisando seus gastos da semana 📅" };

  if (norm.includes("gastei no mes") || norm.includes("gastei no mês")) {
    const now = new Date();
    return {
      type: "query",
      action: "query_spent_month",
      reply: "Conferindo seus gastos do mês 📊",
      data: { month: now.getMonth() + 1, year: now.getFullYear() }
    };
  }

  if (norm.includes("saldo"))
    return { type: "query", action: "query_balance", reply: "Calculando seu saldo geral 💼" };

  if (/(paguei|gastei|comprei|recebi|ganhei|entrou|transferi|enviei)/.test(norm))
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

  const norm = normalize(msg);

  const type =
    /(recebi|ganhei|entrou)/.test(norm)
      ? "income"
      : /(paguei|gastei|comprei|custou|transferi|enviei)/.test(norm)
      ? "expense"
      : null;

  const amountMatch = norm.match(/(\d+[.,]?\d*)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(",", ".")) : null;

  const description = inferDescription(norm);

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
// TRANSCRIÇÃO DE EDIÇÃO DURANTE CONFIRMAÇÃO
// ======================================================================

function transcribeEdit(text, pending, context) {
  const wallets = context.wallets || [];
  const norm = normalize(text);

  // -------- FREQUÊNCIA --------
  if (
    norm === "fixa" ||
    norm === "fixo" ||
    norm.includes("frequencia fixa") ||
    norm.includes("freq fixa")
  ) {
    return { field: "frequency", value: "fixed" };
  }

  if (
    norm === "variavel" ||
    norm.includes("frequencia variavel") ||
    norm.includes("freq variavel")
  ) {
    return { field: "frequency", value: "variable" };
  }

  // -------- CATEGORIA (frases) --------
  if (
    norm.startsWith("categoria") ||
    norm.includes("categoria e") ||
    norm.includes("categoria eh") ||
    norm.includes("muda categoria") ||
    norm.includes("troca categoria") ||
    norm.includes("coloca categoria") ||
    norm.includes("pra categoria")
  ) {
    let cat = norm
      .replace("categoria e", "")
      .replace("categoria eh", "")
      .replace("categoria", "")
      .replace("muda", "")
      .replace("troca", "")
      .replace("coloca", "")
      .replace("pra", "")
      .replace("para", "")
      .trim();

    if (!cat) cat = norm;
    return { field: "category_name", value: cat };
  }

  // -------- CATEGORIA (uma palavra) --------
  if (
    norm.split(" ").length === 1 &&
    norm.length <= 20 &&
    !["sim", "nao", "ok"].includes(norm)
  ) {
    // se já tem categoria e a palavra bate mais com conta, não mexe aqui
    if (wallets.some(w => norm === normalize(String(w.name)))) {
      return { field: "account_name", value: text.trim() };
    }
    return { field: "category_name", value: text.trim() };
  }

  // -------- CONTA --------
  if (
    norm.startsWith("conta") ||
    norm.includes("troca conta") ||
    norm.includes("muda conta") ||
    norm.includes("usa conta") ||
    norm.includes("na conta") ||
    norm.includes("banco") ||
    norm.includes("carteira")
  ) {
    let acc = norm
      .replace("conta", "")
      .replace("troca", "")
      .replace("muda", "")
      .replace("usa", "")
      .replace("na conta", "")
      .replace("banco", "")
      .replace("carteira", "")
      .trim();

    if (!acc) acc = text.trim();
    return { field: "account_name", value: acc };
  }

  // nome de carteira contido no texto
  if (wallets.length > 0) {
    const hit = wallets.find(w =>
      norm.includes(normalize(String(w.name)))
    );
    if (hit) {
      return { field: "account_name", value: hit.name };
    }
  }

  // -------- VALOR --------
  const numberRegex = /^[0-9]+([.,][0-9]+)?$/;
  if (numberRegex.test(norm) || norm.includes("valor")) {
    const raw = norm.replace("valor", "").replace("e", "").trim();
    const n = Number(raw.replace(",", ".") || raw);
    if (!isNaN(n) && n > 0) {
      return { field: "amount", value: n };
    }
  }

  // -------- DESCRIÇÃO --------
  if (
    norm.startsWith("descricao") ||
    norm.startsWith("descrição") ||
    norm.includes("muda descricao") ||
    norm.includes("muda descrição") ||
    norm.includes("troca descricao") ||
    norm.includes("troca descrição")
  ) {
    let desc = text
      .toLowerCase()
      .replace("descrição", "")
      .replace("descricao", "")
      .replace("muda", "")
      .replace("troca", "")
      .replace("é", "")
      .trim();

    if (!desc) desc = text.trim();
    return { field: "description", value: desc };
  }

  return null;
}

//
// ======================================================================
// INTELIGÊNCIA DE CATEGORIAS
// ======================================================================

function guessCategory(desc, categories) {
  if (!categories || categories.length === 0) {
    return { category: null, suggestions: [] };
  }

  const text = normalize(desc);

  // match direto pelo nome da categoria
  const direct = categories.find(c =>
    text.includes(normalize(String(c.name)))
  );
  if (direct) return { category: direct.name, suggestions: [] };

  const map = [
    { cat: "Aluguel", words: ["aluguel", "aluguer"] },
    { cat: "Condomínio", words: ["condominio", "condomínio"] },
    { cat: "IPTU", words: ["iptu"] },

    { cat: "Supermercado", words: ["mercado", "supermercado", "compra do mes"] },
    { cat: "Padaria", words: ["padaria", "pao", "pão"] },
    { cat: "Delivery", words: ["ifood", "delivery", "lanche", "restaurante"] },

    { cat: "Combustível", words: ["gasolina", "combustivel", "combustível", "etanol"] },
    { cat: "Ônibus / Trem / Metrô", words: ["onibus", "ônibus", "trem", "metro", "metrô"] },
    { cat: "Uber / 99", words: ["uber", "99", "corrida"] },

    { cat: "Energia", words: ["energia", "luz"] },
    { cat: "Água", words: ["agua", "água"] },
    { cat: "Gás", words: ["gas", "gás", "botijao", "botijão"] },
    { cat: "Internet", words: ["internet", "wifi"] },
    { cat: "Plano de celular", words: ["plano de celular", "recarga", "telefone"] },
    { cat: "Streaming (Netflix, Prime, etc.)", words: ["netflix", "prime", "disney", "spotify"] },

    { cat: "Farmácia", words: ["farmacia", "farmácia", "remedio", "remédio"] },
    { cat: "Psicólogo / Terapia", words: ["psicologo", "psicólogo", "terapia"] },
    { cat: "Dentista", words: ["dentista"] },

    { cat: "Educação", words: ["escola", "faculdade", "curso", "material escolar"] },
    { cat: "Academia / Esportes", words: ["academia", "musculacao", "musculação", "treino", "esporte"] },

    { cat: "Roupas", words: ["roupa", "camisa", "calca", "calça", "vestido", "blusa"] },
    { cat: "Calçados", words: ["tenis", "tênis", "sapato", "sandalia", "sandália"] },

    { cat: "Dízimo", words: ["dizimo", "dízimo"] },
    { cat: "Oferta", words: ["oferta", "ofertinha"] },

    { cat: "Ração", words: ["racao", "ração"] },
    { cat: "Petshop", words: ["petshop", "banho e tosa"] },

    { cat: "Salário", words: ["salario", "salário", "meu salario", "meu salário"] },
    { cat: "Extra", words: ["extra", "bico", "freelancer", "freela"] },
    { cat: "Venda", words: ["venda", "vendi"] },
    { cat: "Empréstimo", words: ["emprestimo", "empréstimo"] }
  ];

  const candidates = [];

  for (const item of map) {
    if (item.words.some(w => text.includes(normalize(w)))) {
      const found = categories.find(
        c => normalize(String(c.name)) === normalize(item.cat)
      );
      if (found) candidates.push(found.name);
    }
  }

  if (candidates.length === 0) return { category: null, suggestions: [] };
  if (candidates.length === 1) return { category: candidates[0], suggestions: [] };

  return { category: null, suggestions: [...new Set(candidates)] };
}

//
// ======================================================================
// FORMATAR CONFIRMAÇÃO
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
// OUTROS HELPERS
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
  const d = normalize(desc);
  const found = wallets.find(w =>
    d.includes(normalize(String(w.name)))
  );
  return found ? found.name : null;
}

function normalize(str) {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
