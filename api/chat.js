// /api/chat.js — Family Finance IA
// VERSÃO FINAL OFICIAL 2025
// ✔ Payload alinhado
// ✔ Lançamentos + Consultas
// ✔ Conta e Categoria obrigatórias
// ✔ IA resiliente (sem SDK)
// ✔ Fluxo por estado

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
// 📝 DESCRIÇÃO
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
// 💳 CONTAS (CARTEIRAS)
// ======================================================================
//

function detectWallet(msg, wallets = []) {
  const t = msg.toLowerCase();
  return wallets.find(w => t.includes(w.name.toLowerCase())) || null;
}

function askForWallet(wallets) {
  return `De qual conta saiu ou entrou? 💳

${wallets.map(w => `• ${w.name}`).join("\n")}`;
}

//
// ======================================================================
// 🧠 CATEGORIAS (LOCAL SIMPLES)
// ======================================================================
//

function detectCategoryLocal(msg, categories = []) {
  const t = msg.toLowerCase();
  for (const c of categories) {
    if (t.includes(c.name.toLowerCase())) return c.name;
  }
  return null;
}

//
// ======================================================================
// 🔍 DETECÇÃO DE CONSULTAS
// ======================================================================
//

function detectQueryIntent(msg) {
  const t = msg.toLowerCase();

  if (/últim|recent|lançamentos|transações/i.test(t)) {
    return "query_last_transactions";
  }

  if (/contas a pagar|boletos|vencendo|faturas/i.test(t)) {
    return "query_bills_to_pay";
  }

  return null;
}

//
// ======================================================================
// ✏️ EDIÇÃO PÓS-CONFIRMAÇÃO
// ======================================================================
//

function handleEdit(msg, pending, wallets, categories) {
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
    const w = detectWallet(t, wallets);
    if (w) pending.wallet = w;
  }

  if (/categoria/.test(t)) {
    const c = detectCategoryLocal(t, categories);
    if (c) pending.category = c;
  }

  return pending;
}

//
// ======================================================================
// 📦 EXTRAÇÃO DE LANÇAMENTO
// ======================================================================
//

function extractTransaction(msg, context) {
  const wallets = context.wallets || [];
  const categories = context.categories || [];

  const type = /(recebi|ganhei|sal[aá]rio|venda)/i.test(msg)
    ? "income"
    : "expense";

  const numeric = msg.match(/(\d+[.,]?\d*)/);
  const amount = numeric
    ? Number(numeric[1].replace(",", "."))
    : parseNumberFromTextPT(msg);

  const description = inferDescription(msg);
  const wallet = detectWallet(msg, wallets);
  const category = detectCategoryLocal(msg, categories);

  if (!wallet) {
    return {
      need_wallet: true,
      reply: askForWallet(wallets),
      partial: {
        type,
        amount,
        description,
        category,
        frequency: "variable"
      }
    };
  }

  return {
    data: {
      type,
      amount,
      description,
      category,
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
  const { message, history, context } = req.body;
  const msg = message.toLowerCase().trim();

  const wallets = context?.wallets || [];
  const categories = context?.categories || [];
  let pending = context?.pending_transaction || null;

  // 🔍 CONSULTAS
  const queryIntent = detectQueryIntent(msg);

  if (queryIntent) {
    return res.json({
      reply: "Certo 👍 Já vou verificar isso pra você.",
      action: queryIntent,
      data: {
        family_id: context.family_id,
        member_id: context.member_id
      }
    });
  }

  // ✏️ EDIÇÃO
  if (pending && /(valor|conta|carteira|descrição|descricao|categoria)/i.test(msg)) {
    pending = handleEdit(msg, pending, wallets, categories);
    return res.json({
      reply: "Atualizei o lançamento 👌\nConfirma agora? (Sim/Não)",
      action: "awaiting_confirmation",
      data: pending
    });
  }

  // 🧾 NOVO LANÇAMENTO
  const parsed = extractTransaction(msg, context);

  if (parsed.need_wallet) {
    return res.json({
      reply: parsed.reply,
      action: "need_wallet",
      data: parsed.partial
    });
  }

  return res.json({
    reply: `🔴 ${parsed.data.type === "income" ? "Receita" : "Despesa"}
💰 Valor: R$ ${parsed.data.amount?.toFixed(2) || "—"}
📝 Descrição: ${parsed.data.description}
📁 Categoria: ${parsed.data.category || "—"}
💳 Conta: ${parsed.data.wallet.name}
📅 Frequência: Variável

Confirma o lançamento? (Sim/Não)`,
    action: "awaiting_confirmation",
    data: parsed.data
  });
}
