```js
// /api/chat.js — Family Finance IA (WhatsApp)
// ✅ SEM SDK (OpenAI via fetch opcional)
// ✅ NÃO perde contexto (pending_transaction)
// ✅ Categoria obrigatória (category_id)
// ✅ Corrige o erro do seu log: name NULL
//    -> agora SEMPRE garante `name`
//    -> e devolve `data` FLAT (para o seu webhook salvar em parsed_data)
//    -> mas também inclui `data.pending_transaction` para compatibilidade

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
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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

function buildIdempotencyKey(ctx, t) {
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

  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  return `wpp_${h}`;
}

// ======================================================================
// Número (digitado + por extenso PT-BR)
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
// Name / descrição (banco exige name NOT NULL)
// ======================================================================

function inferNameFromMessage(original) {
  let t = norm(original);

  t = t.replace(/\b(gastei|paguei|comprei|recebi|ganhei|entrou|saiu|transferi|pix|pague)\b/g, "");
  t = t.replace(/\b(no|na|em|com|de|para|por|reais|real|r\$|um|uma|uns|umas)\b/g, "");
  t = t.replace(/\d+[.,]?\d*/g, "");

  Object.keys(NUMBER_WORDS).forEach((w) => {
    t = t.replace(new RegExp(`\\b${w}\\b`, "g"), "");
  });

  t = t.replace(/\s+/g, " ").trim();

  if (!t) return "Lançamento";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ======================================================================
// Carteiras / Cartões
// ======================================================================

function findAccountByName(msg, wallets = []) {
  const t = norm(msg);
  return wallets.find((a) => t === norm(a.name) || t.includes(norm(a.name))) || null;
}

function findCardByName(msg, cards = []) {
  const t = norm(msg);
  return cards.find((c) => t === norm(c.name) || t.includes(norm(c.name))) || null;
}

function askPickAccount(wallets = []) {
  const list = wallets.slice(0, 6).map((w) => `• [${w.name}]`).join("\n");
  return `De qual conta saiu ou entrou? 💳\n\n${list || "• (nenhuma conta encontrada)"}`;
}

function askPickCard(cards = []) {
  const list = cards.slice(0, 6).map((c) => `• [${c.name}]`).join("\n");
  return `Qual cartão foi usado? 💳\n\n${list || "• (nenhum cartão encontrado)"}`;
}

// ======================================================================
// Parcelas / frequência / tipo / intent
// ======================================================================

function detectInstallments(msg) {
  const t = norm(msg);
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
  if (t.includes("fixo") || t.includes("todo mes") || t.includes("todo mês") || t.includes("mensal") || t.includes("recorrente")) {
    return "fixed";
  }
  return "variable";
}

function detectType(msg) {
  const t = norm(msg);
  if (/(recebi|ganhei|entrou|salario|salário|venda|freela|freelancer|beneficio|benefício)/.test(t)) return "income";
  return "expense";
}

function detectIntent(msg) {
  const t = norm(msg);

  if (/^(sim|s|ok|confirmo|confirmar|pode|pode ser)$/.test(t)) return { type: "confirm" };
  if (/^(nao|não|n|cancelar|cancela|esquece)$/.test(t)) return { type: "cancel" };

  // consultas
  if (t.includes("saldo")) return { type: "query_balance" };
  if (t.includes("gastos") && t.includes("hoje")) return { type: "query_spent_today" };
  if (t.includes("gastos") && t.includes("semana")) return { type: "query_spent_week" };
  if (t.includes("gastos") && (t.includes("mes") || t.includes("mês"))) return { type: "query_spent_month" };
  if ((t.includes("receitas") || t.includes("recebi")) && t.includes("hoje")) return { type: "query_received_today" };
  if (t.includes("ultimas") || t.includes("últimas") || t.includes("recentes")) return { type: "query_last_transactions" };
  if (t.includes("contas a pagar") || t.includes("boletos") || t.includes("vencendo") || t.includes("faturas")) return { type: "query_bills_to_pay" };

  // edição
  if (t.includes("valor") || t.includes("conta") || t.includes("carteira") || t.includes("categoria") || t.includes("cartao") || t.includes("cartão") || t.includes("parcel")) {
    return { type: "edit" };
  }

  return { type: "transaction" };
}

// ======================================================================
// Categorias obrigatórias (keyword fallback + IA opcional)
// ======================================================================

const KEYWORD_CATEGORY_HINTS = [
  { kw: ["uber", "99", "taxi", "corrida"], pick: ["uber", "99", "taxi"] },
  { kw: ["gasolina", "posto", "etanol", "diesel", "abasteci"], pick: ["combust"] },
  { kw: ["mercado", "supermerc", "carrefour", "assai", "atacadao"], pick: ["super", "mercado"] },
  { kw: ["ifood", "delivery", "pizza", "hamburg"], pick: ["delivery"] },
  { kw: ["padaria", "pao"], pick: ["padaria"] },
  { kw: ["restaurante", "almoco", "jantar", "lanche"], pick: ["restaurante", "lanche"] },
  { kw: ["luz", "energia", "enel", "light"], pick: ["energia"] },
  { kw: ["agua", "cedae", "sabesp"], pick: ["agua"] },
  { kw: ["internet", "wifi", "claro", "vivo", "oi"], pick: ["internet"] },
  { kw: ["farmacia", "remedio", "drogaria"], pick: ["farm"] },
  { kw: ["dizimo", "dízimo", "oferta", "igreja"], pick: ["dizimo", "oferta", "igreja"] },
];

function categoriesByType(categories = [], type) {
  return categories.filter((c) => norm(c.type) === norm(type));
}

function findCategoryByNameLoose(categories = [], wantedName) {
  const w = norm(wantedName);
  if (!w) return null;

  let found = categories.find((c) => norm(c.name) === w);
  if (found) return found;

  found = categories.find((c) => norm(c.name).includes(w));
  if (found) return found;

  return null;
}

function suggestCategoryFromKeywords(categories = [], type, text) {
  const t = norm(text);
  const typed = categoriesByType(categories, type);

  for (const rule of KEYWORD_CATEGORY_HINTS) {
    if (rule.kw.some((k) => t.includes(norm(k)))) {
      for (const p of rule.pick) {
        const c = typed.find((x) => norm(x.name).includes(norm(p)));
        if (c) return c;
      }
    }
  }
  return null;
}

async function classifyCategoryAI({ text, type, categories }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const typed = categoriesByType(categories || [], type);
  if (!typed.length) return null;

  const names = typed.map((c) => c.name).slice(0, 250);

  const prompt = `
