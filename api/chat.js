// /api/chat.js — IA Financeira + Lovable (STATELESS + robusto)
// Versão 2025 — Categorias Fixas + Hierarquia + sem loop + valor por extenso + descrição melhor

// ======================================================================
// ✅ 0) CONFIG
// ======================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

// ⚠️ Se não tiver Supabase, ainda funciona stateless (context vindo do Edge),
// mas não vai persistir entre chamadas se o Edge não persistir.

async function supabaseUpsertState(stateKey, state) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !stateKey) return;

  await fetch(`${SUPABASE_URL}/rest/v1/ff_conversation_state`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify([{ key: stateKey, state }])
  });
}

async function supabaseClearState(stateKey) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !stateKey) return;

  await fetch(`${SUPABASE_URL}/rest/v1/ff_conversation_state?key=eq.${encodeURIComponent(stateKey)}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`
    }
  });
}

// ======================================================================
// 🧠 1) DEFINIÇÃO OFICIAL DE CATEGORIAS
// ======================================================================

const CATEGORY_TREE = {
  expense: [
    { group: "Moradia", items: [
      { name: "Aluguel", keywords: ["aluguel"] },
      { name: "Financiamento / Prestação", keywords: ["financiamento", "prestação", "prestacao", "parcela"] },
      { name: "Condomínio", keywords: ["condomínio", "condominio"] },
      { name: "IPTU", keywords: ["iptu"] }
    ]},
    { group: "Contas Essenciais", items: [
      { name: "Energia", keywords: ["energia", "luz"] },
      { name: "Água", keywords: ["água", "agua", "cedae"] },
      { name: "Gás", keywords: ["gás", "gas", "botijão", "botijao"] },
      { name: "Internet", keywords: ["internet", "wifi"] },
      { name: "Telefonia", keywords: ["telefone", "celular", "recarga", "plano"] }
    ]},
    { group: "Alimentação", items: [
      { name: "Supermercado", keywords: ["mercado", "supermercado", "compra do mês", "compra do mes"] },
      { name: "Padaria", keywords: ["padaria", "pão", "pao"] },
      { name: "Açougue", keywords: ["açougue", "acougue"] },
      { name: "Feira", keywords: ["feira", "hortifruti"] },
      { name: "Restaurante", keywords: ["almoço", "almoco", "jantar", "restaurante"] },
      { name: "Lanche", keywords: ["lanche", "ifood", "delivery", "burger", "pizza"] }
    ]},
    { group: "Transporte", items: [
      { name: "Combustível", keywords: ["gasolina", "etanol", "combustível", "combustivel"] },
      { name: "Estacionamento", keywords: ["estacionamento", "zona azul"] },
      { name: "Pedágio", keywords: ["pedágio", "pedagio"] },
      { name: "Manutenção Veicular", keywords: ["oficina", "mecânico", "mecanico", "manutenção", "manutencao"] },
      { name: "Seguro Auto", keywords: ["seguro auto"] },
      { name: "Transporte App / Público", keywords: ["uber", "99", "ônibus", "onibus", "trem", "metrô", "metro"] }
    ]},
    { group: "Saúde", items: [
      { name: "Farmácia", keywords: ["farmácia", "farmacia", "remédio", "remedio"] },
      { name: "Consultas", keywords: ["consulta", "dentista", "psicólogo", "psicologo"] },
      { name: "Exames", keywords: ["exame", "laboratório", "laboratorio"] },
      { name: "Hospital", keywords: ["hospital"] },
      { name: "Plano de Saúde", keywords: ["plano de saúde", "plano de saude", "unimed"] }
    ]},
    { group: "Educação", items: [
      { name: "Escola", keywords: ["escola", "colégio", "colegio"] },
      { name: "Cursos", keywords: ["curso", "faculdade", "inglês", "ingles"] },
      { name: "Material Escolar", keywords: ["material escolar", "caderno"] }
    ]},
    { group: "Lazer", items: [
      { name: "Cinema", keywords: ["cinema", "filme"] },
      { name: "Viagem", keywords: ["viagem", "hotel"] },
      { name: "Passeios", keywords: ["passeio", "parque", "ingresso"] },
      { name: "Streaming", keywords: ["netflix", "spotify", "prime", "disney"] }
    ]},
    { group: "Vestuário", items: [
      { name: "Roupas", keywords: ["roupa", "blusa", "camisa", "calça", "calca"] },
      { name: "Calçados", keywords: ["tênis", "tenis", "sapato"] },
      { name: "Acessórios", keywords: ["relógio", "relogio", "bolsa"] }
    ]},
    { group: "Financeiro", items: [
      { name: "Tarifa Bancária", keywords: ["tarifa", "taxa bancária", "taxa bancaria"] },
      { name: "Anuidade Cartão", keywords: ["anuidade", "cartão de crédito", "cartao de credito"] },
      { name: "Juros", keywords: ["juros", "atraso"] },
      { name: "Multas", keywords: ["multa"] }
    ]},
    { group: "Casa & Manutenção", items: [
      { name: "Reforma", keywords: ["reforma", "obra", "pedreiro"] },
      { name: "Móveis", keywords: ["sofá", "sofa", "cama", "mesa", "cadeira"] },
      { name: "Ferramentas", keywords: ["furadeira", "martelo"] }
    ]},
    { group: "Pets", items: [
      { name: "Ração", keywords: ["ração", "racao"] },
      { name: "Veterinário", keywords: ["veterinário", "veterinario"] },
      { name: "Higiene", keywords: ["banho e tosa", "petshop"] }
    ]},
    { group: "Outros / Diversos", items: [
      { name: "Presentes", keywords: ["presente"] },
      { name: "Doações", keywords: ["doação", "doacao", "dízimo", "dizimo"] },
      { name: "Emergências", keywords: ["emergência", "emergencia", "imprevisto"] }
    ]}
  ],
  income: [
    { group: "Receita", items: [
      { name: "Salário", keywords: ["salário", "salario", "pagamento"] },
      { name: "Investimentos", keywords: ["investimento", "dividendos"] },
      { name: "Extras", keywords: ["freela", "bico", "extra"] },
      { name: "Presentes", keywords: ["presente", "ganhei"] },
      { name: "Venda", keywords: ["venda", "vendi"] },
      { name: "Empréstimo (entrada)", keywords: ["emprestimo", "entrada"] },
      { name: "Juros", keywords: ["juros"] },
      { name: "Benefícios", keywords: ["vr", "va", "benefício", "beneficio"] }
    ]}
  ]
};

