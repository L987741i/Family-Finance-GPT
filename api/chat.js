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

function formatBRL(value) {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  } catch {
    return `R$ ${Number(value || 0).toFixed(2)}`;
  }
}

function todayISO() {
  const dt = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dt);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function yesterdayISO() {
  const now = new Date();
  const partsNow = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const y = Number(partsNow.find((p) => p.type === "year")?.value);
  const m = Number(partsNow.find((p) => p.type === "month")?.value);
  const d = Number(partsNow.find((p) => p.type === "day")?.value);

  const local = new Date(Date.UTC(y, m - 1, d));
  local.setUTCDate(local.getUTCDate() - 1);

  const yy = local.getUTCFullYear();
  const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(local.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function detectDate(msg) {
  const t = norm(msg);
  if (t.includes("ontem")) return yesterdayISO();
  return todayISO();
}

function clampPositiveNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.abs(v);
}

// ======================================================================
// Número por extenso PT-BR
// ======================================================================

const NUMBER_WORDS = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2,
  tres: 3, três: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15,
  dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
  sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, trezentos: 300,
  quatrocentos: 400, quinhentos: 500, seiscentos: 600,
  setecentos: 700, oitocentos: 800, novecentos: 900,
  mil: 1000
};

function parseNumberFromTextPT(text) {
  const words = norm(text).split(/\s+/);
  let total = 0, current = 0, found = false;

  for (const w of words) {
    if (NUMBER_WORDS[w] !== undefined) {
      found = true;
      const v = NUMBER_WORDS[w];
      if (v === 1000) {
        current = current === 0 ? 1000 : current * 1000;
        total += current;
        current = 0;
      } else {
        current += v;
      }
    }
  }
  return found ? total + current : null;
}

function extractAmount(msg) {
  const s = String(msg || "");
  const numeric = s.match(/(\d+[.,]?\d*)/);
  if (numeric) return clampPositiveNumber(Number(numeric[1].replace(",", ".")));
  return clampPositiveNumber(parseNumberFromTextPT(s));
}

// ======================================================================
// Name (garantia NOT NULL)
// ======================================================================

function inferNameFromMessage(original) {
  let t = norm(original);

  t = t.replace(/\b(gastei|paguei|comprei|recebi|ganhei|entrou|saiu|transferi|pix|pague)\b/g, "");
  t = t.replace(/\b(no|na|em|com|de|para|por|reais|real|r\$)\b/g, "");
  t = t.replace(/\d+[.,]?\d*/g, "");

  Object.keys(NUMBER_WORDS).forEach((w) => {
    t = t.replace(new RegExp(`\\b${w}\\b`, "g"), "");
  });

  t = t.replace(/\s+/g, " ").trim();
  if (!t) return "Lançamento";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ======================================================================
// Categorias (IA via Responses API)
// ======================================================================

async function classifyCategoryAI({ text, type, categories }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const typed = categories.filter((c) => norm(c.type) === norm(type));
  if (!typed.length) return null;

  const names = typed.map((c) => c.name).slice(0, 250);

  const prompt = `
Escolha UMA categoria da lista abaixo (exatamente como está escrito).
Regras:
- Não invente categorias
- Responda APENAS com o NOME da categoria

Tipo: ${type}
Texto: "${text}"

Categorias:
${names.map((n) => `- ${n}`).join("\n")}
`.trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: prompt,
        temperature: 0,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) return null;

    const json = await resp.json();
    const pick =
      json?.output?.[0]?.content?.[0]?.text?.trim() || "";

    return typed.find((c) => norm(c.name) === norm(pick)) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ======================================================================
// Handler
// ======================================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return ok(res, { reply: "Método não permitido.", action: "message" });
  }

  try {
    const { message, context } = req.body || {};
    const msg = String(message || "").trim();
    const ctx = context || {};

    const type = /(recebi|ganhei|salario|salário)/i.test(msg)
      ? "income"
      : "expense";

    const amount = extractAmount(msg);
    if (!amount) {
      return ok(res, { reply: "Qual o valor? 💰", action: "need_more_info" });
    }

    const name = inferNameFromMessage(msg);

    const category = await classifyCategoryAI({
      text: msg,
      type,
      categories: ctx.categories || [],
    });

    return ok(res, {
      reply: "Confirma?",
      action: "awaiting_confirmation",
      data: {
        family_id: ctx.family_id,
        member_id: ctx.member_id,
        type,
        amount,
        name,
        category_id: category?.id || null,
        category_name: category?.name || null,
        date: todayISO(),
      },
    });
  } catch (err) {
    console.error(err);
    return ok(res, {
      reply: "Ops 😅 deu um erro aqui. Tenta de novo?",
      action: "message",
    });
  }
}
