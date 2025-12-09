import { NextRequest, NextResponse } from "next/server";

// === CONFIGURAÇÃO PRINCIPAL DA IA ===

const SYSTEM_PROMPT = `
Você é a IA oficial do Family Finance. 
Seu papel: interpretar mensagens financeiras, responder de forma humanizada e retornar ações estruturadas.

⭐ Regras principais:
- Responda sempre de forma educada, clara e natural.
- NÃO diga "Falta: amount". Use frases naturais como:
  "Perfeito! Só me diz o valor."
- Quando precisar de mais informações, use ação: "need_more_info".
- Quando precisar confirmar, use ação: "awaiting_confirmation".
- Quando usuário confirmar, ação: "success".
- Quando usuário cancelar, ação: "cancelled".

⭐ Campos obrigatórios em transações:
- type: "expense" ou "income"
- amount (valor)
- description
- payment_method
- frequency
- optional: account_name, card_name, installments

⭐ Consultas financeiras:
Você deve detectar pedidos como:
- "quanto gastei hoje?"
- "quanto recebi hoje?"
- "quanto gastei neste mês?"
- "qual meu saldo?"
- "como está minha semana financeira?"

E retornar a ação correspondente:
- query_spent_today
- query_spent_week
- query_spent_month
- query_received_today
- query_balance

Sem você mesma calcular valores — quem calcula é o Lovable.

⭐ Exemplos:
Usuário: "quanto gastei hoje?"
Retorno esperado:
{
 "reply": "Claro! Vou verificar seus gastos de hoje.",
 "action": "query_spent_today"
}

Usuário: "quero saber meu saldo"
Retorno:
{
 "reply": "Certo! Vou verificar seu saldo atual.",
 "action": "query_balance"
}
`;


// === ROTEADOR PRINCIPAL ===

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    // interpretação da intenção
    const intent = detectIntent(message);

    // se for consulta
    if (intent.type === "query") {
      return NextResponse.json({
        reply: intent.reply,
        action: intent.action,
        data: intent.data ?? {}
      });
    }

    // cancelar
    if (intent.type === "cancel") {
      return NextResponse.json({
        reply: "Tudo certo, operação cancelada! 😊",
        action: "cancelled"
      });
    }

    // confirmação
    if (intent.type === "confirm") {
      return NextResponse.json({
        reply: "Perfeito, vou registrar isso para você 👍",
        action: "success",
        data: intent.data // virá do histórico
      });
    }

    // tentativa de registrar algo
    const extracted = extractTransaction(message);

    // faltando dados
    if (extracted.missing) {
      return NextResponse.json({
        reply: extracted.reply,
        action: "need_more_info",
        data: {
          missing_field: extracted.missing,
          partial_data: extracted.partial
        }
      });
    }

    // precisa confirmar
    return NextResponse.json({
      reply: extracted.confirmation,
      action: "awaiting_confirmation",
      data: extracted.fullData
    });

  } catch (err) {
    return NextResponse.json(
      { error: "Erro interno na IA", details: String(err) },
      { status: 500 }
    );
  }
}


// =============================================================
// 🔍 DETECÇÃO DE INTENÇÃO
// =============================================================

function detectIntent(message: string) {
  const msg = message.toLowerCase();

  // cancelar
  if (["cancelar", "cancela", "esquece", "para"].some(w => msg.includes(w))) {
    return { type: "cancel" };
  }

  // confirmação
  if (["sim", "pode", "confirma", "confirmar", "ok"].includes(msg.trim())) {
    return { type: "confirm" };
  }

  // consultas
  if (msg.includes("gastei hoje") || msg.includes("hoje gastei")) {
    return { type: "query", action: "query_spent_today", reply: "Claro! Vou verificar seus gastos de hoje." };
  }

  if (msg.includes("gastei na semana") || msg.includes("gastei essa semana")) {
    return { type: "query", action: "query_spent_week", reply: "Certo! Vou ver seus gastos desta semana." };
  }

  if (msg.includes("gastei no mês") || msg.includes("mês inteiro") || msg.includes("este mês")) {
    return { 
      type: "query", 
      action: "query_spent_month", 
      reply: "Tudo bem! Vou verificar seus gastos deste mês.",
      data: getCurrentMonth()
    };
  }

  if (msg.includes("recebi hoje") || msg.includes("entrada hoje")) {
    return { type: "query", action: "query_received_today", reply: "Vou ver suas entradas de hoje!" };
  }

  if (msg.includes("saldo") || msg.includes("minhas finanças") || msg.includes("situação financeira")) {
    return { type: "query", action: "query_balance", reply: "Claro! Vou verificar seu saldo." };
  }

  return { type: "transaction" };
}