function findBestCategory(text, type = "expense") {
  const list = CATEGORY_TREE[type] || [];
  let best = null;
  let bestScore = 0;
  const clean = (text || "").toLowerCase();

  for (const group of list) {
    for (const item of group.items) {
      let score = 0;
      const itemName = item.name.toLowerCase();

      if (clean === itemName) score += 100;
      else if (clean.includes(itemName)) score += 60;

      for (const kw of item.keywords) {
        if (clean.includes(kw.toLowerCase())) score += 40 + kw.length;
      }

      if (score > bestScore) {
        bestScore = score;
        best = `${group.group} / ${item.name}`;
      }
    }
  }

  return { best, score: bestScore };
}

// ======================================================================
// 🔢 2) PARSER DE VALOR (número + por extenso pt-BR)
// ======================================================================

const UNITS = {
  "zero":0,"um":1,"uma":1,"dois":2,"duas":2,"tres":3,"três":3,"quatro":4,"cinco":5,
  "seis":6,"sete":7,"oito":8,"nove":9,"dez":10,"onze":11,"doze":12,"treze":13,
  "quatorze":14,"catorze":14,"quinze":15,"dezesseis":16,"dezessete":17,"dezoito":18,"dezenove":19
};

const TENS = {
  "vinte":20,"trinta":30,"quarenta":40,"cinquenta":50,"sessenta":60,"setenta":70,"oitenta":80,"noventa":90
};

const HUNDREDS = {
  "cem":100,"cento":100,"duzentos":200,"trezentos":300,"quatrocentos":400,"quinhentos":500,
  "seiscentos":600,"setecentos":700,"oitocentos":800,"novecentos":900
};

function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.,-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumberFromTextPT(text) {
  const t = normalizeText(text);

  // 1) primeiro tenta números explícitos: 20000 / 20.000 / 20,50
  const numMatch = t.match(/(\d{1,3}(\.\d{3})+|\d+)([.,]\d+)?/);
  if (numMatch) {
    const raw = numMatch[0];
    const cleaned = raw.replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    if (!isNaN(n) && n > 0) return n;
  }

  // 2) por extenso (simplificado, mas resolve 90% dos casos comuns)
  // suporta: "vinte mil", "duzentos", "dois mil e cinquenta", "vinte e três"
  let total = 0;
  let current = 0;

  const words = t.split(" ");
  for (let i = 0; i < words.length; i++) {
    const w = words[i];

    if (w === "e" || w === "reais" || w === "real" || w === "r$") continue;

    if (UNITS[w] != null) {
      current += UNITS[w];
      continue;
    }
    if (TENS[w] != null) {
      current += TENS[w];
      continue;
    }
    if (HUNDREDS[w] != null) {
      current += HUNDREDS[w];
      continue;
    }

    if (w === "mil") {
      if (current === 0) current = 1;
      total += current * 1000;
      current = 0;
      continue;
    }

    if (w === "milhão" || w === "milhao" || w === "milhões" || w === "milhoes") {
      if (current === 0) current = 1;
      total += current * 1000000;
      current = 0;
      continue;
    }
  }

  const result = total + current;
  return result > 0 ? result : null;
}

