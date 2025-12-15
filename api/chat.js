// /api/chat.js — IA Financeira + Lovable
// Versão 2025 — Categorias Fixas + Hierarquia + Estabilidade Total

let globalContext = {};

//
// ======================================================================
// 🧠 1) DEFINIÇÃO OFICIAL DE CATEGORIAS (agrupamento + filhos + keywords)
// ======================================================================
//

const CATEGORY_TREE = {
  expense: [
    {
      group: "Moradia",
      items: [
        { name: "Aluguel", keywords: ["aluguel", "alugue"] },
        { name: "Financiamento / Prestação", keywords: ["financiamento", "prestação", "prestacao"] },
        { name: "Condomínio", keywords: ["condomínio", "condominio"] },
        { name: "IPTU", keywords: ["iptu"] }
      ]
    },

    {
      group: "Contas Essenciais",
      items: [
        { name: "Energia", keywords: ["energia", "luz", "eletricidade"] },
        { name: "Água", keywords: ["água", "agua", "cedae"] },
        { name: "Gás", keywords: ["gás", "gas", "botijão"] },
        { name: "Internet", keywords: ["internet", "wifi"] },
        { name: "Telefonia", keywords: ["telefone", "celular", "recarga", "plano"] }
      ]
    },

    {
      group: "Alimentação",
      items: [
        { name: "Supermercado", keywords: ["mercado", "supermercado", "compra do mês"] },
        { name: "Padaria", keywords: ["padaria", "pão", "pao"] },
        { name: "Açougue", keywords: ["açougue", "acougue"] },
        { name: "Feira", keywords: ["feira", "hortifruti"] },
        { name: "Restaurante", keywords: ["almoço", "jantar", "restaurante"] },
        { name: "Lanche", keywords: ["lanche", "ifood", "delivery", "burger", "pizza"] }
      ]
    },

    {
      group: "Transporte",
      items: [
        { name: "Combustível", keywords: ["gasolina", "etanol", "combustível"] },
        { name: "Estacionamento", keywords: ["estacionamento", "zona azul"] },
        { name: "Pedágio", keywords: ["pedágio", "pedagio"] },
        { name: "Manutenção Veicular", keywords: ["oficina", "mecânico", "manutenção"] },
        { name: "Seguro Auto", keywords: ["seguro auto"] },
        { name: "Transporte App / Público", keywords: ["uber", "99", "ônibus", "trem", "metrô"] }
      ]
    },

    {
      group: "Saúde",
      items: [
        { name: "Farmácia", keywords: ["farmácia", "farmacia", "remédio"] },
        { name: "Consultas", keywords: ["consulta", "dentista", "psicólogo"] },
        { name: "Exames", keywords: ["exame", "laboratório"] },
        { name: "Hospital", keywords: ["hospital"] },
        { name: "Plano de Saúde", keywords: ["plano de saúde", "unimed"] }
      ]
    },

    {
      group: "Educação",
      items: [
        { name: "Escola", keywords: ["escola", "colégio"] },
        { name: "Cursos", keywords: ["curso", "faculdade", "ingles"] },
        { name: "Material Escolar", keywords: ["material escolar", "caderno"] }
      ]
    },

    {
      group: "Lazer",
      items: [
        { name: "Cinema", keywords: ["cinema", "filme"] },
        { name: "Viagem", keywords: ["viagem", "hotel"] },
        { name: "Passeios", keywords: ["passeio", "parque", "ingresso"] },
        { name: "Streaming", keywords: ["netflix", "spotify", "prime", "disney"] }
      ]
    },

    {
      group: "Vestuário",
      items: [
        { name: "Roupas", keywords: ["roupa", "blusa", "camisa", "calça"] },
        { name: "Calçados", keywords: ["tênis", "sapato"] },
        { name: "Acessórios", keywords: ["relógio", "bolsa"] }
      ]
    },

    {
      group: "Financeiro",
      items: [
        { name: "Tarifa Bancária", keywords: ["tarifa", "taxa bancária"] },
        { name: "Anuidade Cartão", keywords: ["anuidade", "cartão de crédito"] },
        { name: "Juros", keywords: ["juros", "atraso"] },
        { name: "Multas", keywords: ["multa"] }
      ]
    },

    {
      group: "Casa & Manutenção",
      items: [
        { name: "Reforma", keywords: ["reforma", "obra", "pedreiro"] },
        { name: "Móveis", keywords: ["sofá", "cama", "mesa", "cadeira"] },
        { name: "Ferramentas", keywords: ["furadeira", "martelo"] }
      ]
    },

    {
      group: "Pets",
      items: [
        { name: "Ração", keywords: ["ração", "racao"] },
        { name: "Veterinário", keywords: ["veterinário"] },
        { name: "Higiene", keywords: ["banho e tosa", "petshop"] }
      ]
    },

    {
      group: "Outros / Diversos",
      items: [
        { name: "Presentes", keywords: ["presente"] },
        { name: "Doações", keywords: ["doação", "dizimo"] },
        { name: "Emergências", keywords: ["emergência", "imprevisto"] }
      ]
    }
  ],

  income: [
    { group: "Receita", items: [
        { name: "Salário", keywords: ["salário", "salario", "pagamento"] },
        { name: "Investimentos", keywords: ["investimento", "dividendos"] },
        { name: "Extras", keywords: ["freela", "bico", "extra"] },
        { name: "Presentes", keywords: ["presente", "ganhei"] },
        { name: "Venda", keywords: ["venda", "vendi"] },
        { name: "Empréstimo (entrada)", keywords: ["emprestimo", "entrada"] },
        { name: "Juros", keywords: ["juros"] },
        { name: "Benefícios", keywords: ["vr", "va", "benefício"] }
    ]}
  ]
};


