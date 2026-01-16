// /api/chat.js — Family Finance IA (WhatsApp)
// ✅ SEM SDK (OpenAI via fetch opcional)
// ✅ Pergunta CONTA quando faltar (lista todas) e NÃO reinicia transação
// ✅ Estado persistido no Supabase (REST) + fallback em memória
// ✅ Confirmação no formato solicitado
// ✅ Descrição mais específica do texto (ex: "Uber / Extra")
// ✅ Nunca quebra por IA (fallback local)

const TZ = "America/Sao_Paulo";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

// ======================================================================
// ✅ (1x) SUPABASE — crie a tabela (SQL)
// ======================================================================
//
// create table if not exists public.ff_conversation_state (
//   key text primary key,
//   state jsonb not null,
//   updated_at timestamptz not null default now()
// );
//
// -- opcional: índice por updated_at
// create index if not exists ff_conversation_state_updated_at_idx
// on public.ff_conversation_state(updated_at);
//
// Env no Vercel:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
//
// ======================================================================

/** Fallback em memória (não é 100% confiável em serverless, mas ajuda) */
const memoryState = globalThis.__FF_STATE__ || (globalThis.__FF_STATE__ = new Map());

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

// ✅ Normalização específica para respostas curtas (Sim/Não etc.) — remove pontuação
function normAnswer(s = "") {
  return removeDiacritics(String(s).toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(obj, paths, fallback = undefined) {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = obj;
    let ok = true;
    for (const part of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, part)) cur = cur[part];
      else {
        ok = false;
        break;
      }
    }
    if (ok && cur !== undefined && cur !== null) return cur;
  }
  return fallback;
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
// Identificadores do usuário (para chave do estado)
// ======================================================================

function getFromPhone(body) {
  return (
    pick(body, ["fromPhone", "from", "wa_id"], "") ||
    pick(body, ["entry.0.changes.0.value.messages.0.from"], "")
  );
}

function getFamilyId(body) {
  return (
    pick(body, ["family_id", "familyId", "data.family_id", "context.family_id"], "") ||
    ""
  );
}

function buildStateKey(body) {
  const phone = String(getFromPhone(body) || "unknown");
  const family = String(getFamilyId(body) || "nofamily");
  return `${family}:${phone}`;
}

// ✅ Id da mensagem (para idempotência / evitar duplicados)
function getMessageId(body) {
  return (
    pick(body, ["messageId", "message_id", "id"], "") ||
    pick(body, ["message.id"], "") ||
    pick(body, ["entry.0.changes.0.value.messages.0.id"], "")
  );
}

// ======================================================================
// Supabase REST (sem SDK)
// ======================================================================

