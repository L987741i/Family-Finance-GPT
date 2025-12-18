// /api/chat.js — Family Finance IA
// VERSÃO FINAL 2025
// ✔ Alinhado ao backend (success / cancelled)
// ✔ Estado consistente (pending_transaction)
// ✔ Conta obrigatória
// ✔ Categoria inteligente
// ✔ WhatsApp-safe

// ======================================================================
// 🔢 NÚMEROS POR EXTENSO (PT-BR)
// ======================================================================

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

// ======================================================================
// 🧠 CATEGORIAS INTELIGENTES
// ======================================================================

const KEYWORD_MAP = {
  // Transporte
  "uber": "Transporte / Uber / 99",
  "99": "Transporte / Uber / 99",
  "taxi": "Transporte / Uber / 99",
  "gasolina": "Transporte / Combustível",
  "onibus": "Transporte / Ônibus / Trem / Metrô",
  "metro": "Transporte / Ônibus / Trem / Metrô",

  // Alimentação
  "mercado": "Alimentação / Supermercado",
  "ifood": "Alimentação / Delivery",
  "restaurante": "Alimentação / Restaurante / Lanches fora",
  "padaria": "Alimentação / Padaria",

  // Contas
  "luz": "Contas Mensais / Energia",
  "energia": "Contas Mensais / Energia",
  "agua": "Contas Mensais / Água",
  "internet": "Contas Mensais / Internet",

  // Receita
  "salario": "Receita / Salário",
  "pagamento": "Receita / Salário"
};

function smartCategorize(description, type) {
  if (!description) return type === "income" ? "Receita / Extra" : "Outros / Outros";
  const t = description.toLowerCase();
  for (const [key, cat] of Object.entries(KEYWORD_MAP)) {
    if (t.includes(key)) return cat;
  }
  return type === "income" ? "Receita / Extra" : "Outros / Outros";
}

// ======================================================================
// 📝 DESCRIÇÃO
// ======================================================================

function cleanDescription(msg) {
  let t = msg.toLowerCase();
  t = t.replace(/(gastei|paguei|comprei|recebi|ganhei|no|na|em|com|de|para)/gi, "");
  t = t.replace(/\d+[.,]?\d*/g, "");
  Object.keys(NUMBER_WORDS).forEach(w => {
    t = t.replace(new RegExp(`\\b${w}\\b`, "gi"), "");
  });
  t = t.replace(/\b(reais|real|r\$)\b/gi, "");
  t = t.replace(/\s+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Lançamento";
}

// ======================================================================
// 💳 CONTAS
// ======================================================================

function detectWallet(msg, wallets) {
  const t = msg.toLowerCase();
  return wallets.find(w =>
    t === w.name.toLowerCase() || t.includes(w.name.toLowerCase())
  ) || null;
}

function askForWallet(wallets) {
  return `De qual conta saiu ou entrou? 💳

${wallets.map(w => `• [${w.name}]`).join("\n")}`;
}

// ======================================================================
// 📟 CONFIRMAÇÃO
// ======================================================================

function formatConfirmation(t) {
  const icon = t.type === "income" ? "🟢" : "🔴";
  const label = t.type === "income" ? "Entrada" : "Saída";

  return `${icon} *${label}* | 📅 *Variável*
💰 *Valor*: R$ ${t.amount.toFixed(2)}
📝 *Descrição*: ${t.description}
📂 *Categoria*: ${t.category}
💳 *Conta*: ${t.wallet.name}

Responda *Sim* para salvar ou *Não* para cancelar.`;
}

// ======================================================================
// 🚀 HANDLER PRINCIPAL (STATEFUL)
// ======================================================================

export default async function handler(req, res) {
  const { message, context } = req.body;
  const msg = message.trim();
  const wallets = context?.wallets || [];
  let pending = context?.pending_transaction || null;

  // ====================================================================
  // 1️⃣ BLOQUEIO TOTAL: SE EXISTE PENDÊNCIA SEM CONTA
  // ====================================================================

  if (pending && !pending.wallet) {
    const w = detectWallet(msg, wallets);

    if (w) {
      pending.wallet = w;
      if (!pending.category || pending.category === "Outros / Outros") {
        pending.category = smartCategorize(pending.description, pending.type);
      }

      return res.status(200).json({
        reply: formatConfirmation(pending),
        action: "message",
        data: { pending_transaction: pending }
      });
    }

    return res.status(200).json({
      reply: askForWallet(wallets),
      action: "message",
      data: { pending_transaction: pending }
    });
  }

  // ====================================================================
  // 2️⃣ CONFIRMAÇÃO / CANCELAMENTO (ALINHADO AO BACKEND)
  // ====================================================================

  if (pending && /^(sim|ok|confirmar?)$/i.test(msg)) {
    return res.status(200).json({
      reply: "Registrado! 🚀",
      action: "success",
      data: pending
    });
  }

  if (pending && /^(não|nao|cancelar?)$/i.test(msg)) {
    return res.status(200).json({
      reply: "Cancelado 👍",
      action: "cancelled"
    });
  }

  // ====================================================================
  // 3️⃣ NOVA TRANSAÇÃO
  // ====================================================================

  const lower = msg.toLowerCase();
  const type = /(recebi|ganhei|sal[aá]rio)/i.test(lower) ? "income" : "expense";

  const numeric = lower.match(/(\d+[.,]?\d*)/);
  const amount = numeric
    ? Number(numeric[1].replace(",", "."))
    : parseNumberFromTextPT(lower);

  if (!amount) {
    return res.status(200).json({
      reply: "Olá! 👋 Diga algo como *'Gastei 20 reais no Uber'* ou *'Recebi 100 reais'*. ",
      action: "message"
    });
  }

  const wallet = detectWallet(lower, wallets);
  const description = cleanDescription(msg);
  const category = smartCategorize(description, type);

  const transaction = {
    type,
    amount,
    description,
    category,
    wallet: wallet || null,
    frequency: "Variável"
  };

  if (!wallet) {
    return res.status(200).json({
      reply: askForWallet(wallets),
      action: "message",
      data: { pending_transaction: transaction }
    });
  }

  return res.status(200).json({
    reply: formatConfirmation(transaction),
    action: "message",
    data: { pending_transaction: transaction }
  });
}
