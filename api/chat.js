// /api/chat.js — versão FINAL com conta + categoria obrigatórias e data ✨
// 100% compatível com Vercel Serverless (ESM)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { message, context } = req.body || {};

    if (!message || typeof message !== "string") {
      res.status(200).json({
        reply: "Hmm… não entendi 🤔 Pode tentar dizer de outro jeito?",
        action: "message"
      });
      return;
    }

    const intent = detectIntent(message);

    // CANCELAR
    if (intent.type === "cancel") {
      res.status(200).json({
        reply: "Tudo bem, operação cancelada 👍",
        action: "cancelled"
      });
      return;
    }

    // CONSULTAS
    if (intent.type === "query") {
      res.status(200).json({
        reply: intent.reply,
        action: intent.action,
        data: intent.data || {}
      });
      return;
    }

    // CONFIRMAR
    if (intent.type === "confirm") {
      const pending = context?.pending_transaction;

      if (!pending) {
        res.status(200).json({
          reply: "Não encontrei nada pra confirmar 🤔 Me diga novamente?",
          action: "message"
        });
        return;
      }

      res.status(200).json({
        reply: "Perfeito! Vou registrar isso agora 🎯",
        action: "success",
        data: pending
      });
      return;
    }

    // NOVA TRANSAÇÃO
    if (intent.type === "transaction") {
      const parsed = extractTransaction(message);

      if (parsed.needsMoreInfo) {
        res.status(200).json({
          reply: parsed.reply,
          action: "need_more_info",
          data: parsed.data
        });
        return;
      }

      res.status(200).json({
        reply: parsed.confirmation,
        action: "awaiting_confirmation",
        data: parsed.fullData
      });
      return;
    }

    // GENÉRICO
    res.status(200).json({
      reply:
        "Oi! Sou sua IA financeira ✨\n" +
        "Pode me enviar algo como:\n" +
        "• “paguei 20 no lanche”\n" +
        "• “recebi 120 de salário”\n" +
        "• “quanto gastei hoje?”\n",
      action: "message"
    });

  } catch (err) {
    console.error("Erro IA externa:", err);

    res.status(500).json({
      reply: "Ops! Tive um problema técnico 😕 Tenta novamente?",
      action: "error",
      details: String(err)
    });
  }
}



// ============================================================
// CONFIGURAÇÕES
// ============================================================
const FAMILY_ACCOUNTS = ["carteira", "nubank", "bb", "itau", "caixa"];
const CATEGORY_LIST = [
  "Alimentação",
  "Transporte",
  "Saúde",
  "Casa",
  "Lazer",
  "Educação",
  "Mercado",
  "Outros"
];



// ============================================================
// DETECTAR INTENÇÃO
// ============================================================
function detectIntent(message) {
  const msg = message.toLowerCase().trim();

  if (/(cancelar|cancela|esquece)/.test(msg)) return { type: "cancel" };

  if (/^(sim|confirmo|ok|pode|pode registrar)$/.test(msg))
    return { type: "confirm" };

  if (/quanto gastei hoje/.test(msg))
    return {
      type: "query",
      action: "query_spent_today",
      reply: "Claro! Vou verificar seus gastos de hoje 💸"
    };

  if (/gastei no mês|gastos do mês/.test(msg)) {
    const now = new Date();
    return {
      type: "query",
      action: "query_spent_month",
      reply: "Beleza! Vou analisar seu mês 📊",
      data: { month: now.getMonth() + 1, year: now.getFullYear() }
    };
  }

  if (/saldo|minhas finanças/.test(msg))
    return {
      type: "query",
      action: "query_balance",
      reply: "Vou calcular seu saldo geral 💼✨"
    };

  if (/(paguei|gastei|comprei|usei|recebi|entrou|ganhei)/.test(msg))
    return { type: "transaction" };

  return { type: "general" };
}