// =============================================================
// 🧮 EXTRAÇÃO DE TRANSAÇÕES
// =============================================================

function extractTransaction(message: string) {
  const msg = message.toLowerCase();

  // tipo (despesa)
  const isExpense = /(paguei|gastei|comprei|dei|pago|custou)/.test(msg);
  const isIncome = /(recebi|ganhei|entrou|caiu)/.test(msg);

  let type: "expense" | "income" | null = null;
  if (isExpense) type = "expense";
  if (isIncome) type = "income";

  // valor
  const valueMatch = msg.match(/(\d+[.,]?\d*)/);
  const amount = valueMatch ? Number(valueMatch[1].replace(",", ".")) : null;

  // descrição
  const description = inferDescription(msg);

  // conta/cartão
  const payment_method = inferPaymentMethod(msg);

  // detectar parcelas
  const installments = inferInstallments(msg);

  // categoria sugerida
  const suggested_category_name = inferCategory(description);

  // falta informação?
  if (!amount) {
    return {
      missing: "amount",
      reply: "Perfeito! Só me diz o valor para continuar.",
      partial: { type, description, payment_method }
    };
  }

  if (!type) {
    return {
      missing: "type",
      reply: "Isso foi uma entrada ou saída?",
      partial: { amount, description }
    };
  }

  // dados completos
  const fullData = {
    type,
    amount,
    description,
    frequency: "variable",
    payment_method,
    installments,
    suggested_category_name
  };

  const confirmation =
    `Só confirmando:\n` +
    `• Tipo: ${type === "expense" ? "Despesa" : "Receita"}\n` +
    `• Valor: R$ ${amount.toFixed(2)}\n` +
    `• Descrição: ${description}\n` +
    `• Categoria sugerida: ${suggested_category_name}\n\n` +
    `Posso registrar?`;

  return { confirmation, fullData };
}


// =============================================================
// 🔧 FUNÇÕES AUXILIARES
// =============================================================

function inferDescription(msg: string) {
  const words = msg.split(" ");
  const clean = words.filter(w => !w.match(/(\d+|pix|cartão|debito|credito|vezes|x)/));
  clean.shift(); // remove verbo
  return clean.join(" ") || "Lançamento";
}

function inferPaymentMethod(msg: string) {
  if (msg.includes("pix")) return "account";
  if (msg.includes("débito") || msg.includes("debito")) return "account";
  if (/cr[eé]dito/.test(msg) && !msg.includes("x")) return "credit_card_cash";
  if (msg.includes("x") || msg.includes("parcel")) return "credit_card_installments";
  return "account";
}

function inferInstallments(msg: string) {
  const match = msg.match(/(\d+)x/);
  return match ? Number(match[1]) : null;
}

function inferCategory(description: string) {
  const desc = description.toLowerCase();

  if (/mercado|supermercado|ifood|restaurante/.test(desc)) return "Alimentação";
  if (/uber|gasolina|combustível|estacionamento/.test(desc)) return "Transporte";
  if (/luz|água|telefone|internet/.test(desc)) return "Contas Mensais";
  if (/farmácia|remédio|dentista/.test(desc)) return "Saúde";

  return "Outros";
}

function getCurrentMonth() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear()
  };
}
