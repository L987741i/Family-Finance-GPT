// /api/chat.js — Family Finance IA (WhatsApp)
// VERSÃO EXTREMAMENTE COMPLETA + FÁCIL DE ENTENDER (2025-12)
// ✅ Registra lançamentos (conta ou cartão)
// ✅ Categoria obrigatória (category_id)
// ✅ Conta/cartão obrigatório conforme payment_method
// ✅ Conversa stateful (NUNCA perde pending_transaction)
// ✅ Consultas do app (saldo / gastos / receitas / últimas transações / contas a pagar)
// ✅ Respostas curtas e humanas
// ✅ Sem SDK (OpenAI via fetch opcional, com fallback)

const TZ = "America/Sao_Paulo";

// ======================================================================
// 🔧 Utilidades básicas
// ======================================================================

function ok(res, payload) {
  return res.status(200).json(payload);
}

function norm(s = "") {
  return removeDiacritics(String(s).toLowerCase().trim());
}

function removeDiacritics(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function todayISO() {
  // Data local São Paulo (YYYY-MM-DD)
  const dt = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dt);

  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const d = parts.find(p => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function yesterdayISO() {
  const now = new Date();
  // converte “agora” pra SP e subtrai 1 dia com segurança
  const spNow = new Date(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit" }).format(now)
  );
  spNow.setDate(spNow.getDate() - 1);

  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(spNow);

  const y = parts.find(p => p.type === "year")?.value;
  const m = parts.find(p => p.type === "month")?.value;
  const d = parts.find(p => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function formatBRL(value) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  } catch {
    return `R$ ${Number(value || 0).toFixed(2)}`;
  }
}

function clampPositiveNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.abs(v);
}

function buildIdempotencyKey(ctx, t) {
  // Evita duplicidade no backend (opcional no schema)
  const base = [
    ctx?.family_id || "",
    ctx?.member_id || "",
    t?.date || "",
    t?.type || "",
    t?.payment_method || "",
    t?.account_id || "",
    t?.card_id || "",
    String(t?.amount ?? ""),
    t?.name || "",
  ].join("|");
  // hash simples (sem libs)
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  return `wpp_${h}`;
}

// ======================================================================
// 🔢 Números por extenso (PT-BR) + números digitados
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
  const m = String(msg || "");
  const numeric = m.match(/(\d+[.,]?\d*)/);
  if (numeric) {
    const v = Number(numeric[1].replace(",", "."));
    return clampPositiveNumber(v);
  }
  const ext = parseNumberFromTextPT(m);
  return clampPositiveNumber(ext);
}

// ======================================================================
// 📝 Descrição / name (sempre obrigatório no banco)
// ======================================================================