function hasSupabase() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseFetch(path, options = {}) {
  const url = `${process.env.SUPABASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...options.headers
  };

  const res = await fetch(url, { ...options, headers });
  return res;
}

async function loadState(key) {
  // 1) memória
  const mem = memoryState.get(key);
  if (mem) return mem;

  // 2) supabase
  if (!hasSupabase()) return null;

  try {
    const res = await supabaseFetch(
      `/rest/v1/ff_conversation_state?key=eq.${encodeURIComponent(key)}&select=state,updated_at`,
      { method: "GET" }
    );

    if (!res.ok) return null;
    const rows = await res.json();
    const row = rows?.[0];
    if (!row?.state) return null;

    // ✅ se foi "limpo" via soft clear
    if (row.state?.cleared) return null;

    // TTL simples (24h)
    const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
    if (Date.now() - updatedAt > 24 * 60 * 60 * 1000) return null;

    memoryState.set(key, row.state);
    return row.state;
  } catch {
    return null;
  }
}

async function saveState(key, state) {
  memoryState.set(key, state);

  if (!hasSupabase()) return;

  try {
    const payload = {
      key,
      state,
      updated_at: new Date().toISOString()
    };

    await supabaseFetch(`/rest/v1/ff_conversation_state`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(payload)
    });
  } catch {
    // silêncio
  }
}

// ✅ IMPORTANTE: Soft clear (upsert) ao invés de DELETE para evitar "estado fantasma"
async function clearState(key) {
  memoryState.delete(key);

  if (!hasSupabase()) return;

  try {
    const payload = {
      key,
      state: { awaiting: null, cleared: true },
      updated_at: new Date().toISOString()
    };

    await supabaseFetch(`/rest/v1/ff_conversation_state`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(payload)
    });
  } catch {
    // silêncio
  }
}

// ======================================================================
// Entrada: texto + wallets + categories
// ======================================================================

function getInboundText(body) {
  const direct =
    pick(body, ["messageBody", "message", "text", "input", "message_text"], "") ||
    pick(body, ["message.text.body"], "") ||
    pick(body, ["entry.0.changes.0.value.messages.0.text.body"], "");
  return String(direct || "").trim();
}

function getWallets(body) {
  const walletsRaw =
    pick(body, ["context.wallets", "wallets", "data.wallets", "context.accounts", "accounts"], []) || [];

  return Array.isArray(walletsRaw)
    ? walletsRaw
        .map((w) => {
          if (!w) return null;
          const id = w.id || w.wallet_id || w.account_id || w.value || w.uuid;
          const name = w.name || w.title || w.label || w.wallet_name;
          if (!id && !name) return null;
          return { id: String(id || name), name: String(name || id) };
        })
        .filter(Boolean)
    : [];
}

function getCategories(body) {
  const catsRaw =
    pick(body, ["context.categories", "categories", "data.categories", "context.categorias"], []) || [];

  return Array.isArray(catsRaw)
    ? catsRaw
        .map((c) => {
          if (!c) return null;
          const id = c.id || c.category_id || c.uuid || c.value;
          const name = c.name || c.title || c.label;
          const type = c.type || c.kind; // "income" | "expense"
          if (!id && !name) return null;
          return { id: String(id || name), name: String(name || id), type: type ? String(type) : undefined };
        })
        .filter(Boolean)
    : [];
}

// ======================================================================
// Números por extenso + parse valor
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

function parseAmount(text) {
  const raw = String(text || "");

  const m = raw.match(
    /(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|-?\d+(?:[.,]\d{1,2})?)/i
  );

  if (m && m[1]) {
    let s = m[1];
    if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }

  return parseNumberFromTextPT(raw);
}

// ======================================================================
// Descrição específica
// ======================================================================

const STOPWORDS = new Set([
  "por","reais","real","com","de","da","do","das","dos","no","na","nos","nas",
  "um","uma","uns","umas","e","a","o","as","os","para","pra","pro","em"
]);

const VERBS_RE =
  /\b(paguei|gastei|comprei|recebi|ganhei|entrou|pagar|gastar|comprar|receber|ganhar|entrar)\b/gi;

function toTitleCase(str) {
  return String(str || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractSpecificFromMessage(msg) {
  const raw = norm(msg);

  const after = raw.match(/\b(?:de|do|da)\s+([a-z0-9-]+)(?:\s+([a-z0-9-]+))?(?:\s+([a-z0-9-]+))?/i);
  if (after) {
    const picked = [after[1], after[2], after[3]]
      .filter(Boolean)
      .filter((w) => !STOPWORDS.has(w))
      .slice(0, 3)
      .join(" ");
    if (picked) return toTitleCase(picked);
  }

  let text = raw.replace(VERBS_RE, " ");
  text = text.replace(/(?:r\$\s*)?-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})/gi, " ");
  text = text.replace(/(?:r\$\s*)?-?\d+(?:[.,]\d{1,2})?/gi, " ");

  Object.keys(NUMBER_WORDS).forEach((w) => {
    const ww = norm(w);
    text = text.replace(new RegExp(`\\b${ww}\\b`, "g"), " ");
  });

  text = text.replace(/[^\p{L}\p{N}\s-]/gu, " ");

  const tokens = text
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t))
    .filter((t) => t.length >= 2);

  const base = tokens.slice(0, 4).join(" ");
  return base ? toTitleCase(base) : "";
}

function inferDescription(msg, categoryName, type) {
  const base = extractSpecificFromMessage(msg);

  if (base) {
    if (type === "income") {
      const subtype = String(categoryName || "").split("/")[1]?.trim() || "Extra";
      if (norm(base).includes(norm(subtype))) return base;
      return `${base} / ${subtype}`;
    }
    return base;
  }

  if (categoryName && !String(categoryName).includes("Outros")) {
    const parts = String(categoryName).split("/").map((p) => p.trim()).filter(Boolean);
    return parts.slice(1).join(" / ") || "Lançamento";
  }

  return "Lançamento";
}

// ======================================================================
// Carteiras (contas)
// ======================================================================

function findWalletInText(text, wallets) {
  const t = norm(text);
  if (!wallets?.length) return null;

  let best = null;
  for (const w of wallets) {
    const wn = norm(w.name);
    if (!wn) continue;

    if (t === wn || t.includes(wn) || wn.includes(t)) {
      if (!best || wn.length > norm(best.name).length) best = w;
    }
  }
  return best;
}

function parseWalletSelection(userText, wallets) {
  const t = String(userText || "").trim();
  if (!wallets?.length) return null;

  const num = t.match(/^\s*(\d{1,2})\s*$/);
  if (num) {
    const idx = Number(num[1]) - 1;
    if (idx >= 0 && idx < wallets.length) return wallets[idx];
  }

  return findWalletInText(t, wallets);
}

function buildWalletQuestion(wallets) {
  if (!wallets?.length) return `Qual conta (carteira) devo usar? 👛`;
  const lines = wallets.map((w, i) => `${i + 1}) ${w.name}`).join("\n");
  return `Qual conta (carteira) devo usar? 👛\n\n${lines}\n\nResponda com o *número* ou o *nome* da conta.`;
}

// ======================================================================
// Categorias (heurística + IA opcional)
// ======================================================================

const FALLBACK_CATEGORIES = {
  expense: [
    "Moradia / Aluguel",
    "Moradia / Financiamento / Prestação",
    "Moradia / Condomínio",
    "Moradia / IPTU",
    "Contas Mensais / Energia",
    "Contas Mensais / Água",
    "Contas Mensais / Gás",
    "Contas Mensais / Internet",
    "Alimentação / Supermercado",
    "Alimentação / Delivery",
    "Alimentação / Restaurante / Lanches fora",
    "Transporte / Uber / 99",
    "Transporte / Combustível",
    "Outros / Outros"
  ],
  income: ["Receita / Salário", "Receita / Extra", "Receita / Freelancer", "Receita / Venda", "Receita / Benefícios"]
};

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
  if (/combustivel|combustível|gasolina|etanol|diesel/.test(t)) return "Transporte / Combustível";
  if (/mercado|supermercado/.test(t)) return "Alimentação / Supermercado";
  if (/delivery|ifood/.test(t)) return "Alimentação / Delivery";
  if (/restaurante|lanche|lanches|pizza|hamburguer|hambúrguer/.test(t))
    return "Alimentação / Restaurante / Lanches fora";

  return "Outros / Outros";
}

async function callOpenAI(prompt, signal) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    }),
    signal
  });

  if (!response.ok) throw new Error(`OpenAI API error (${response.status})`);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta OpenAI vazia.");
  return String(content).trim();
}

async function classifyWithAI(text, type, allowed) {
  const categories = allowed?.length ? allowed : FALLBACK_CATEGORIES[type];

  const prompt = `
