import OpenAI from "openai";

function naturalMissingFieldMessage(missingField, extracted) {
  switch (missingField) {
    case "amount":
      if (extracted.description)
        return `Certo! E qual foi o valor de *${extracted.description}*? 😊`;
      return "Perfeito! Pode me dizer o valor?";
    case "description":
      return "Legal! Qual foi a descrição dessa transação?";
    default:
      return "Pode me informar o que falta?";
  }
}

const categoryMapping = [
  { regex: /(mercado|supermercado|padaria|ifood|almoço|restaurante|pizza|lanche)/i, category: "Alimentação" },
  { regex: /(uber|99|gasolina|combustível|estacionamento|pedágio)/i, category: "Transporte" },
  { regex: /(netflix|spotify|disney|prime|assinatura|mensalidade|luz|água|gás|internet)/i, category: "Contas Mensais" },
  { regex: /(farmácia|remédio|dentista|consulta|hospital|exame)/i, category: "Saúde" },
  { regex: /(ração|pet|veterinário)/i, category: "Pets" },
  { regex: /(aluguel|iptu|financiamento|condomínio)/i, category: "Moradia" }
];

function detectCategory(text) {
  for (const item of categoryMapping) {
    if (item.regex.test(text)) return item.category;
  }
  return null;
}

function detectInstallments(text) {
  const match = text.match(/(\d+)[xX]/);
  return match ? parseInt(match[1], 10) : null;
}

function detectAmount(text) {
  const match = text.replace(",", ".").match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function detectType(text) {
  if (/recebi|ganhei|entrou|salário|caixa positivo/i.test(text)) return "income";
  return "expense";
}

function detectPaymentMethod(text) {
  if (/pix|débito|dinheiro|transfer/i.test(text)) return "account";
  if (/cartão/i.test(text) && detectInstallments(text)) return "credit_card_installments";
  if (/cartão|crédito/i.test(text)) return "credit_card_cash";
  return "account";
}

function detectFrequency(text) {
  if (/mensalidade|aluguel|plano|assinatura|fixo/i.test(text)) return "fixed";
  return "variable";
}

function extractDescription(text) {
  return text
    .replace(/\d+x?/gi, "")
    .replace(/pix|débito|crédito|dinheiro|transferência/gi, "")
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(200).json({
        reply: "Opa! Pode me explicar o que você quer registrar? 😊",
        action: "error"
      });
    }

    if (/cancelar|cancela|esquece/i.test(message)) {
      return res.status(200).json({
        reply: "Sem problema! Ação cancelada 👍",
        action: "cancelled"
      });
    }

    const extracted = {
      type: detectType(message),
      amount: detectAmount(message),
      description: extractDescription(message),
      frequency: detectFrequency(message),
      payment_method: detectPaymentMethod(message),
      installments: detectInstallments(message),
      suggested_category_name: detectCategory(message)
    };

    const missingFields = [];
    if (!extracted.amount) missingFields.push("amount");
    if (!extracted.description || extracted.description.length < 2)
      missingFields.push("description");

    if (missingFields.length > 0) {
      const msg = naturalMissingFieldMessage(missingFields[0], extracted);

      return res.status(200).json({
        reply: msg,
        action: "need_more_info",
        data: {
          missing_fields: missingFields,
          partial_data: extracted
        }
      });
    }

    const confirmationText =
      `Perfeito! Entendi que foi:\n\n` +
      `• ${extracted.type === "income" ? "🟢 Receita" : "🔴 Despesa"}\n` +
      `• 💰 R$ ${extracted.amount.toFixed(2)}\n` +
      `• 📝 ${extracted.description}\n` +
      `• 📁 Categoria: ${extracted.suggested_category_name || "Não detectada"}\n` +
      `• 💳 Pagamento: ${extracted.payment_method}\n` +
      (extracted.installments ? `• 🔢 Parcelado em ${extracted.installments}x\n` : "") +
      `\nPosso registrar isso? (sim / não)`;

    if (/^sim$|confirmo|pode registrar/i.test(message)) {
      return res.status(200).json({
        reply: "Prontinho! Lançamento registrado com sucesso 🎯",
        action: "success",
        data: extracted
      });
    }

    return res.status(200).json({
      reply: confirmationText,
      action: "awaiting_confirmation",
      data: extracted
    });

  } catch (error) {
    console.error("Erro na IA:", error);

    return res.status(500).json({
      reply: "Poxa, aconteceu algo inesperado aqui 😕. Pode tentar novamente?",
      action: "error"
    });
  }
}