Escolha UMA categoria da lista abaixo (exatamente como está escrito).
Regras:
- Não invente categorias.
- Responda APENAS com o NOME da categoria.

Tipo: ${type}
Texto: "${text}"

Categorias:
${names.map((n) => `- ${n}`).join("\n")}
`.trim();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
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
    return findCategoryByNameLoose(typed, pick) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function askPickCategory(categories = [], type) {
  const typed = categoriesByType(categories, type);
  const sample = typed.slice(0, 8).map((c) => `• [${c.name}]`).join("\n");
  return `Qual categoria é essa? 📁\n\n${sample || "• (nenhuma categoria encontrada)"}`;
}

// ======================================================================
// Validação e respostas
// ======================================================================

function ensureName(t) {
  // GARANTIA ABSOLUTA (resolve seu erro 23502)
  if (!t.name || !String(t.name).trim()) {
    t.name = t.description || "Lançamento";
  }
  return t;
}

function isCompleteTransaction(t) {
  if (!t) return false;

  // contexto RLS
  if (!t.family_id || !t.member_id) return false;

  // banco
  if (!t.name) return false;
  if (!t.amount) return false;
  if (!t.type) return false;
  if (!t.frequency) return false;
  if (!t.date) return false;

  // obrigatório no app
  if (!t.category_id) return false;

  if (t.payment_method === "account") {
    if (!t.account_id) return false;
  } else {
    if (!t.card_id) return false;
    if (t.payment_method === "credit_card_installments" && !t.installments) return false;
  }

  return true;
}

function confirmationMessage(t) {
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
  if (field === "amount") return "Qual o valor? 💰";
  if (field === "account_id") return askPickAccount(ctx.wallets || []);
  if (field === "card_id") return askPickCard(ctx.cards || []);
  if (field === "installments") return "Em quantas parcelas? (ex: 3x)";
  if (field === "category_id") return askPickCategory(ctx.categories || [], t?.type || "expense");
  return "Me diz só mais um detalhe 🙂";
}

function missingField(t) {
  if (!t.amount) return "amount";
  if (!t.category_id) return "category_id";
  if (t.payment_method === "account" && !t.account_id) return "account_id";
  if (t.payment_method !== "account" && !t.card_id) return "card_id";
  if (t.payment_method === "credit_card_installments" && !t.installments) return "installments";
  return null;
}

// ⭐⭐⭐ IMPORTANTE:
// Para o seu webhook NÃO salvar errado, a gente devolve:
//   data: { ...t, pending_transaction: t }
// Assim, se você fizer `parsed_data = ai.data` -> parsed_data.name EXISTE.
// E se seu código antigo usa `ai.data.pending_transaction` -> também funciona.
function packData(t) {
  const tx = ensureName({ ...t });
  return { ...tx, pending_transaction: tx };
}

// ======================================================================
// Edição (quando já existe pending_transaction)
// ======================================================================

async function applyEdits(msg, ctx, pending) {
  const t = norm(msg);

  // valor
  if (t.includes("valor")) {
    const a = extractAmount(msg);
    if (a) pending.amount = a;
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

  // categoria
  if (t.includes("categoria")) {
    const typed = categoriesByType(ctx.categories || [], pending.type);
    const maybeName = msg.split(/categoria/i).pop();
    const found = findCategoryByNameLoose(typed, maybeName) || suggestCategoryFromKeywords(ctx.categories || [], pending.type, maybeName);
    if (found) {
      pending.category_id = found.id;
      pending.category_name = found.name;
    }
  }

  pending = ensureName(pending);
  return pending;
}

// ======================================================================
// Handler
// ======================================================================

export default async function handler(req, res) {
  if (req.method !== "POST") return ok(res, { reply: "Método não permitido.", action: "message" });

  try {
    const { message, context } = req.body || {};
    const msg = String(message || "").trim();
    const ctx = context || {};

    const intent = detectIntent(msg);
    const pendingRaw = ctx.pending_transaction || null;
    const pending = pendingRaw ? ensureName({ ...pendingRaw }) : null;

    // ------------------------------------------------------------
    // Consultas
    // ------------------------------------------------------------
    if (intent.type.startsWith("query_")) {
      return ok(res, {
        reply: "Certo 🙂",
        action: intent.type,
        data: { family_id: ctx.family_id, member_id: ctx.member_id }
      });
    }

    // ------------------------------------------------------------
    // Se existe pendência: confirmar / cancelar / editar / coletar campo
    // ------------------------------------------------------------
    if (pending) {
      if (intent.type === "cancel") {
        return ok(res, { reply: "Cancelado 👍", action: "cancelled", data: null });
      }

      if (intent.type === "edit") {
        const updated = await applyEdits(msg, ctx, { ...pending });
        const miss = missingField(updated);
        if (miss) {
          updated.missing_field = miss;
          return ok(res, {
            reply: needMoreInfoReply(miss, ctx, updated),
            action: "need_more_info",
            data: packData(updated)
          });
        }

        updated.idempotency_key = updated.idempotency_key || buildIdempotencyKey(ctx, updated);
        return ok(res, {
          reply: confirmationMessage(updated),
          action: "awaiting_confirmation",
          data: packData(updated)
        });
      }

      // Se seu backend salva "missing_field", ele volta aqui
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
          if (inst && inst > 1) {
            updated.payment_method = "credit_card_installments";
            updated.installments = inst;
          }
        }

        if (field === "category_id") {
          const typed = categoriesByType(ctx.categories || [], updated.type);
          const found = findCategoryByNameLoose(typed, msg) || suggestCategoryFromKeywords(ctx.categories || [], updated.type, msg);
          if (found) {
            updated.category_id = found.id;
            updated.category_name = found.name;
          }
        }

        updated.missing_field = missingField(updated);
        ensureName(updated);

        if (updated.missing_field) {
          return ok(res, {
            reply: needMoreInfoReply(updated.missing_field, ctx, updated),
            action: "need_more_info",
            data: packData(updated)
          });
        }

        updated.idempotency_key = updated.idempotency_key || buildIdempotencyKey(ctx, updated);
        return ok(res, {
          reply: confirmationMessage(updated),
          action: "awaiting_confirmation",
          data: packData(updated)
        });
      }

      // Confirmar
      if (intent.type === "confirm") {
        const updated = ensureName({ ...pending });

        // Se estiver faltando algo, NÃO deixa salvar e evita null no banco
        const miss = missingField(updated);
        if (miss) {
          updated.missing_field = miss;
          return ok(res, {
            reply: needMoreInfoReply(miss, ctx, updated),
            action: "need_more_info",
            data: packData(updated)
          });
        }

        updated.idempotency_key = updated.idempotency_key || buildIdempotencyKey(ctx, updated);

        // ✅ Aqui o seu webhook deve salvar usando data.name (não description)
        return ok(res, {
          reply: "Registrado! 🚀",
          action: "success",
          data: packData(updated)
        });
      }

      // Se falou qualquer coisa diferente, reenvia a confirmação (não perde contexto)
      return ok(res, {
        reply: confirmationMessage(pending),
        action: "awaiting_confirmation",
        data: packData(pending)
      });
    }

    // ------------------------------------------------------------
    // Nova transação
    // ------------------------------------------------------------
    if (intent.type !== "transaction") {
      return ok(res, { reply: "Me diga um gasto ou receita 🙂 Ex: “Gastei 20 no Uber”.", action: "message" });
    }

    const type = detectType(msg);
    const amount = extractAmount(msg);
    const frequency = detectFrequency(msg);
    const date = detectDate(msg);

    if (!amount) {
      return ok(res, {
        reply: "Qual o valor? 💰",
        action: "need_more_info",
        data: packData({
          family_id: ctx.family_id,
          member_id: ctx.member_id,
          type,
          frequency,
          date,
          name: "Lançamento",
          description: "Lançamento",
          origem: "whatsapp",
          payment_method: "account",
          missing_field: "amount"
        })
      });
    }

    const wallets = ctx.wallets || [];
    const cards = ctx.cards || [];

    const installments = detectInstallments(msg);
    const hasCreditWord = /(cartao|cartão|credito|crédito)/.test(norm(msg));
    const card = findCardByName(msg, cards);
    const acc = findAccountByName(msg, wallets);

    let payment_method = "account";
    let account_id = null, account_name = null;
    let card_id = null, card_name = null;

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

    const name = inferNameFromMessage(msg);
    const description = name;

    // categoria (obrigatória)
    let category =
      suggestCategoryFromKeywords(ctx.categories || [], type, msg) ||
      suggestCategoryFromKeywords(ctx.categories || [], type, name);

    if (!category) {
      category = await classifyCategoryAI({ text: msg, type, categories: ctx.categories || [] });
    }

    const tx = ensureName({
      family_id: ctx.family_id,
      member_id: ctx.member_id,

      type,
      amount,
      frequency,
      date,

      name,
      description,
      origem: "whatsapp",

      category_id: category?.id || null,
      category_name: category?.name || null,

      payment_method,
      account_id: payment_method === "account" ? (account_id || null) : null,
      account_name: payment_method === "account" ? (account_name || null) : null,
      card_id: payment_method !== "account" ? (card_id || null) : null,
      card_name: payment_method !== "account" ? (card_name || null) : null,
      installments: payment_method === "credit_card_installments" ? (installments || null) : null,

      tags: null,
      idempotency_key: null,
      missing_field: null,
    });

    const miss = missingField(tx);
    if (miss) {
      tx.missing_field = miss;
      return ok(res, {
        reply: needMoreInfoReply(miss, ctx, tx),
        action: "need_more_info",
        data: packData(tx)
      });
    }

    tx.idempotency_key = buildIdempotencyKey(ctx, tx);

    return ok(res, {
      reply: confirmationMessage(tx),
      action: "awaiting_confirmation",
      data: packData(tx)
    });

  } catch (err) {
    console.error(err);
    return ok(res, { reply: "Ops 😅 deu um erro aqui. Tenta de novo?", action: "message" });
  }
}
```
