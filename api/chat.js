// /api/chat.js — IA Financeira + Lovable
// Versão 2025 — Corrigida (Bug Contexto + Frequência)

let globalContext = {};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, context } = req.body || {};

    globalContext = context || {};
    const pending = context?.pending_transaction || null;
    const missing = context?.missing_field || null;

    if (!message || typeof message !== "string") {
      return res.status(200).json({
        reply: "Não entendi 🤔 pode repetir?",
        action: "message"
      });
    }

    const msgLower = message.toLowerCase().trim();

    // ======================================================================
    // 1) CONTINUAÇÃO DE CAMPO FALTANTE
    // ======================================================================
    if (pending && missing) {
      const updated = { ...pending };

      // (A) Valor Faltante
      if (missing === "amount") {
        const parsed = Number(message.replace(",", "."));
        if (!parsed || isNaN(parsed)) {
          return res.status(200).json({
            reply: "Me diga um valor válido 💰",
            action: "need_more_info",
            data: { missing_field: "amount", partial_data: updated }
          });
        }
        updated.amount = parsed;
      }

      // (B) Conta Faltante
      if (missing === "account_name") {
        // CORREÇÃO DE SEGURANÇA: Se o usuário tentar mudar a categoria enquanto a IA pede a conta
        if (msgLower.startsWith("categoria") || msgLower.includes("muda categoria")) {
           // Ignora o preenchimento da conta com esse texto e trata como edição normal abaixo
           // (Ao cair no return null ou deixar passar, precisamos forçar a lógica a seguir ou pedir a conta de novo)
           // Melhor abordagem: Avisar o usuário ou tentar processar.
           // Neste caso, vamos assumir que se ele digitou "Categoria X", ele quer pular a conta ou errou.
           // Vamos deixar passar para a Edição Inteligente limpando o missing field manualmente aqui se for comando.
        } else {
           updated.account_name = msgLower;
        }
      }

      // (C) Categoria Faltante
      if (missing === "category_name") {
        updated.category_name = msgLower;
      }

      // (D) Tipo Faltante
      if (missing === "type") {
        if (msgLower.includes("entrada") || msgLower.includes("receita")) {
          updated.type = "income";
        } else if (
          msgLower.includes("saída") ||
          msgLower.includes("saida") ||
          msgLower.includes("despesa")
        ) {
          updated.type = "expense";
        } else {
          return res.status(200).json({
            reply: "Isso foi *entrada* ou *saída*? 🤔",
            action: "need_more_info",
            data: { missing_field: "type", partial_data: updated }
          });
        }
      }

      // Se processou o campo, envia confirmação e LIMPA o missing_field
      return sendConfirmation(res, updated);
    }

    // ======================================================================
    // 2) EDIÇÃO INTELIGENTE DURANTE CONFIRMAÇÃO
    // ======================================================================
    if (pending) { // Removida a verificação !missing pois o fluxo acima já trata ou resolve
      const updated = { ...pending };
      const text = msgLower;

      // ---------------------------------------------------------------
      // (A) FREQUÊNCIA
      // ---------------------------------------------------------------
      const isFreqFixa = ["fixa", "fixo", "é fixa", "frequência fixa", "mensal"].some(t => text.includes(t));
      const isFreqVariavel = ["variável", "variavel", "é variável", "eventual"].some(t => text.includes(t));

      if (isFreqFixa) {
        updated.frequency = "fixed";
        return sendConfirmation(res, updated);
      }
      if (isFreqVariavel) {
        updated.frequency = "variable";
        return sendConfirmation(res, updated);
      }

      // ---------------------------------------------------------------
      // (B) MUDAR CATEGORIA
      // ---------------------------------------------------------------
      if (
        text.startsWith("categoria") ||
        text.includes("categoria é") ||
        text.includes("muda categoria") ||
        text.includes("troca categoria") ||
        text.includes("coloca categoria") ||
        text.includes("pra categoria")
      ) {
        const newCategory = text
          .replace("categoria é", "")
          .replace("categoria", "")
          .replace("muda", "")
          .replace("troca", "")
          .replace("coloca", "")
          .replace("pra", "")
          .replace("para", "")
          .trim();

        if (newCategory.length > 0) {
          updated.category_name = newCategory;
          return sendConfirmation(res, updated);
        }
      }

      // Categoria enviada sozinha (Ex: "Alimentação")
      if (
        text.split(" ").length === 1 &&
        text.length <= 20 &&
        !["sim", "não", "nao", "ok", "confirmar", "cancelar"].includes(text)
      ) {
        updated.category_name = text;
        return sendConfirmation(res, updated);
      }

      // ---------------------------------------------------------------
      // (C) MUDAR CONTA
      // ---------------------------------------------------------------
      if (
        text.startsWith("conta") ||
        text.includes("troca conta") ||
        text.includes("muda conta") ||
        text.includes("usa conta") ||
        text.includes("no banco") ||
        text.includes("na carteira")
      ) {
        const newAcc = text
          .replace("conta", "")
          .replace("troca", "")
          .replace("muda", "")
          .replace("usa", "")
          .replace("coloca", "")
          .replace("na carteira", "carteira") // Ajuste fino
          .replace("no banco", "banco")
          .trim();

        if (newAcc.length > 0) {
          updated.account_name = newAcc;
          return sendConfirmation(res, updated);
        }
      }

      // ---------------------------------------------------------------
      // (D) MUDAR DESCRIÇÃO
      // ---------------------------------------------------------------
      if (text.includes("descrição") || text.includes("descricao")) {
        const newDesc = text
          .replace("descrição", "")
          .replace("descricao", "")
          .replace("muda", "")
          .replace("troca", "")
          .replace("é", "")
          .trim();

        if (newDesc.length > 0) {
          updated.description = newDesc;
          return sendConfirmation(res, updated);
        }
      }
    }

    // ======================================================================
    // 3) INTENÇÃO DO USUÁRIO
    // ======================================================================
    const intent = detectIntent(msgLower);

    if (intent.type === "cancel") {
      return res.status(200).json({
        reply: "Tudo certo 👍 operação cancelada!",
        action: "cancelled"
      });
    }

    if (intent.type === "confirm") {
      if (!pending) {
        return res.status(200).json({
          reply: "Não encontrei nada para confirmar 🤔",
          action: "message"
        });
      }

      return res.status(200).json({
        reply: "Perfeito! Registrando agora 🚀",
        action: "success",
        data: pending
      });
    }

    if (intent.type === "query") {
      return res.status(200).json({
        reply: intent.reply,
        action: intent.action,
        data: intent.data || {}
      });
    }

    // ======================================================================
    // 4) NOVA TRANSAÇÃO
    // ======================================================================
    const parsed = extractTransaction(msgLower);

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
    console.error("Erro na IA Financeira:", err);
    return res.status(500).json({
      reply: "Ops! Tive um problema técnico 😕 tente novamente.",
      action: "error"
    });
  }
}