// ======================================================================
// ✍️ 3) DESCRIÇÃO INTELIGENTE
// ======================================================================

function inferDescription(msg) {
  const t = normalizeText(msg);

  // remove frases comuns de lançamento
  let s = t
    .replace(/\b(paguei|gastei|comprei|recebi|ganhei|entrou|transferi|enviei)\b/g, "")
    .replace(/\b(por|no|na|num|numa|de|do|da|dos|das)\b/g, " ")
    .replace(/\b(\d{1,3}(\.\d{3})+|\d+)([.,]\d+)?\b/g, " ")
    .replace(/\b(reais|real|r\$)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // se ficar vazio, fallback
  if (!s) return "Lançamento";

  // pega o núcleo: 1 a 4 palavras principais
  // ex: "uma cadeira" -> "cadeira"
  s = s.replace(/\b(um|uma|uns|umas)\b/g, "").trim();
  if (!s) return "Lançamento";

  // capitaliza primeira letra
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function inferWallet(desc, wallets) {
  if (!wallets || wallets.length === 0) return null;
  const d = (desc || "").toLowerCase();
  const w = wallets.find(w => d.includes((w.name || "").toLowerCase()));
  return w ? w.name : null;
}

// ======================================================================
// 📦 4) CONFIRMAÇÃO
// ======================================================================

function formatConfirmation(data) {
  const amount = Number(data.amount || 0);
  const emoji = data.type === "expense" ? "🔴 Despesa" : "🟢 Receita";
  const freq = data.frequency === "fixed" ? "Fixa" : "Variável";
  const today = new Date().toLocaleDateString("pt-BR");

  const acc = data.account_name || "—";
  const cat = data.category_name || "—";

  return `${emoji} | 📅 ${freq}
💰 Valor: R$ ${amount.toFixed(2)}
📝 Descrição: ${data.description}
💳 Conta: ${acc}
📁 Categoria: ${cat}
_${today}_

Confirma o lançamento? (Sim/Não)`;
}

// ======================================================================
// 🧠 5) EXTRAÇÃO DE TRANSAÇÃO
// ======================================================================

function extractTransaction(msg, context) {
  const wallets = context?.wallets || [];

  const lower = normalizeText(msg);

  const type = /(recebi|ganhei|salario|salário|entrada|entrou)/.test(lower) ? "income" : "expense";
  const amount = parseNumberFromTextPT(lower);

  const description = inferDescription(msg);
  const account = inferWallet(description, wallets);
  const { best: category } = findBestCategory(description, type);

  const partial = {
    type,
    amount,
    description,
    account_name: account,
    category_name: category,
    frequency: /(fixo|fixa|mensal)/.test(lower) ? "fixed" : "variable"
  };

  if (!amount) {
    return {
      needsMoreInfo: true,
      missingField: "amount",
      reply: `Qual o valor de *${description}*? 💰`,
      partial
    };
  }

  if (!account) {
    const list = wallets.map(w => `• ${w.name}`).join("\n");
    return {
      needsMoreInfo: true,
      missingField: "account_name",
      reply: `De qual conta saiu ou entrou? 💳\n\n${list}`,
      partial
    };
  }

  if (!category) {
    return {
      needsMoreInfo: true,
      missingField: "category_name",
      reply: `Qual categoria melhor representa esse lançamento?`,
      partial
    };
  }

  return {
    needsMoreInfo: false,
    fullData: partial,
    confirmation: formatConfirmation(partial)
  };
}

// ======================================================================
// 🧠 6) INTENÇÃO
// ======================================================================

function detectIntent(msg) {
  const m = normalizeText(msg);

  if (/^(cancelar|cancela|cancel|esquece|parar|stop|não|nao|n)$/i.test(m)) return { type: "cancel" };
  if (/^(sim|s|ok|confirmo|confirmar|confirm)$/i.test(m)) return { type: "confirm" };

  if (/\bsaldo\b/.test(m)) return { type: "query", action: "query_balance", reply: "Calculando saldo..." };

  if (/(paguei|gastei|comprei|recebi|ganhei|entrou|transferi|enviei)/.test(m)) return { type: "transaction" };

  return { type: "general" };
}

// ======================================================================
// ✅ 7) HANDLER PRINCIPAL (STATELESS)
// ======================================================================

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const message = body.message;
    const context = body.context || {};

    // 🔑 stateKey recomendado: telefone do WhatsApp (ex: "5511999999999")
    const stateKey = body.stateKey || context.stateKey || null;

    // ✅ Se o Edge disser que não tem pendência, limpamos o estado persistido.
    // Isso elimina o "fantasma" e garante sincronização.
    if (context.pending_transaction === null) {
      await supabaseClearState(stateKey);
    }

    const pending = context?.pending_transaction || null;
    const missing = context?.missing_field || null;

    if (!message) {
      return res.status(200).json({ reply: "Não entendi 🤔 pode repetir?", action: "message" });
    }

    const msg = message.toLowerCase().trim();

    // 1) Resolvendo campo faltante
    if (pending && missing) {
      const updated = { ...pending };

      if (missing === "amount") {
        const n = parseNumberFromTextPT(msg);
        if (!n) {
          return res.status(200).json({
            reply: "Valor inválido. Me diga um valor real 💰",
            action: "need_more_info",
            data: { missing_field: "amount", partial_data: updated }
          });
        }
        updated.amount = n;
      }

      if (missing === "account_name") {
        updated.account_name = msg;
      }

      if (missing === "category_name") {
        const { best } = findBestCategory(msg, updated.type);
        updated.category_name = best || "Outros / Diversos";
      }

      return res.status(200).json({
        reply: formatConfirmation(updated),
        action: "awaiting_confirmation",
        data: updated
      });
    }

    // 2) Edição durante confirmação
    if (pending) {
      const updated = { ...pending };

      if (msg.startsWith("categoria") || msg.includes("categoria é") || msg.includes("categoria eh")) {
        const raw = msg.replace("categoria", "").replace("é", "").replace("eh", "").trim();
        const { best } = findBestCategory(raw, updated.type);
        updated.category_name = best || "Outros / Diversos";
        return res.status(200).json({ reply: formatConfirmation(updated), action: "awaiting_confirmation", data: updated });
      }

      if (msg.includes("conta")) {
        updated.account_name = msg.replace("conta", "").trim();
        return res.status(200).json({ reply: formatConfirmation(updated), action: "awaiting_confirmation", data: updated });
      }

      const n = parseNumberFromTextPT(msg);
      if (n && n > 0) {
        updated.amount = n;
        return res.status(200).json({ reply: formatConfirmation(updated), action: "awaiting_confirmation", data: updated });
      }

      if (msg.includes("descrição") || msg.includes("descricao")) {
        updated.description = msg.replace("descrição", "").replace("descricao", "").trim();
        return res.status(200).json({ reply: formatConfirmation(updated), action: "awaiting_confirmation", data: updated });
      }
    }

    // 3) Intenção
    const intent = detectIntent(msg);

    if (intent.type === "cancel") {
      // limpando persistência também
      await supabaseClearState(stateKey);
      return res.status(200).json({ reply: "Cancelado 👍", action: "cancelled" });
    }

    if (intent.type === "confirm") {
      if (!pending) return res.status(200).json({ reply: "Nada para confirmar.", action: "message" });

      // confirmando = limpando pendência persistida
      await supabaseClearState(stateKey);

      return res.status(200).json({
        reply: "Registrado! ✅",
        action: "success",
        data: pending
      });
    }

    if (intent.type === "query") {
      return res.status(200).json({ reply: intent.reply, action: intent.action, data: intent.data || {} });
    }

    // 4) Nova transação
    const parsed = extractTransaction(msg, context);

    if (parsed.needsMoreInfo) {
      return res.status(200).json({
        reply: parsed.reply,
        action: "need_more_info",
        data: { missing_field: parsed.missingField, partial_data: parsed.partial }
      });
    }

    return res.status(200).json({
      reply: parsed.confirmation,
      action: "awaiting_confirmation",
      data: parsed.fullData
    });

  } catch (err) {
    console.error("ERRO:", err);
    return res.status(500).json({ reply: "Erro técnico 😕", action: "error" });
  }
}