Classifique a frase abaixo em UMA das categorias listadas.
Responda SOMENTE com o texto EXATO da categoria.

Frase:
"${text}"

Categorias:
${categories.map((c) => "- " + c).join("\n")}
`.trim();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const resultRaw = await callOpenAI(prompt, controller.signal);
    clearTimeout(timeout);

    const result = resultRaw.replace(/^[-–•]\s*/g, "").replace(/^"+|"+$/g, "").trim();
    if (categories.includes(result)) return result;
  } catch {
    // fallback
  }

  return type === "expense" ? "Outros / Outros" : "Receita / Extra";
}

function resolveCategoryIdByName(categoryName, categories, type) {
  if (!categoryName || !categories?.length) return null;

  const target = norm(categoryName);

  let found = categories.find(
    (c) => norm(c.name) === target && (!type || !c.type || norm(c.type) === norm(type))
  );
  if (found) return found.id;

  found = categories.find((c) => target.includes(norm(c.name)) || norm(c.name).includes(target));
  return found ? found.id : null;
}

// ======================================================================
// Confirmação (formato solicitado) — inclui conta
// ======================================================================

function buildConfirmationReply(data) {
  const isIncome = data.type === "income";
  const emoji = isIncome ? "🟢" : "🔴";
  const label = isIncome ? "Receita" : "Despesa";
  const date = formatDateBR(new Date());

  const walletLine = data.wallet_name ? `👛 Conta: ${data.wallet_name}\n` : "";

  return `${emoji} ${label}  |  Variável
💰 Valor: R$ ${formatAmount2(data.amount)}
📝 Descrição: ${data.description}
📁 Categoria: ${data.category_name}
${walletLine}${date}

