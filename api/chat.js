// /Funcionando com alguns problemas, MESa chama resumo, não pergunta conta, não altera

const TZ = "America/Sao_Paulo";

// ======================================================================
// Helpers
// ======================================================================

function ok(res, payload) {
  return res.status(200).json(payload);
}

function removeDiacritics(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function norm(s = "") {
  return removeDiacritics(String(s).toLowerCase().trim());
}

function formatDateBR(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ }).format(date);
}

function formatAmount2(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

// ======================================================================
// 🔢 NÚMEROS POR EXTENSO (PT-BR)
// ======================================================================

const NUMBER_WORDS = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
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
  quatorze: 14,
  catorze: 14,
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
  const t = norm(text).replace(/[^\p{L}\p{N}\s-]/gu, " ");
  const words = t.split(/\s+/).filter(Boolean);

  let total = 0;
  let current = 0;
  let found = false;

  for (const w of words) {
    if (w === "e") continue;

    const value = NUMBER_WORDS[w];
    if (value !== undefined) {
      found = true;

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

// Tenta capturar números digitados (inclui 1.234,56) e fallback por extenso
function parseAmount(text) {
  const raw = String(text || "");

  // Captura: 100 | 100,5 | 100.50 | 1.234,56 | 1234,56
  const m = raw.match(
    /(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|-?\d+(?:[.,]\d{1,2})?)/i
  );

  if (m && m[1]) {
    let s = m[1];

    if (s.includes(".") && s.includes(",")) {
      // 1.234,56 -> 1234.56
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",") && !s.includes(".")) {
      // 1234,56 -> 1234.56
      s = s.replace(",", ".");
    }

    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }

  return parseNumberFromTextPT(raw);
}

// ======================================================================
// 🧠 CATEGORIAS (FONTE DA VERDADE)
// ======================================================================

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

// ======================================================================
// 🧩 CLASSIFICAÇÃO LOCAL (RÁPIDA)
// ======================================================================

function findBestCategoryLocal(text, type) {
  const t = norm(text);

  if (type === "income") {
    if (/salario|pagamento/.test(t)) return "Receita / Salário";
    if (/freelancer|freela|job/.test(t)) return "Receita / Freelancer";
    if (/venda|vendi/.test(t)) return "Receita / Venda";
    if (/beneficio|benefícios|beneficios|vale/.test(t)) return "Receita / Benefícios";
    return "Receita / Extra";
  }

  if (/aluguel/.test(t)) return "Moradia / Aluguel";
  if (/iptu/.test(t)) return "Moradia / IPTU";
  if (/luz|energia/.test(t)) return "Contas Mensais / Energia";
  if (/agua/.test(t)) return "Contas Mensais / Água";
  if (/gas/.test(t)) return "Contas Mensais / Gás";
  if (/internet|wifi/.test(t)) return "Contas Mensais / Internet";
  if (/uber|99/.test(t)) return "Transporte / Uber / 99";
  if (/estacionamento/.test(t)) return "Transporte / Estacionamento";
  if (/mercado|supermercado/.test(t)) return "Alimentação / Supermercado";
  if (/delivery|ifood/.test(t)) return "Alimentação / Delivery";
  if (/padaria/.test(t)) return "Alimentação / Padaria";
  if (/acougue|açougue|peixaria/.test(t)) return "Alimentação / Açougue / Peixaria";
  if (/hortifruti/.test(t)) return "Alimentação / Hortifruti";
  if (/restaurante|lanche|lanches|pizza|hamburguer|hambúrguer/.test(t))
    return "Alimentação / Restaurante / Lanches fora";
  if (/combustivel|combustível|gasolina|etanol|diesel/.test(t)) return "Transporte / Combustível";
  if (/onibus|ônibus|trem|metro|metrô/.test(t)) return "Transporte / Ônibus / Trem / Metrô";
  if (/faca|garfo|panela|prato|copo|talher|utensilio|utensílio/.test(t))
    return "Mercado & Casa / Utensílios domésticos";
  if (/detergente|sabao|sabão|amaciante|alvejante|limpeza/.test(t))
    return "Mercado & Casa / Produtos de limpeza";

  return "Outros / Outros";
}

// ======================================================================
// 🤖 OPENAI (FETCH NATIVO) — com timeout
// ======================================================================

async function callOpenAI(prompt, signal) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    }),
    signal
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    throw new Error(`OpenAI API error (${response.status}): ${txt.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta OpenAI vazia.");
  return String(content).trim();
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

      const resultRaw = await callOpenAI(prompt, controller.signal);

      clearTimeout(timeout);

      const result = resultRaw
        .replace(/^[-–•]\s*/g, "")
        .replace(/^"+|"+$/g, "")
        .trim();

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

// ======================================================================
// 📝 DESCRIÇÃO ESPECÍFICA (MANTÉM O QUE TIVER NA MENSAGEM)
// - Receita: "Base / Subtipo" (ex: "Uber / Extra")
// - Despesa: "Base" (ex: "Uber", "Cadeira", "Conta de Luz")
// ======================================================================

const STOPWORDS = new Set([
  "por",
  "reais",
  "real",
  "com",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "no",
  "na",
  "nos",
  "nas",
  "um",
  "uma",
  "uns",
  "umas",
  "e",
  "a",
  "o",
  "as",
  "os",
  "para",
  "pra",
  "pro",
  "em"
]);

const VERBS_RE =
  /\b(paguei|gastei|comprei|recebi|ganhei|entrou|pagar|gastar|comprar|receber|ganhar|entrar)\b/gi;

function toTitleCase(str) {
  return String(str || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Extrai o mais específico possível da mensagem.
 * Estratégia:
 * 1) Se tiver "de/do/da" -> pega até 3 palavras após (uber, uber eats, etc.)
 * 2) Senão -> limpa verbos/valores e pega até 4 tokens relevantes
 */
function extractSpecificFromMessage(msg) {
  const raw = norm(msg);

  // 1) captura "de/do/da" + até 3 palavras
  const after = raw.match(/\b(?:de|do|da)\s+([a-z0-9-]+)(?:\s+([a-z0-9-]+))?(?:\s+([a-z0-9-]+))?/i);
  if (after && (after[1] || after[2] || after[3])) {
    const picked = [after[1], after[2], after[3]]
      .filter(Boolean)
      .filter(w => !STOPWORDS.has(w))
      .slice(0, 3)
      .join(" ");
    if (picked) return toTitleCase(picked);
  }

  // 2) fallback: limpeza geral
  let text = raw;

  text = text.replace(VERBS_RE, " ");

  // remove valores digitados
  text = text.replace(/(?:r\$\s*)?-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})/gi, " ");
  text = text.replace(/(?:r\$\s*)?-?\d+(?:[.,]\d{1,2})?/gi, " ");

  // remove números por extenso
  Object.keys(NUMBER_WORDS).forEach(w => {
    const ww = norm(w);
    text = text.replace(new RegExp(`\\b${ww}\\b`, "g"), " ");
  });

  // limpa pontuação
  text = text.replace(/[^\p{L}\p{N}\s-]/gu, " ");

  const tokens = text
    .split(/\s+/)
    .map(t => t.trim())
    .filter(Boolean)
    .filter(t => !STOPWORDS.has(t))
    .filter(t => t.length >= 2);

  const base = tokens.slice(0, 4).join(" ");
  return base ? toTitleCase(base) : "";
}

function inferDescription(msg, category, type) {
  const base = extractSpecificFromMessage(msg);

  if (base) {
    if (type === "income") {
      const subtype = String(category || "").split("/")[1]?.trim() || "Extra";

      // evita duplicar: "Freelancer / Freelancer"
      const baseNorm = norm(base);
      const subNorm = norm(subtype);
      if (subNorm && baseNorm.includes(subNorm)) return base;

      return `${base} / ${subtype}`;
    }
    return base;
  }

  // fallback: se não deu pra extrair do texto, usa a categoria (filho)
  if (category && !String(category).includes("Outros")) {
    const parts = String(category).split("/").map(p => p.trim()).filter(Boolean);
    return parts.slice(1).join(" / ") || "Lançamento";
  }

  return "Lançamento";
}

// ======================================================================
// 📦 EXTRAÇÃO (NUNCA quebra por erro de IA)
// ======================================================================

async function extractTransaction(rawMsg) {
  const msg = String(rawMsg || "").trim();
  const t = norm(msg);

  const type = /(recebi|ganhei|salario|venda|vendi|freelancer|freela|entrou)/i.test(t)
    ? "income"
    : "expense";

  const amount = parseAmount(msg);

  let category = findBestCategoryLocal(msg, type);

  // IA somente quando local não resolveu
  if (category === "Outros / Outros") {
    category = await classifyWithAI(msg, type);
  }

  const description = inferDescription(msg, category, type);

  if (!Number.isFinite(amount) || amount === null || amount === 0) {
    return {
      needsMoreInfo: true,
      reply: `Qual o valor de *${description}*? 💰`,
      partial: { type, description, category_name: category, frequency: "variable" }
    };
  }

  return {
    needsMoreInfo: false,
    data: {
      type,
      amount: Number(amount),
      description,
      category_name: category,
      frequency: "variable"
    }
  };
}

// ======================================================================
// 🧾 CONFIRMAÇÃO — FORMATO SOLICITADO
// ======================================================================

function buildConfirmationReply(data) {
  const isIncome = data.type === "income";
  const emoji = isIncome ? "🟢" : "🔴";
  const label = isIncome ? "Receita" : "Despesa";
  const date = formatDateBR(new Date());

  return `${emoji} ${label}  |  Variável
💰 Valor: R$ ${formatAmount2(data.amount)}
📝 Descrição: ${data.description}
📁 Categoria: ${data.category_name}
${date}

Confirma o lançamento? (Sim/Não)`;
}

// ======================================================================
// 🚀 HANDLER
// ======================================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const rawMessage = String(req.body?.message || "").trim();

    if (!rawMessage) {
      return ok(res, {
        action: "need_more_info",
        reply: "Envie uma mensagem com o lançamento. Ex: “Paguei 50 no mercado”",
        data: null
      });
    }

    const parsed = await extractTransaction(rawMessage);

    if (parsed.needsMoreInfo) {
      return ok(res, {
        reply: parsed.reply,
        action: "need_more_info",
        data: parsed.partial
      });
    }

    return ok(res, {
      reply: buildConfirmationReply(parsed.data),
      action: "awaiting_confirmation",
      data: parsed.data
    });
  } catch (err) {
    console.error(err);

    // Nunca explode o WhatsApp por erro interno
    return ok(res, {
      reply: "Serviço temporariamente indisponível 😕",
      action: "error"
    });
  }
}
