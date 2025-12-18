// /api/chat.js — Family Finance IA
// VERSÃO FINAL 2025 (SEM SDK)
// ✔ fetch nativo
// ✔ Regras locais + IA
// ✔ Retry / Timeout
// ✔ Categoria obrigatória
// ✔ Descrição inteligente

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
// 🧠 CATEGORIAS (FONTE DA VERDADE)
// ======================================================================
//

const ALL_CATEGORIES = {
  expense: [
    "Moradia / Aluguel",
    "Moradia / Financiamento / Prestação",
    "Moradia / Condomínio",
    "Moradia / IPTU",
    "Moradia / Reformas e manutenção",
    "Moradia / Limpeza da casa",
    "Moradia / Mobília e decoração",
    "Moradia / Serviços domésticos",

    "Alimentação / Supermercado",
    "Alimentação / Açougue / Peixaria",
    "Alimentação / Hortifruti",
    "Alimentação / Padaria",
    "Alimentação / Delivery",
    "Alimentação / Restaurante / Lanches fora",

    "Transporte / Combustível",
    "Transporte / Ônibus / Trem / Metrô",
    "Transporte / Uber / 99",
    "Transporte / Estacionamento",

    "Contas Mensais / Energia",
    "Contas Mensais / Água",
    "Contas Mensais / Gás",
    "Contas Mensais / Internet",

    "Mercado & Casa / Utensílios domésticos",
    "Mercado & Casa / Produtos de limpeza",

    "Outros / Outros"
  ],

  income: [
    "Receita / Salário",
    "Receita / Extra",
    "Receita / Freelancer",
    "Receita / Venda",
    "Receita / Benefícios"
  ]
};

//
// ======================================================================
// 🧩 CLASSIFICAÇÃO LOCAL (RÁPIDA)
// ======================================================================
//

function findBestCategoryLocal(text, type) {
  const t = text.toLowerCase();

  if (type === "income") {
    if (/sal[aá]rio|pagamento/.test(t)) return "Receita / Salário";
    if (/freelancer/.test(t)) return "Receita / Freelancer";
    if (/venda/.test(t)) return "Receita / Venda";
    return "Receita / Extra";
  }

  if (/aluguel/.test(t)) return "Moradia / Aluguel";
  if (/iptu/.test(t)) return "Moradia / IPTU";
  if (/luz|energia/.test(t)) return "Contas Mensais / Energia";
  if (/água/.test(t)) return "Contas Mensais / Água";
  if (/gás/.test(t)) return "Contas Mensais / Gás";
  if (/internet/.test(t)) return "Contas Mensais / Internet";
  if (/uber|99/.test(t)) return "Transporte / Uber / 99";
  if (/faca|garfo|panela|prato|copo/.test(t))
    return "Mercado & Casa / Utensílios domésticos";

  return "Outros / Outros";
}

//
// ======================================================================
// 🤖 CHAMADA OPENAI (FETCH NATIVO)
// ======================================================================
//

async function callOpenAI(prompt, signal) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    }),
    signal
  });

  if (!response.ok) {
    throw new Error("OpenAI API error");
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function classifyWithAI(text, type) {
  const categories = ALL_CATEGORIES[type];

  const prompt = `
Classifique a frase abaixo em UMA das categorias listadas.
Responda SOMENTE com o texto EXATO da categoria.
Não explique.

Frase:
"${text}"

Categorias:
${categories.map(c => "- " + c).join("\n")}
`.trim();

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const result = await callOpenAI(prompt, controller.signal);

      clearTimeout(timeout);

      if (categories.includes(result)) return result;

      return type === "expense" ? "Outros / Outros" : "Receita / Extra";
    } catch (err) {
      if (attempt === maxAttempts) {
        return type === "expense" ? "Outros / Outros" : "Receita / Extra";
      }
      await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }

  return type === "expense" ? "Outros / Outros" : "Receita / Extra";
}

//
// ======================================================================
// 📝 DESCRIÇÃO INTELIGENTE
// ======================================================================
//

function inferDescription(msg, category) {
  if (category && !category.includes("Outros")) {
    return category.split("/")[1].trim();
  }

  let text = msg
    .replace(/(paguei|gastei|comprei|recebi|ganhei|entrou)/gi, "")
    .replace(/\d+[.,]?\d*/g, "");

  Object.keys(NUMBER_WORDS).forEach(w => {
    text = text.replace(new RegExp(`\\b${w}\\b`, "gi"), "");
  });

  text = text.replace(/\b(por|reais|real|com|de|uma|um|uns|umas)\b/gi, "");
  text = text.replace(/\s+/g, " ").trim();

  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Lançamento";
}

//
// ======================================================================
// 📦 EXTRAÇÃO
// ======================================================================
//

async function extractTransaction(msg) {
  const type = /(recebi|ganhei|sal[aá]rio|venda|freelancer)/i.test(msg)
    ? "income"
    : "expense";

  const numeric = msg.match(/(\d+[.,]?\d*)/);
  const amount = numeric
    ? Number(numeric[1].replace(",", "."))
    : parseNumberFromTextPT(msg);

  let category = findBestCategoryLocal(msg, type);

  if (category === "Outros / Outros") {
    category = await classifyWithAI(msg, type);
  }

  const description = inferDescription(msg, category);

  if (!amount) {
    return {
      needsMoreInfo: true,
      reply: `Qual o valor de *${description}*? 💰`,
      partial: { type, description, category_name: category }
    };
  }

  return {
    needsMoreInfo: false,
    data: {
      type,
      amount,
      description,
      category_name: category,
      frequency: "variable"
    }
  };
}

//
// ======================================================================
// 🚀 HANDLER
// ======================================================================
//

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body;
    const msg = message.toLowerCase().trim();

    const parsed = await extractTransaction(msg);

    if (parsed.needsMoreInfo) {
      return res.status(200).json({
        reply: parsed.reply,
        action: "need_more_info",
        data: parsed.partial
      });
    }

    return res.status(200).json({
      reply: `🔴 ${parsed.data.type === "income" ? "Receita" : "Despesa"}
💰 Valor: R$ ${parsed.data.amount.toFixed(2)}
📝 Descrição: ${parsed.data.description}
📁 Categoria: ${parsed.data.category_name}

Confirma o lançamento? (Sim/Não)`,
      action: "awaiting_confirmation",
      data: parsed.data
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      reply: "Serviço temporariamente indisponível 😕",
      action: "error"
    });
  }
}