// ============================================================
// EXTRAIR A TRANSAÇÃO
// ============================================================
function extractTransaction(message) {
  const msg = message.toLowerCase();

  // Tipo
  const type =
    /(recebi|ganhei|entrou)/.test(msg)
      ? "income"
      : /(paguei|gastei|comprei|usei|dei)/.test(msg)
      ? "expense"
      : null;

  // Valor
  const amountMatch = msg.match(/(\d+[.,]?\d*)/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : null;

  // Descrição
  const description = inferDescription(msg);

  // Método de pagamento
  const payment_method = inferPaymentMethod(msg);

  // Parcelas
  const installments = inferInstallments(msg);

  // Conta (pode faltar)
  const account_name = inferAccount(msg);

  // Categoria (pode faltar)
  const category_name = inferCategory(description);

  // Data
  const date = inferDate(msg);

  // 1️⃣ Faltou valor
  if (!amount) {
    return {
      needsMoreInfo: true,
      reply: `Perfeito! Só me diz o valor de *${description}* 💵`,
      data: { missing_field: "amount" }
    };
  }

  // 2️⃣ Faltou conta → sempre perguntar!
  if (!account_name) {
    return {
      needsMoreInfo: true,
      reply:
        "Só mais uma coisa 😉 Qual conta você usou?\n\n" +
        "Contas disponíveis:\n" +
        FAMILY_ACCOUNTS.map(acc => `• ${acc}`).join("\n"),
      data: { missing_field: "account_name" }
    };
  }

  // 3️⃣ Faltou categoria → perguntar sempre
  if (!category_name || category_name === "Outros") {
    return {
      needsMoreInfo: true,
      reply:
        "E qual categoria melhor representa esse lançamento? 🗂️\n\n" +
        CATEGORY_LIST.map(c => `• ${c}`).join("\n"),
      data: { missing_field: "category_name" }
    };
  }

  // Dados completos
  const fullData = {
    type,
    amount,
    description,
    payment_method,
    installments,
    account_name,
    category_name,
    date,
    frequency: "variable"
  };

  // Confirmação
  const confirmation =
    `Vamos revisar tudo 👇\n\n` +
    `🔴 Tipo: ${type === "expense" ? "Despesa" : "Entrada"}\n` +
    `💰 Valor: R$ ${amount.toFixed(2)}\n` +
    `📝 Descrição: ${description}\n` +
    `💳 Conta: ${account_name}\n` +
    `📁 Categoria: ${category_name}\n` +
    `📅 Data: ${date}\n\n` +
    `Confirma o lançamento? Responda *SIM* ou *NÃO*.`;

  return {
    needsMoreInfo: false,
    fullData,
    confirmation
  };
}



// ============================================================
// HELPER FUNCTIONS
// ============================================================
function inferDescription(msg) {
  const clean = msg
    .replace(/(paguei|gastei|comprei|usei|dei|recebi|ganhei|entrou)/g, "")
    .replace(/(\d+[.,]?\d*)/g, "")
    .replace(/(pix|debito|débito|credito|crédito|cartão)/g, "")
    .trim();

  return clean || "Lançamento";
}

function inferPaymentMethod(msg) {
  if (/pix|dinheiro|débito|debito/.test(msg)) return "account";
  if (/cart[aã]o/.test(msg) && /\d+x/.test(msg)) return "credit_card_installments";
  if (/cart[aã]o|cr[eé]dito/.test(msg)) return "credit_card_cash";
  return "account";
}

function inferInstallments(msg) {
  const match = msg.match(/(\d+)x/);
  return match ? parseInt(match[1]) : null;
}

function inferAccount(msg) {
  for (const acc of FAMILY_ACCOUNTS) {
    if (msg.includes(acc)) return acc;
  }
  return null; // força a IA a perguntar
}

function inferCategory(desc) {
  if (/lanche|comida|almoço|janta/.test(desc)) return "Alimentação";
  if (/mercado|supermercado/.test(desc)) return "Mercado";
  if (/uber|gasolina|combustivel/.test(desc)) return "Transporte";
  if (/farmacia|remedio/.test(desc)) return "Saúde";
  return null; // força perguntar categoria
}

function inferDate(msg) {
  const now = new Date();

  if (msg.includes("hoje")) return now.toISOString().slice(0, 10);
  if (msg.includes("agora")) return now.toISOString().slice(0, 10);

  if (msg.includes("ontem")) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  return now.toISOString().slice(0, 10);
}