// ======================================================================
// FUNÇÕES AUXILIARES
// ======================================================================

function sendConfirmation(res, data) {
  // CORREÇÃO CRÍTICA:
  // Forçamos missing_field: null para limpar o estado anterior.
  // Assim, a próxima mensagem não cairá no bloco de "Campo Faltante".
  const responseData = { ...data, missing_field: null };

  return res.status(200).json({
    reply: formatConfirmation(data),
    action: "awaiting_confirmation",
    data: responseData
  });
}

function detectIntent(msg) {
  if (/^(cancelar|cancela|esquece|abortar)$/.test(msg)) return { type: "cancel" };
  if (/^(sim|pode|ok|confirmo|tá certo|ta certo|isso)$/.test(msg)) return { type: "confirm" };

  if (/quanto gastei hoje/.test(msg))
    return { type: "query", action: "query_spent_today", reply: "Verificando seus gastos de hoje 💸" };

  if (/gastei na semana/.test(msg))
    return { type: "query", action: "query_spent_week", reply: "Analisando seus gastos da semana 📅" };

  if (/gastei no mês/.test(msg)) {
    const now = new Date();
    return {
      type: "query",
      action: "query_spent_month",
      reply: "Conferindo seus gastos do mês 📊",
      data: { month: now.getMonth() + 1, year: now.getFullYear() }
    };
  }

  if (/saldo/.test(msg))
    return { type: "query", action: "query_balance", reply: "Calculando seu saldo geral 💼" };

  if (/(paguei|gastei|comprei|recebi|ganhei|entrou|transferi|enviei)/.test(msg))
    return { type: "transaction" };

  return { type: "general" };
}

