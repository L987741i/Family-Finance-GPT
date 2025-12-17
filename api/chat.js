// /api/chat.js — IA Financeira + Lovable
// VERSÃO FINAL ESTÁVEL 2025
// ✔ Categoria obrigatória
// ✔ Números por extenso
// ✔ WhatsApp ready
// ✔ Produção

let globalContext = {};

//
// ======================================================================
// 🔢 NÚMEROS POR EXTENSO (PT-BR)
// ======================================================================
//

const NUMBER_WORDS = {
  zero: 0,
  um: 1, uma: 1,
  dois: 2, duas: 2,
  três: 3, tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14, catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  trezentos: 300,
  quatrocentos: 400,
  quinhentos: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
  mil: 1000
};

function parseNumberFromTextPT(text) {
  const words = text.toLowerCase().split(/\s+/);
  let total = 0;
  let current = 0;
  let found = false;

  for (const w of words) {
    if (NUMBER_WORDS[w] !== undefined) {
      found = true;
      const value = NUMBER_WORDS[w];

      if (value === 1000) {
        current = current === 0 ? 1000 : current * 1000;
        total += current;
        current = 0;
      } else {
        current += value;
      }
    }
  }

  total += current;
  return found ? total : null;
}

//
// ======================================================================
// 🧠 CATEGORIAS (OBRIGATÓRIAS)
// ======================================================================
//

const CATEGORY_TREE = {
  expense: [
    {
      group: "Moradia",
      items: [
        { name: "Aluguel", keywords: ["aluguel"] },
        { name: "Financiamento / Prestação", keywords: ["financiamento", "prestação"] },
        { name: "Condomínio", keywords: ["condomínio"] },
        { name: "IPTU", keywords: ["iptu"] },
        { name: "Reformas e manutenção", keywords: ["reforma", "obra", "manutenção"] },
        { name: "Limpeza da casa", keywords: ["limpeza"] },
        { name: "Mobília e decoração", keywords: ["sofá", "cadeira", "mesa", "cama"] },
        { name: "Serviços domésticos", keywords: ["faxina", "diarista"] }
      ]
    },
    {
      group: "Alimentação",
      items: [
        { name: "Supermercado", keywords: ["mercado"] },
        { name: "Açougue / Peixaria", keywords: ["açougue", "peixe"] },
        { name: "Hortifruti", keywords: ["feira"] },
        { name: "Padaria", keywords: ["padaria", "pão"] },
        { name: "Delivery", keywords: ["delivery", "ifood"] },
        { name: "Restaurante / Lanches fora", keywords: ["restaurante", "almoço", "jantar", "lanche"] }
      ]
    },
    {
      group: "Outros",
      items: [{ name: "Outros", keywords: [] }]
    }
  ],

  income: [
    {
      group: "Receita",
      items: [
        { name: "Salário", keywords: ["salário"] },
        { name: "Extra", keywords: ["extra"] },
        { name: "Freelancer", keywords: ["freelancer"] },
        { name: "Venda", keywords: ["venda"] },
        { name: "Empréstimo", keywords: ["empréstimo"] },
        { name: "Juros", keywords: ["juros"] },
        { name: "Benefícios", keywords: ["benefício"] },
        { name: "Lanche Escolar", keywords: ["lanche escolar"] }
      ]
    }
  ]
};

function findBestCategory(text, type = "expense") {
  const list = CATEGORY_TREE[type] || [];
  let best = null;
  let bestScore = 0;
  const clean = text.toLowerCase();

  for (const group of list) {
    for (const item of group.items) {
      let score = 0;
      if (clean.includes(item.name.toLowerCase())) score += 50;
      for (const kw of item.keywords) {
        if (clean.includes(kw)) score += 30;
      }
      if (score > bestScore) {
        bestScore = score;
        best = `${group.group} / ${item.name}`;
      }
    }
  }

  if (!best && type === "expense") return "Outros / Outros";
  if (!best && type === "income") return "Receita / Extra";

  return best;
}

//
// ======================================================================
// 📝 DESCRIÇÃO INTELIGENTE
// ======================================================================
//

function inferDescription(msg, category) {
  if (category && category.includes("/")) {
    return category.split("/")[1].trim();
  }

  let text = msg
    .replace(/(paguei|gastei|comprei|recebi|ganhei|entrou)/gi, "")
    .replace(/\d+[.,]?\d*/g, "")
    .trim();

  return text
    ? text.charAt(0).toUpperCase() + text.slice(1)
    : "Lançamento";
}

//
// ======================================================================
// 📦 CONFIRMAÇÃO
// ======================================================================
//

function formatConfirmation(data) {
  const today = new Date().toLocaleDateString("pt-BR");
  return `🔴 ${data.type === "income" ? "Receita" : "Despesa"} | 📅 Variável
💰 Valor: R$ ${data.amount.toFixed(2)}
📝 Descrição: ${data.description}
📁 Categoria: ${data.category_name}
_${today}_

Confirma o lançamento? (Sim/Não)`;
}

//
// ======================================================================
// 🧠 EXTRAÇÃO DE TRANSAÇÃO
// ======================================================================
//

function extractTransaction(msg) {
  const type = /(recebi|ganhei|salário|venda)/i.test(msg)
    ? "income"
    : "expense";

  const numericMatch = msg.match(/(\d+[.,]?\d*)/);
  let amount = numericMatch
    ? Number(numericMatch[1].replace(",", "."))
    : parseNumberFromTextPT(msg);

  const category = findBestCategory(msg, type);
  const description = inferDescription(msg, category);

  if (!amount) {
    return {
      needsMoreInfo: true,
      missingField: "amount",
      reply: `Qual o valor de *${description}*? 💰`,
      partial: { type, description, category_name: category }
    };
  }

  return {
    needsMoreInfo: false,
    fullData: {
      type,
      amount,
      description,
      category_name: category,
      frequency: "variable"
    },
    confirmation: formatConfirmation({
      type,
      amount,
      description,
      category_name: category
    })
  };
}

//
// ======================================================================
// 🎯 INTENÇÃO
// ======================================================================
//

function detectIntent(msg) {
  if (/^(sim|ok|confirmo)$/i.test(msg)) return "confirm";
  if (/^(não|nao|cancelar)$/i.test(msg)) return "cancel";
  return "transaction";
}

//
// ======================================================================
// 🚀 HANDLER PRINCIPAL
// ======================================================================
//

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, context } = req.body;
    globalContext = context || {};
    const pending = context?.pending_transaction || null;
    const msg = message.toLowerCase().trim();

    if (pending) {
      const intent = detectIntent(msg);

      if (intent === "confirm") {
        return res.status(200).json({
          reply: "Registrado com sucesso ✅",
          action: "success",
          data: pending
        });
      }

      if (intent === "cancel") {
        return res.status(200).json({
          reply: "Transação cancelada ❌",
          action: "cancelled"
        });
      }
    }

    const parsed = extractTransaction(msg);

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
    console.error(err);
    return res.status(500).json({
      reply: "Erro interno 😕",
      action: "error"
    });
  }
}