//
// ======================================================================
// 🧪 2) FUNÇÃO DE CATEGORIZAÇÃO OFICIAL
// ======================================================================
//

function findBestCategory(text, type = "expense") {
  const list = CATEGORY_TREE[type] || [];

  let best = null;
  let bestScore = 0;

  const clean = text.toLowerCase();

  for (const group of list) {
    for (const item of group.items) {
      let score = 0;

      const itemName = item.name.toLowerCase();

      if (clean === itemName) score += 100;
      else if (clean.includes(itemName)) score += 60;

      for (const kw of item.keywords) {
        if (clean.includes(kw.toLowerCase())) {
          score += 40 + kw.length;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        best = `${group.group} / ${item.name}`;
      }
    }
  }

  return { best, score: bestScore };
}


//
// ======================================================================
// 🔍 3) DESCRIÇÃO E CARTEIRA
// ======================================================================
//

function inferDescription(msg) {
  return msg
    .replace(/(paguei|gastei|comprei|recebi|ganhei|entrou|transferi|enviei)/gi, "")
    .replace(/(\d+[.,]?\d*)/g, "")
    .trim() || "Lançamento";
}

function inferWallet(desc, wallets) {
  if (!wallets || wallets.length === 0) return null;

  const d = desc.toLowerCase();

  const w = wallets.find(w => d.includes(w.name.toLowerCase()));
  return w ? w.name : null;
}


//
// ======================================================================
// 📦 4) FORMATAÇÃO DA CONFIRMAÇÃO
// ======================================================================
//

function formatConfirmation(data) {
  const amount = Number(data.amount || 0);
  const emoji = data.type === "expense" ? "🔴 Despesa" : "🟢 Receita";
  const freq = data.frequency === "fixed" ? "Fixa" : "Variável";
  const today = new Date().toLocaleDateString("pt-BR");

  return `${emoji} | 📅 ${freq}
💰 Valor: R$ ${amount.toFixed(2)}
📝 Descrição: ${data.description}
💳 Conta: ${data.account_name}
📁 Categoria: ${data.category_name}
_${today}_

Confirma o lançamento? (Sim/Não)`;
}


//
// ======================================================================
// 🧠 5) EXTRAÇÃO DE NOVA TRANSAÇÃO
// ======================================================================
//

function extractTransaction(msg) {
  const wallets = globalContext.wallets || [];

  const type = /(recebi|ganhei|salario|entrada)/.test(msg) ? "income" : "expense";

  const amountMatch = msg.match(/(\d+[.,]?\d*)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(",", ".")) : null;

  const description = inferDescription(msg);

  const account = inferWallet(description, wallets);

  const { best: category } = findBestCategory(description, type);

  const partial = {
    type,
    amount,
    description,
    account_name: account,
    category_name: category,
    frequency: /(fixo|fixa|mensal)/.test(msg) ? "fixed" : "variable"
  };

  if (!amount) {
    return {
      needsMoreInfo: true,
      missingField: "amount",
      reply: `Qual o valor de *${description}*? 💰`,
      partial
    };
  }

  if (!account) {
    const list = wallets.map(w => `• ${w.name}`).join("\n");

    return {
      needsMoreInfo: true,
      missingField: "account_name",
      reply: `De qual conta saiu ou entrou? 💳\n\n${list}`,
      partial
    };
  }

  if (!category) {
    return {
      needsMoreInfo: true,
      missingField: "category_name",
      reply: `Qual categoria melhor representa esse lançamento?`,
      partial
    };
  }

  return {
    needsMoreInfo: false,
    fullData: partial,
    confirmation: formatConfirmation(partial)
  };
}


//
// ======================================================================
// 🧠 6) INTENÇÃO DO USUÁRIO
// ======================================================================
//

function detectIntent(msg) {
  if (/^(cancelar|cancela|esquece)$/.test(msg)) return { type: "cancel" };
  if (/^(sim|ok|confirmo)$/.test(msg)) return { type: "confirm" };
  if (/saldo/.test(msg)) return { type: "query", action: "query_balance", reply: "Calculando saldo..." };

  if (/(paguei|gastei|comprei|recebi|ganhei|entrou)/.test(msg)) {
    return { type: "transaction" };
  }

  return { type: "general" };
}


//
// ======================================================================
// 🧠 7) HANDLER PRINCIPAL
// ======================================================================
//

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, context } = req.body || {};

    globalContext = context || {};

    const pending = context?.pending_transaction || null;
    const missing = context?.missing_field || null;

    if (!message) {
      return res.status(200).json({
        reply: "Não entendi 🤔 pode repetir?",
        action: "message"
      });
    }

    const msg = message.toLowerCase().trim();

    // ⚠ Se está esperando campo faltante, tratar primeiro
    if (pending && missing) {
      const updated = { ...pending };

      if (missing === "amount") {
        const n = Number(msg.replace(",", "."));
        if (!n) {
          return res.status(200).json({
            reply: "Valor inválido. Me diga um valor real 💰",
            action: "need_more_info",
            data: { missing_field: "amount", partial_data: updated }
          });
        }
        updated.amount = n;
      }

      if (missing === "account_name") {
        updated.account_name = msg;
      }

      if (missing === "category_name") {
        const { best } = findBestCategory(msg, updated.type);
        updated.category_name = best || "Outros / Diversos";
      }

      return res.status(200).json({
        reply: formatConfirmation(updated),
        action: "awaiting_confirmation",
        data: updated
      });
    }

    // 🔍 EDIÇÃO DURANTE CONFIRMAÇÃO
    if (pending) {
      const updated = { ...pending };

      // mudar categoria
      if (msg.startsWith("categoria") || msg.includes("categoria é")) {
        const raw = msg.replace("categoria", "").replace("é", "").trim();
        const { best } = findBestCategory(raw, updated.type);
        updated.category_name = best || "Outros / Diversos";
        return res.status(200).json({
          reply: formatConfirmation(updated),
          action: "awaiting_confirmation",
          data: updated
        });
      }

      // mudar conta
      if (msg.includes("conta")) {
        updated.account_name = msg.replace("conta", "").trim();
        return res.status(200).json({
          reply: formatConfirmation(updated),
          action: "awaiting_confirmation",
          data: updated
        });
      }

      // mudar valor
      const n = Number(msg.replace(",", "."));
      if (!isNaN(n) && n > 0) {
        updated.amount = n;
        return res.status(200).json({
          reply: formatConfirmation(updated),
          action: "awaiting_confirmation",
          data: updated
        });
      }

      // mudar descrição
      if (msg.includes("descrição") || msg.includes("descricao")) {
        updated.description = msg.replace("descrição", "").replace("descricao", "").trim();
        return res.status(200).json({
          reply: formatConfirmation(updated),
          action: "awaiting_confirmation",
          data: updated
        });
      }
    }

    // 📌 Intenção
    const intent = detectIntent(msg);

    if (intent.type === "cancel") {
      return res.status(200).json({ reply: "Cancelado 👍", action: "cancelled" });
    }

    if (intent.type === "confirm") {
      if (!pending) return res.status(200).json({ reply: "Nada para confirmar.", action: "message" });
      return res.status(200).json({ reply: "Registrado! 🚀", action: "success", data: pending });
    }

    if (intent.type === "query") {
      return res.status(200).json({
        reply: intent.reply,
        action: intent.action,
        data: intent.data || {}
      });
    }

    // 🆕 Nova transação
    const parsed = extractTransaction(msg);

    if (parsed.needsMoreInfo) {
      return res.status(200).json({
        reply: parsed.reply,
        action: "need_more_info",
        data: {
          missing_field: parsed.missingField,
          partial_data: parsed.partial
        }
      });
    }

    return res.status(200).json({
      reply: parsed.confirmation,
      action: "awaiting_confirmation",
      data: parsed.fullData
    });

  } catch (err) {
    console.error("ERRO:", err);
    return res.status(500).json({
      reply: "Erro técnico 😕",
      action: "error"
    });
  }
}