Confirma o lançamento? (Sim/Não)`;
}

function isYes(text) {
  const t = normAnswer(text);
  return (
    t === "sim" ||
    t === "s" ||
    t === "ss" ||
    t === "ok" ||
    t === "confirmo" ||
    t === "confirmar" ||
    t === "confirmado" ||
    t === "pode" ||
    t === "pode sim" ||
    /\bconfirm\w*\b/.test(t)
  );
}

function isNo(text) {
  const t = normAnswer(text);
  return (
    t === "nao" ||
    t === "n" ||
    t === "cancelar" ||
    t === "cancela" ||
    t === "cancelado" ||
    t === "nao quero" ||
    /\bcancel\w*\b/.test(t)
  );
}

// ======================================================================
// Monta transação + validações
// ======================================================================

function missingFields(tx) {
  const missing = [];
  if (!tx.amount || !Number.isFinite(Number(tx.amount)) || Number(tx.amount) === 0) missing.push("amount");
  if (!tx.wallet_id) missing.push("wallet");
  if (!tx.category_id && tx.category_name) missing.push("category_id");
  return missing;
}

function mergeTx(base, patch) {
  return { ...base, ...patch, frequency: patch.frequency || base.frequency || "variable" };
}

async function buildTransactionFromMessage(message, wallets, categories) {
  const msg = String(message || "").trim();
  const t = norm(msg);

  const type = /(recebi|ganhei|salario|salário|venda|vendi|freelancer|freela|entrou)/i.test(t)
    ? "income"
    : "expense";

  const amount = parseAmount(msg);

  let categoryName = findBestCategoryLocal(msg, type);

  const allowedCategoryNames =
    categories?.length
      ? categories
          .filter((c) => !c.type || norm(c.type) === norm(type))
          .map((c) => c.name)
      : null;

  if (categoryName === "Outros / Outros" && process.env.OPENAI_API_KEY) {
    categoryName = await classifyWithAI(msg, type, allowedCategoryNames);
  }

  const categoryId = resolveCategoryIdByName(categoryName, categories, type);

  const wallet = findWalletInText(msg, wallets);

  const description = inferDescription(msg, categoryName, type);

  return {
    type,
    amount: Number.isFinite(amount) ? Number(amount) : null,
    description,
    category_name: categoryName,
    category_id: categoryId,
    wallet_id: wallet?.id || null,
    wallet_name: wallet?.name || null,
    frequency: "variable",
    awaiting: null
  };
}

// ======================================================================
// Resposta (persistindo estado)
// ======================================================================

async function respond(res, key, { action, reply, tx }) {
  const isFinal = action === "confirmed" || action === "canceled";

  // Estado que o integrador deve considerar como "pendente"
  const pending_transaction = !isFinal && tx ? tx : null;

  // ✅ também devolve a transação final quando confirmar/cancelar
  const final_transaction = isFinal && tx ? tx : null;

  // Só salva estado quando realmente está aguardando algo
  if (pending_transaction && pending_transaction.awaiting) {
    await saveState(key, pending_transaction);
  } else {
    await clearState(key);
  }

  return ok(res, {
    action,
    reply,
    data: { pending_transaction, final_transaction },
    pending_transaction,
    final_transaction,
    conversation_state: pending_transaction ? { pending_transaction } : null
  });
}

// ======================================================================
// Handler
// ======================================================================

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const text = getInboundText(body);
  const wallets = getWallets(body);
  const categories = getCategories(body);

  const stateKey = buildStateKey(body);
  const messageId = String(getMessageId(body) || "");

  try {
    // 1) carrega estado persistido (se existir)
    let pending = await loadState(stateKey);

    // ✅ idempotência: ignora mensagem duplicada
    if (pending && typeof pending === "object" && pending.last_message_id && messageId) {
      if (String(pending.last_message_id) === messageId) {
        return ok(res, { action: "duplicate", reply: "", ignored: true });
      }
    }

    // ============================================================
    // A) Se existe pendência, continua o fluxo
    // ============================================================
    if (pending && typeof pending === "object" && pending.awaiting) {
      // aguardando CONTA
      if (pending.awaiting === "wallet") {
        const chosen = parseWalletSelection(text, wallets);
        if (!chosen) {
          const tx = { ...pending, last_message_id: messageId || pending.last_message_id || null };
          return respond(res, stateKey, {
            action: "need_wallet",
            reply: `Não entendi a conta 😕\n\n${buildWalletQuestion(wallets)}`,
            tx
          });
        }

        const updated = mergeTx(pending, {
          wallet_id: chosen.id,
          wallet_name: chosen.name,
          awaiting: null,
          last_message_id: messageId || pending.last_message_id || null
        });

        const miss = missingFields(updated);

        if (miss.includes("amount")) {
          updated.awaiting = "amount";
          return respond(res, stateKey, {
            action: "need_amount",
            reply: `Qual o valor de *${updated.description}*? 💰`,
            tx: updated
          });
        }

        updated.awaiting = "confirmation";
        return respond(res, stateKey, {
          action: "awaiting_confirmation",
          reply: buildConfirmationReply(updated),
          tx: updated
        });
      }

      // aguardando VALOR
      if (pending.awaiting === "amount") {
        const amount = parseAmount(text);
        if (!Number.isFinite(amount) || amount === null || amount === 0) {
          const tx = { ...pending, last_message_id: messageId || pending.last_message_id || null };
          return respond(res, stateKey, {
            action: "need_amount",
            reply: "Não entendi o valor. Pode enviar só o número? Ex: 40 ou 40,00",
            tx
          });
        }

        const updated = mergeTx(pending, {
          amount: Number(amount),
          awaiting: null,
          last_message_id: messageId || pending.last_message_id || null
        });

        const miss = missingFields(updated);

        if (miss.includes("wallet")) {
          updated.awaiting = "wallet";
          return respond(res, stateKey, {
            action: "need_wallet",
            reply: buildWalletQuestion(wallets),
            tx: updated
          });
        }

        updated.awaiting = "confirmation";
        return respond(res, stateKey, {
          action: "awaiting_confirmation",
          reply: buildConfirmationReply(updated),
          tx: updated
        });
      }

      // aguardando CONFIRMAÇÃO
      if (pending.awaiting === "confirmation") {
        if (isYes(text)) {
          const finalTx = { ...pending, awaiting: null, last_message_id: messageId || pending.last_message_id || null };
          return respond(res, stateKey, {
            action: "confirmed",
            reply: "Perfeito ✅ Lançamento confirmado.",
            tx: finalTx
          });
        }

        if (isNo(text)) {
          const canceled = { ...pending, awaiting: null, last_message_id: messageId || pending.last_message_id || null };
          return respond(res, stateKey, {
            action: "canceled",
            reply: "Certo ✅ Lançamento cancelado.",
            tx: canceled
          });
        }

        // ✅ Se não respondeu Sim/Não e parece um NOVO lançamento, reinicia sem prender no anterior
        const looksLikeNewTx =
          Number.isFinite(parseAmount(text)) ||
          /\b(paguei|gastei|comprei|recebi|ganhei|entrou)\b/i.test(String(text || ""));

        if (looksLikeNewTx) {
          await clearState(stateKey);
          // segue como mensagem nova (mesma lógica do bloco B)
          const tx = await buildTransactionFromMessage(text, wallets, categories);
          const miss = missingFields(tx);

          if (miss.includes("amount")) {
            const pendingTx = { ...tx, awaiting: "amount", last_message_id: messageId || null };
            return respond(res, stateKey, {
              action: "need_amount",
              reply: `Qual o valor de *${pendingTx.description}*? 💰`,
              tx: pendingTx
            });
          }

          if (miss.includes("wallet")) {
            const pendingTx = { ...tx, awaiting: "wallet", last_message_id: messageId || null };
            return respond(res, stateKey, {
              action: "need_wallet",
              reply: buildWalletQuestion(wallets),
              tx: pendingTx
            });
          }

          const pendingTx = { ...tx, awaiting: "confirmation", last_message_id: messageId || null };
          return respond(res, stateKey, {
            action: "awaiting_confirmation",
            reply: buildConfirmationReply(pendingTx),
            tx: pendingTx
          });
        }

        const tx = { ...pending, last_message_id: messageId || pending.last_message_id || null };
        return respond(res, stateKey, {
          action: "awaiting_confirmation",
          reply: "Responda *Sim* para confirmar ou *Não* para cancelar.",
          tx
        });
      }
    }

    // ============================================================
    // B) Sem pendência: tratar mensagem nova
    // ============================================================
    if (!text) {
      return respond(res, stateKey, {
        action: "need_more_info",
        reply: "Envie uma mensagem com o lançamento. Ex: “Paguei 50 no mercado”",
        tx: null
      });
    }

    const tx = await buildTransactionFromMessage(text, wallets, categories);
    tx.last_message_id = messageId || null;

    const miss = missingFields(tx);

    if (miss.includes("amount")) {
      const pendingTx = { ...tx, awaiting: "amount" };
      return respond(res, stateKey, {
        action: "need_amount",
        reply: `Qual o valor de *${pendingTx.description}*? 💰`,
        tx: pendingTx
      });
    }

    if (miss.includes("wallet")) {
      const pendingTx = { ...tx, awaiting: "wallet" };
      return respond(res, stateKey, {
        action: "need_wallet",
        reply: buildWalletQuestion(wallets),
        tx: pendingTx
      });
    }

    const pendingTx = { ...tx, awaiting: "confirmation" };
    return respond(res, stateKey, {
      action: "awaiting_confirmation",
      reply: buildConfirmationReply(pendingTx),
      tx: pendingTx
    });
  } catch (err) {
    console.error(err);
    return ok(res, {
      action: "error",
      reply: "Serviço temporariamente indisponível 😕"
    });
  }
}