function inferNameFromMessage(original) {
  let t = norm(original);

  // remove verbos de ação
  t = t.replace(/\b(gastei|paguei|comprei|recebi|ganhei|entrou|saiu|transferi|pix|pague)\b/g, "");

  // remove conectores comuns
  t = t.replace(/\b(no|na|em|com|de|para|por|reais|real|r\$|um|uma|uns|umas)\b/g, "");

  // remove números
  t = t.replace(/\d+[.,]?\d*/g, "");

  // remove números por extenso
  Object.keys(NUMBER_WORDS).forEach(w => {
    t = t.replace(new RegExp(`\\b${w}\\b`, "g"), "");
  });

  // limpeza
  t = t.replace(/\s+/g, " ").trim();

  if (!t) return "Lançamento";
  // capitaliza simples (sem acento já removido no norm)
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ======================================================================
// 💳 Contas (wallets) e Cartões (cards)
// ======================================================================

function findAccountByName(msg, wallets = []) {
  const t = norm(msg);
  return wallets.find(a => t === norm(a.name) || t.includes(norm(a.name))) || null;
}

function findCardByName(msg, cards = []) {
  const t = norm(msg);
  return cards.find(c => t === norm(c.name) || t.includes(norm(c.name))) || null;
}

function askPickAccount(wallets = []) {
  const list = wallets.slice(0, 6).map(w => `• [${w.name}]`).join("\n");
  return `De qual conta saiu ou entrou? 💳\n\n${list || "• (nenhuma conta encontrada)"}`
}

function askPickCard(cards = []) {
  const list = cards.slice(0, 6).map(c => `• [${c.name}]`).join("\n");
  return `Qual cartão foi usado? 💳\n\n${list || "• (nenhum cartão encontrado)"}`
}

// ======================================================================
// 🧾 Categoria obrigatória (category_id)
// ======================================================================

// Fallback de palavras-chave (rápido, sem IA)
const KEYWORD_CATEGORY_HINTS = [
  { kw: ["uber", "99", "taxi", "corrida"], pick: ["uber", "99", "taxi"] },
  { kw: ["gasolina", "posto", "etanol", "diesel", "abasteci"], pick: ["combustivel"] },
  { kw: ["mercado", "supermerc", "carrefour", "assai", "atacadao"], pick: ["supermercado"] },
  { kw: ["ifood", "delivery", "pizza", "hamburg"], pick: ["delivery"] },
  { kw: ["padaria", "pao"], pick: ["padaria"] },
  { kw: ["restaurante", "almoco", "jantar", "lanche"], pick: ["restaurante", "lanches"] },
  { kw: ["luz", "energia", "enel", "light"], pick: ["energia"] },
  { kw: ["agua", "cedae", "sabesp"], pick: ["agua"] },
  { kw: ["internet", "wifi", "claro", "vivo", "oi"], pick: ["internet"] },
  { kw: ["farmacia", "remedio", "drogaria"], pick: ["farmacia"] },
];

function categoriesByType(categories = [], type) {
  return categories.filter(c => norm(c.type) === norm(type));
}

function findCategoryByNameLoose(categories = [], wantedName) {
  const w = norm(wantedName);
  if (!w) return null;

  // match exato por name
  let found = categories.find(c => norm(c.name) === w);
  if (found) return found;

  // match "contém"
  found = categories.find(c => norm(c.name).includes(w));
  if (found) return found;

  return null;
}

function suggestCategoryFromKeywords(categories = [], type, msgOrName) {
  const t = norm(msgOrName);
  const typed = categoriesByType(categories, type);

  for (const rule of KEYWORD_CATEGORY_HINTS) {
    if (rule.kw.some(k => t.includes(norm(k)))) {
      // tenta encontrar subcategoria específica
      for (const p of rule.pick) {
        const c = typed.find(x => norm(x.name).includes(norm(p)));
        if (c) return c;
      }
      // fallback: tenta categoria pai comum
      const commonParents = ["transporte", "alimentacao", "contas mensais", "saude", "moradia", "lazer"];
      for (const cp of commonParents) {
        const c = typed.find(x => norm(x.name) === norm(cp) || norm(x.name).includes(norm(cp)));
        if (c) return c;
      }
    }
  }

  return null;
}

async function classifyCategoryAI({ text, type, categories }) {
  // Usa IA apenas se tiver chave
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const typed = categoriesByType(categories, type);
  if (!typed.length) return null;

  // para WhatsApp, a gente quer ser rápido: manda só nomes
  const categoryNames = typed.map(c => c.name).slice(0, 250);

  const prompt = `
Escolha UMA categoria da lista abaixo (exatamente como está escrito).
Regra: não invente, não explique, responda apenas com o nome da categoria.

Tipo: ${type}
Texto: "${text}"

Categorias:
${categoryNames.map(n => `- ${n}`).join("\n")}
`.trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!resp.ok) return null;

    const json = await resp.json();
    const pick = String(json?.choices?.[0]?.message?.content || "").trim();
    const cat = findCategoryByNameLoose(typed, pick);
    return cat || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function askPickCategory(categories = [], type) {
  const typed = categoriesByType(categories, type);

  // mostra poucas opções pra WhatsApp (curto)
  const sample = typed.slice(0, 8).map(c => `• [${c.name}]`).join("\n");
  return `Qual categoria é essa? 📁\n\n${sample || "• (nenhuma categoria encontrada)"}`
}

// ======================================================================
// 🧠 Intent: confirmar / cancelar / consulta / lançamento / edição
// ======================================================================

function detectIntent(msg) {
  const t = norm(msg);

  if (/^(sim|s|ok|confirmo|confirmar|pode|pode ser)$/.test(t)) return { type: "confirm" };
  if (/^(nao|não|n|cancelar|cancela|esquece)$/.test(t)) return { type: "cancel" };

  // consultas
  if (t.includes("saldo") || t.includes("balance")) return { type: "query_balance" };
  if (t.includes("gastei hoje") || (t.includes("gastos") && t.includes("hoje"))) return { type: "query_spent_today" };
  if ((t.includes("gastos") && t.includes("semana")) || t.includes("gastei na semana")) return { type: "query_spent_week" };
  if ((t.includes("gastos") && t.includes("mes")) || (t.includes("gastos") && t.includes("mês"))) return { type: "query_spent_month" };
  if ((t.includes("recebi") && t.includes("hoje")) || (t.includes("receitas") && t.includes("hoje"))) return { type: "query_received_today" };
  if (t.includes("ultimas") || t.includes("últimas") || t.includes("ultimos") || t.includes("últimos") || t.includes("ultimas transacoes") || t.includes("transacoes recentes")) {
    return { type: "query_last_transactions" };
  }
  if (t.includes("contas a pagar") || t.includes("boletos") || t.includes("vencendo") || t.includes("faturas")) {
    return { type: "query_bills_to_pay" };
  }

  // edição (quando já tem pendência)
  if (t.includes("valor") || t.includes("conta") || t.includes("carteira") || t.includes("categoria") || t.includes("cartao") || t.includes("cartão") || t.includes("parcel")) {
    return { type: "edit" };
  }

  return { type: "transaction" };
}

// ======================================================================
// 💳 Método de pagamento: account | credit_card_cash | credit_card_installments
// ======================================================================

function detectInstallments(msg) {
  const t = norm(msg);
  // "12x", "em 12x", "12 parcelas"
  const x = t.match(/(\d{1,2})\s*x/);
  if (x) return clampPositiveNumber(x[1]);
  const p = t.match(/(\d{1,2})\s+parcel/);
  if (p) return clampPositiveNumber(p[1]);
  const em = t.match(/parcelad[oa]\s+em\s+(\d{1,2})/);
  if (em) return clampPositiveNumber(em[1]);
  return null;
}

function detectFrequency(msg) {
  const t = norm(msg);
  if (t.includes("fixo") || t.includes("todo mes") || t.includes("todo mês") || t.includes("mensal") || t.includes("recorrente")) return "fixed";
  return "variable";
}

function detectDate(msg) {
  const t = norm(msg);
  if (t.includes("ontem")) return yesterdayISO();
  // futuro: "amanhã" — geralmente não queremos criar futuro automaticamente aqui
  return todayISO();
}

function detectType(msg) {
  const t = norm(msg);
  // income sinais
  if (/(recebi|ganhei|entrou|salario|salário|venda|freela|freelancer)/.test(t)) return "income";
  // expense default
  return "expense";
}

// ======================================================================
// 🧾 Montagem e validação de transação (campos do backend)
// ======================================================================

function isCompleteTransaction(t) {
  // Regras obrigatórias do seu app
  if (!t) return false;
  if (!t.family_id || !t.member_id) return false;
  if (!t.name) return false;
  if (!t.amount) return false;
  if (!t.type) return false;
  if (!t.frequency) return false;
  if (!t.date) return false;
  if (!t.category_id) return false; // obrigatório no seu app

  if (t.payment_method === "account") {
    if (!t.account_id) return false;
  } else {
    if (!t.card_id) return false;
    if (t.payment_method === "credit_card_installments" && !t.installments) return false;
  }

  return true;
}

function confirmationMessage(t, ctx) {
  const icon = t.type === "income" ? "🟢" : "🔴";
  const kind = t.type === "income" ? "Entrada" : "Saída";
  const pay =
    t.payment_method === "account"
      ? `Conta: ${t.account_name || "—"}`
      : `Cartão: ${t.card_name || "—"}${t.payment_method === "credit_card_installments" ? ` • ${t.installments}x` : ""}`;

  const dateLabel = t.date === todayISO() ? "Hoje" : t.date;

  return `${icon} ${kind}: *${t.name}*\n${formatBRL(t.amount)} • ${t.category_name}\n${pay} • ${dateLabel}\n\nConfirma? (Sim/Não)`;
}

function needMoreInfoReply(field, ctx, t) {
  if (field === "amount") return `Qual o valor? 💰`;
  if (field === "account_id") return askPickAccount(ctx.wallets || []);
  if (field === "card_id") return askPickCard(ctx.cards || []);
  if (field === "installments") return `Em quantas parcelas? (ex: 3x)`;
  if (field === "category_id") return askPickCategory(ctx.categories || [], t?.type || "expense");
  return `Me diz só mais uma informação rapidinho 🙂`;
}

// ======================================================================
// ✏️ Edição rápida (pós-confirmação): valor/conta/categoria/cartão/parcelas
// ======================================================================

async function applyEdits(msg, ctx, pending) {
  const t = norm(msg);

  // valor
  if (t.includes("valor")) {
    const a = extractAmount(msg);
    if (a) pending.amount = a;
  }

  // categoria
  if (t.includes("categoria")) {
    // tenta achar pelo nome digitado
    const typed = categoriesByType(ctx.categories || [], pending.type);
    const maybeName = msg.split(/categoria/i).pop();
    const found = findCategoryByNameLoose(typed, maybeName);
    if (found) {
      pending.category_id = found.id;
      pending.category_name = found.name;
    }
  }

  // conta/carteira
  if (t.includes("conta") || t.includes("carteira")) {
    const acc = findAccountByName(msg, ctx.wallets || []);
    if (acc) {
      pending.payment_method = "account";
      pending.account_id = acc.id;
      pending.account_name = acc.name;
      pending.card_id = null;
      pending.card_name = null;
      pending.installments = null;
    }
  }

  // cartão
  if (t.includes("cartao") || t.includes("cartão") || t.includes("credito") || t.includes("crédito")) {
    const card = findCardByName(msg, ctx.cards || []);
    if (card) {
      const inst = detectInstallments(msg);
      pending.card_id = card.id;
      pending.card_name = card.name;
      pending.account_id = null;
      pending.account_name = null;

      if (inst && inst > 1) {
        pending.payment_method = "credit_card_installments";
        pending.installments = inst;
      } else {
        pending.payment_method = "credit_card_cash";
        pending.installments = null;
      }
    }
  }

  // parcelas
  if (t.includes("parcela") || t.includes("parcel") || /\d+\s*x/.test(t)) {
    const inst = detectInstallments(msg);
    if (inst && inst > 1) {
      pending.payment_method = "credit_card_installments";
      pending.installments = inst;
    }
  }

  return pending;
}

// ======================================================================
// 🧠 Handler principal
// ======================================================================

export default async function handler(req, res) {
  if (req.method !== "POST") return ok(res, { reply: "Método não permitido.", action: "message" });

  try {
    const { message, history, context } = req.body || {};
    const msg = String(message || "").trim();
    const ctx = context || {};

    const intent = detectIntent(msg);
    const pending = ctx.pending_transaction || null;

    // ------------------------------------------------------------
    // 0) CONSULTAS (não dependem de pendência)
    // ------------------------------------------------------------
    if (intent.type.startsWith("query_")) {
      return ok(res, {
        reply: "Certo 🙂 Já verifico pra você.",
        action: intent.type,
        data: { family_id: ctx.family_id, member_id: ctx.member_id }
      });
    }

    // ------------------------------------------------------------
    // 1) SE EXISTE PENDÊNCIA: nunca “vazar” pra conversa nova
    // ------------------------------------------------------------
    if (pending) {
      // 1.1 cancelar sempre funciona
      if (intent.type === "cancel") {
        return ok(res, { reply: "Cancelado 👍", action: "cancelled" });
      }

      // 1.2 confirmar: só confirma se estiver completo (pra evitar erro no banco)
      if (intent.type === "confirm") {
        if (!isCompleteTransaction(pending)) {
          // descobre o que falta
          const missing =
            !pending.amount ? "amount" :
            !pending.category_id ? "category_id" :
            (pending.payment_method === "account" && !pending.account_id) ? "account_id" :
            (pending.payment_method !== "account" && !pending.card_id) ? "card_id" :
            (pending.payment_method === "credit_card_installments" && !pending.installments) ? "installments" :
            null;

          return ok(res, {
            reply: missing ? needMoreInfoReply(missing, ctx, pending) : "Falta só um detalhe 🙂",
            action: "need_more_info",
            data: { pending_transaction: pending, missing_field: missing || "unknown" }
          });
        }

        // ✅ ALINHADO AO SEU BACKEND + BANCO:
        // - action: "success"
        // - data: payload com name (NOT NULL), category_id e account_id/card_id
        const payload = {
          ...pending,
          // garantia absoluta:
          name: pending.name || pending.description || "Lançamento",
          origem: "whatsapp",
          idempotency_key: pending.idempotency_key || buildIdempotencyKey(ctx, pending),
        };

        return ok(res, { reply: "Registrado! 🚀", action: "success", data: payload });
      }

      // 1.3 edição (pós-confirmação)
      if (intent.type === "edit") {
        const updated = await applyEdits(msg, ctx, { ...pending });

        // se ainda incompleto, pergunta o campo que falta
        if (!isCompleteTransaction(updated)) {
          const missing =
            !updated.amount ? "amount" :
            !updated.category_id ? "category_id" :
            (updated.payment_method === "account" && !updated.account_id) ? "account_id" :
            (updated.payment_method !== "account" && !updated.card_id) ? "card_id" :
            (updated.payment_method === "credit_card_installments" && !updated.installments) ? "installments" :
            null;

          return ok(res, {
            reply: missing ? needMoreInfoReply(missing, ctx, updated) : "Me diz só mais um detalhe 🙂",
            action: "need_more_info",
            data: { pending_transaction: updated, missing_field: missing || "unknown" }
          });
        }

        return ok(res, {
          reply: confirmationMessage(updated, ctx),
          action: "awaiting_confirmation",
          data: { pending_transaction: updated }
        });
      }

      // 1.4 coleta de informações (quando pendente tem missing_field)
      // Se o backend te devolve missing_field no contexto, trate aqui:
      if (pending.missing_field) {
        const field = pending.missing_field;

        const updated = { ...pending };
        if (field === "amount") {
          const a = extractAmount(msg);
          if (a) updated.amount = a;
        }

        if (field === "account_id") {
          const acc = findAccountByName(msg, ctx.wallets || []);
          if (acc) {
            updated.payment_method = "account";
            updated.account_id = acc.id;
            updated.account_name = acc.name;
          }
        }

        if (field === "card_id") {
          const card = findCardByName(msg, ctx.cards || []);
          if (card) {
            updated.card_id = card.id;
            updated.card_name = card.name;
          }
        }

        if (field === "installments") {
          const inst = detectInstallments(msg);
          if (inst && inst > 1) updated.installments = inst;
        }

        if (field === "category_id") {
          const typed = categoriesByType(ctx.categories || [], updated.type);
          const found = findCategoryByNameLoose(typed, msg) || suggestCategoryFromKeywords(ctx.categories || [], updated.type, msg);
          if (found) {
            updated.category_id = found.id;
            updated.category_name = found.name;
          }
        }

        // remove missing_field se resolveu
        if (
          (field === "amount" && updated.amount) ||
          (field === "account_id" && updated.account_id) ||
          (field === "card_id" && updated.card_id) ||
          (field === "installments" && updated.installments) ||
          (field === "category_id" && updated.category_id)
        ) {
          updated.missing_field = null;
        }

        if (!isCompleteTransaction(updated)) {
          const missing =
            !updated.amount ? "amount" :
            !updated.category_id ? "category_id" :
            (updated.payment_method === "account" && !updated.account_id) ? "account_id" :
            (updated.payment_method !== "account" && !updated.card_id) ? "card_id" :
            (updated.payment_method === "credit_card_installments" && !updated.installments) ? "installments" :
            null;

          return ok(res, {
            reply: missing ? needMoreInfoReply(missing, ctx, updated) : "Só mais um detalhe 🙂",
            action: "need_more_info",
            data: { pending_transaction: updated, missing_field: missing || "unknown" }
          });
        }

        return ok(res, {
          reply: confirmationMessage(updated, ctx),
          action: "awaiting_confirmation",
          data: { pending_transaction: updated }
        });
      }

      // 1.5 Se tem pendência mas mensagem não é confirm/cancel/edit, re-mostra confirmação
      return ok(res, {
        reply: confirmationMessage(pending, ctx),
        action: "awaiting_confirmation",
        data: { pending_transaction: pending }
      });
    }

    // ------------------------------------------------------------
    // 2) NOVA TRANSAÇÃO (criar pendência do zero)
    // ------------------------------------------------------------
    if (intent.type !== "transaction") {
      // caso o usuário mande algo aleatório
      return ok(res, { reply: "Me diga um gasto ou receita 🙂 Ex: “Gastei 20 no Uber”.", action: "message" });
    }

    const type = detectType(msg);
    const amount = extractAmount(msg);
    const frequency = detectFrequency(msg);
    const date = detectDate(msg);

    if (!amount) {
      return ok(res, { reply: "Qual foi o valor? 💰 (ex: 20,00)", action: "need_more_info", data: { missing_field: "amount" } });
    }

    // pagamento: cartão vs conta
    const cards = ctx.cards || [];
    const wallets = ctx.wallets || [];
    const hasCreditWord = /(cartao|cartão|credito|crédito)/.test(norm(msg));
    const card = findCardByName(msg, cards);
    const acc = findAccountByName(msg, wallets);

    const installments = detectInstallments(msg);
    let payment_method = "account";
    let card_id = null, card_name = null;
    let account_id = null, account_name = null;

    if (card || hasCreditWord) {
      payment_method = installments && installments > 1 ? "credit_card_installments" : "credit_card_cash";
      if (card) {
        card_id = card.id;
        card_name = card.name;
      }
    } else {
      payment_method = "account";
      if (acc) {
        account_id = acc.id;
        account_name = acc.name;
      }
    }

    const description = inferNameFromMessage(msg);
    const name = description; // banco exige name NOT NULL

    // categoria: obrigatório -> tenta (keyword -> IA -> fallback pedir)
    let category = suggestCategoryFromKeywords(ctx.categories || [], type, msg) || suggestCategoryFromKeywords(ctx.categories || [], type, name);

    if (!category) {
      // tenta IA (se tiver chave)
      category = await classifyCategoryAI({ text: msg, type, categories: ctx.categories || [] });
    }

    const pending_transaction = {
      // contexto (RLS)
      family_id: ctx.family_id,
      member_id: ctx.member_id,

      // transação (transactions)
      type,
      amount,
      frequency,
      date,
      name,                 // ✅ obrigatório no banco
      description,          // opcional (bom pro WhatsApp)
      origem: "whatsapp",

      // categoria obrigatória
      category_id: category?.id || null,
      category_name: category?.name || null,

      // método de pagamento + ids
      payment_method,
      account_id: payment_method === "account" ? (account_id || null) : null,
      account_name: payment_method === "account" ? (account_name || null) : null,
      card_id: payment_method !== "account" ? (card_id || null) : null,
      card_name: payment_method !== "account" ? (card_name || null) : null,
      installments: payment_method === "credit_card_installments" ? (installments || null) : null,

      // opcional
      tags: null,
      idempotency_key: null,

      // controle de conversa
      missing_field: null,
    };

    // descobrir o que falta (ordem curta e humana)
    let missing_field = null;

    if (!pending_transaction.category_id) missing_field = "category_id";
    else if (pending_transaction.payment_method === "account" && !pending_transaction.account_id) missing_field = "account_id";
    else if (pending_transaction.payment_method !== "account" && !pending_transaction.card_id) missing_field = "card_id";
    else if (pending_transaction.payment_method === "credit_card_installments" && !pending_transaction.installments) missing_field = "installments";

    if (missing_field) {
      pending_transaction.missing_field = missing_field;

      return ok(res, {
        reply: needMoreInfoReply(missing_field, ctx, pending_transaction),
        action: "need_more_info",
        data: { pending_transaction, missing_field }
      });
    }

    // completo -> confirmação
    pending_transaction.idempotency_key = buildIdempotencyKey(ctx, pending_transaction);

    return ok(res, {
      reply: confirmationMessage(pending_transaction, ctx),
      action: "awaiting_confirmation",
      data: { pending_transaction }
    });

  } catch (err) {
    console.error(err);
    return ok(res, { reply: "Ops 😅 deu um erro aqui. Tenta de novo?", action: "message" });
  }
}