function extractTransaction(msg) {
  const wallets = globalContext.wallets || [];
  const categories = globalContext.categories || [];

  const type =
    /(recebi|ganhei|entrou|salario|sálário)/.test(msg)
      ? "income"
      : /(paguei|gastei|comprei|custou|transferi|enviei)/.test(msg)
      ? "expense"
      : null;

  const amountMatch = msg.match(/(\d+[.,]?\d*)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(",", ".")) : null;

  // CORREÇÃO: Detectar frequência na primeira mensagem
  const isFixed = /(fixo|fixa|mensal|recorrente)/i.test(msg);
  const frequency = isFixed ? "fixed" : "variable";

  const description = inferDescription(msg);

  const account = inferWallet(description, wallets);
  const { category, suggestions } = guessCategory(description, categories);

  const partial = {
    type,
    amount,
    description,
    account_name: account,
    category_name: category,
    frequency: frequency // Usa a frequência detectada
  };

  if (!amount) {
    return {
      needsMoreInfo: true,
      missingField: "amount",
      reply: `Qual foi o valor de *${description}*? 💰`,
      partial
    };
  }

  if (!type) {
    return {
      needsMoreInfo: true,
      missingField: "type",
      reply: "Isso foi *entrada* ou *saída*? 🤔",
      partial
    };
  }

  if (!account) {
    const list = wallets.map(w => `• ${w.name}`).join("\n");
    return {
      needsMoreInfo: true,
      missingField: "account_name",
      reply: `Certo! Agora me diga de qual conta saiu ou entrou:\n\n${list}`,
      partial
    };
  }

  if (!category) {
    // Se não achou categoria, mas temos sugestões, perguntamos
    if (suggestions && suggestions.length >= 2) {
      return {
        needsMoreInfo: true,
        missingField: "category_name",
        reply: `A categoria desse lançamento é *${suggestions[0]}* ou *${suggestions[1]}*?`,
        partial
      };
    }
    // Caso contrário, pede genérico
    const list = categories.map(c => `• ${c.name}`).join("\n");
    return {
      needsMoreInfo: true,
      missingField: "category_name",
      reply: `Escolha uma categoria:\n\n${list}`,
      partial
    };
  }

  const fullData = { ...partial };

  return {
    needsMoreInfo: false,
    fullData,
    confirmation: formatConfirmation(fullData)
  };
}

function guessCategory(desc, categories) {
  if (!categories || categories.length === 0) {
    return { category: null, suggestions: [] };
  }

  const text = desc.toLowerCase();

  const direct = categories.find(c =>
    text.includes(String(c.name).toLowerCase())
  );
  if (direct) return { category: direct.name, suggestions: [] };

  const map = [
    { cat: "Supermercado", words: ["mercado", "supermercado", "compra do mês"] },
    { cat: "Padaria", words: ["padaria", "pão", "pao"] },
    { cat: "Delivery", words: ["ifood", "delivery", "lanche", "restaurante"] },
    { cat: "Combustível", words: ["gasolina", "combustível", "etanol"] },
    { cat: "Uber / 99", words: ["uber", "99", "corrida"] },
    { cat: "Energia", words: ["luz", "energia"] },
    { cat: "Água", words: ["água", "agua"] },
    { cat: "Gás", words: ["gás", "gas"] },
    { cat: "Internet", words: ["internet", "wifi"] },
    { cat: "Plano de celular", words: ["plano", "recarga", "telefone"] },
    { cat: "Farmácia", words: ["farmácia", "farmacia", "remédio", "remedio"] },
    { cat: "Educação", words: ["escola", "faculdade", "curso"] },
    { cat: "Academia / Esportes", words: ["academia", "musculação", "treino"] },
    { cat: "Roupas", words: ["roupa", "camisa", "calça"] },
    { cat: "Calçados", words: ["tênis", "tenis", "sapato"] },
    { cat: "Ração", words: ["ração", "racao"] },
    { cat: "Salário", words: ["salário", "salario"] },
    { cat: "Venda", words: ["venda", "vendi"] },
    { cat: "Extra", words: ["extra", "freela", "bico"] }
  ];

  const candidates = [];

  for (const item of map) {
    if (item.words.some(w => text.includes(w))) {
      const found = categories.find(
        c => String(c.name).toLowerCase() === item.cat.toLowerCase()
      );
      if (found) candidates.push(found.name);
    }
  }

  if (candidates.length === 0) return { category: null, suggestions: [] };
  if (candidates.length === 1) return { category: candidates[0], suggestions: [] };

  return { category: null, suggestions: [...new Set(candidates)] };
}

function formatConfirmation(data) {
  const amount = Number(data.amount || 0);
  const emoji = data.type === "expense" ? "🔴 Despesa" : "🟢 Receita";
  const freq = data.frequency === "fixed" ? "Fixa" : "Variável";
  const today = new Date().toLocaleDateString("pt-BR");

  return `${emoji} | 📅 ${freq}
💰 Valor: R$ ${amount.toFixed(2)}
📝 Descrição: ${data.description || "-"}
💳 Conta: ${data.account_name || "-"}
📁 Categoria: ${data.category_name || "-"}
_${today}_

Confirma o lançamento? Responda *SIM* ou *NÃO*.`;
}

function inferDescription(msg) {
  return (
    msg
      .replace(/(paguei|gastei|comprei|recebi|ganhei|entrou|transferi|enviei)/g, "")
      .replace(/(\d+[.,]?\d*)/g, "")
      // Removemos palavras de frequência da descrição para ficar mais limpo
      .replace(/(fixo|fixa|mensal|recorrente|variável|variavel)/gi, "")
      .trim() || "Lançamento"
  );
}

function inferWallet(desc, wallets) {
  if (!wallets || wallets.length === 0) return null;
  const d = desc.toLowerCase();
  const found = wallets.find(w =>
    d.includes(String(w.name).toLowerCase())
  );
  return found ? found.name : null;
}
