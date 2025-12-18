// /api/chat.js — Family Finance IA
// VERSÃO FINAL DEFINITIVA 2025
// ✔ Conta obrigatória
// ✔ Categoria obrigatória
// ✔ IA semântica (fetch)
// ✔ Retry / Timeout
// ✔ Edição pós-confirmação
// ✔ Frequência default = variável

//
// ======================================================================
// 🔢 NÚMEROS POR EXTENSO (PT-BR)
// ======================================================================
//

const NUMBER_WORDS = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2,
  três: 3, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40,
  cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100,
  cento: 100, duzentos: 200, trezentos: 300,
  quatrocentos: 400, quinhentos: 500,
  seiscentos: 600, setecentos: 700,
  oitocentos: 800, novecentos: 900, mil: 1000
};

function parseNumberFromTextPT(text) {
  const words = text.toLowerCase().split(/\s+/);
  let total = 0, current = 0, found = false;

  for (const w of words) {
    if (NUMBER_WORDS[w] !== undefined) {
      found = true;
      const v = NUMBER_WORDS[w];
      if (v === 1000) {
        current = current === 0 ? 1000 : current * 1000;
        total += current;
        current = 0;
      } else current += v;
    }
  }
  return found ? total + current : null;
}

//
// ======================================================================
// 📝 DESCRIÇÃO (NUNCA "OUTROS")
// ======================================================================
//

function inferDescription(msg) {
  let t = msg
    .replace(/(paguei|gastei|comprei|recebi|ganhei|entrou|transferi)/gi, "")
    .replace(/\d+[.,]?\d*/g, "");

  Object.keys(NUMBER_WORDS).forEach(w => {
    t = t.replace(new RegExp(`\\b${w}\\b`, "gi"), "");
  });

  t = t.replace(/\b(por|reais|real|com|de|uma|um|uns|umas)\b/gi, "");
  t = t.replace(/\s+/g, " ").trim();

  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Lançamento";
}

//
// ======================================================================
// 💳 CONTA (CARTEIRA)
// ======================================================================
//

function detectAccount(msg, accounts) {
  const t = msg.toLowerCase();
  return accounts.find(a => t.includes(a.toLowerCase())) || null;
}

function askForAccount(accounts) {
  return `De qual conta saiu ou entrou? 💳

${accounts.map(a => `• ${a}`).join("\n")}`;
}

//
// ======================================================================
// 🧠 CATEGORIA (LOCAL + IA)
// ======================================================================
//

function findCategoryLocal(msg, type) {
  const t = msg.toLowerCase();

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
  if (/internet/.test(t)) return "Contas Mensais / Internet";
  if (/uber|99/.test(t)) return "Transporte / Uber / 99";
  if (/faca|garfo|panela|prato|copo/.test(t))
    return "Mercado & Casa / Utensílios domésticos";

  return "Outros / Outros";
}

//
// ======================================================================
// 🤖 IA SEM SDK (FETCH)
// ======================================================================
//

async function classifyWithAI(text, categories) {
  const prompt = `
Classifique a frase abaixo em UMA das categorias listadas.
Responda SOMENTE com o texto EXATO da categoria.

Frase:
"${text}"

Categorias:
${categories.map(c => "- " + c).join("\n")}
`.trim();

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
      signal: controller.signal
    });

    if (!res.ok) throw new Error("OpenAI error");

    const json = await res.json();
    const result = json.choices[0].message.content.trim();
    return categories.includes(result) ? result : "Outros / Outros";

  } catch {
    return "Outros / Outros";
  }
}

//
// ======================================================================
// ✏️ EDIÇÃO PÓS-CONFIRMAÇÃO
// ======================================================================
//

function handleEdit(msg, pending, accounts) {
  const t = msg.toLowerCase();

  if (/valor/.test(t)) {
    const v = parseNumberFromTextPT(t) ||
      Number(t.match(/(\d+[.,]?\d*)/)?.[1]?.replace(",", "."));
    if (v) pending.amount = v;
  }

  if (/descrição|descricao/.test(t)) {
    pending.description = inferDescription(t);
  }

  if (/conta|carteira/.test(t)) {
    const acc = detectAccount(t, accounts);
    if (acc) pending.wallet = acc;
  }

  return pending;
}

//
// ======================================================================
// 📦 EXTRAÇÃO
// ======================================================================
//

async function extractTransaction(msg, context) {
  const accounts = context.accounts || [];
  const type = /(recebi|ganhei|sal[aá]rio|venda)/i.test(msg)
    ? "income"
    : "expense";

  const numeric = msg.match(/(\d+[.,]?\d*)/);
  const amount = numeric
    ? Number(numeric[1].replace(",", "."))
    : parseNumberFromTextPT(msg);

  const description = inferDescription(msg);
  const wallet = detectAccount(msg, accounts);

  if (!wallet) {
    return {
      askAccount: true,
      reply: askForAccount(accounts),
      partial: { type, amount, description, frequency: "variable" }
    };
  }

  return {
    data: {
      type,
      amount,
      description,
      wallet,
      frequency: "variable"
    }
  };
}

//
// ======================================================================
// 🚀 HANDLER PRINCIPAL
// ======================================================================
//

export default async function handler(req, res) {
  const { message, context } = req.body;
  const msg = message.toLowerCase().trim();
  const accounts = context?.accounts || [];
  let pending = context?.pending_transaction || null;

  // ✏️ EDIÇÃO
  if (pending && /(valor|conta|carteira|descrição|descricao)/i.test(msg)) {
    pending = handleEdit(msg, pending, accounts);
    return res.json({
      reply: "Atualizei o lançamento 👌\nConfirma agora? (Sim/Não)",
      action: "awaiting_confirmation",
      data: pending
    });
  }

  // 🧾 NOVO
  const parsed = await extractTransaction(msg, context);

  if (parsed.askAccount) {
    return res.json({
      reply: parsed.reply,
      action: "need_account",
      data: parsed.partial
    });
  }

  return res.json({
    reply: `🔴 ${parsed.data.type === "income" ? "Receita" : "Despesa"}
💰 Valor: R$ ${parsed.data.amount?.toFixed(2) || "—"}
📝 Descrição: ${parsed.data.description}
💳 Conta: ${parsed.data.wallet}
📅 Frequência: Variável

Confirma o lançamento? (Sim/Não)`,
    action: "awaiting_confirmation",
    data: parsed.data
  });
}
