// /api/chat.js — Family Finance IA
// Ajuste: Contexto Prioritário + Categorização Inteligente

// ======================================================================
// 🗂️ CATEGORIAS E PALAVRAS-CHAVE ("IA" LÓGICA)
// ======================================================================

const ALL_CATEGORIES = {
  expense: [
    "Moradia / Aluguel", "Moradia / Financiamento / Prestação", "Moradia / Condomínio", "Moradia / IPTU", "Moradia / Reformas e manutenção", "Moradia / Limpeza da casa", "Moradia / Mobília e decoração", "Moradia / Serviços domésticos",
    "Alimentação / Supermercado", "Alimentação / Açougue / Peixaria", "Alimentação / Hortifruti", "Alimentação / Padaria", "Alimentação / Delivery", "Alimentação / Restaurante / Lanches fora", "Alimentação / Água (galão / filtro)",
    "Transporte / Combustível", "Transporte / Ônibus / Trem / Metrô", "Transporte / Uber / 99", "Transporte / Estacionamento", "Transporte / Manutenção do veículo", "Transporte / Seguro do carro/moto", "Transporte / Documentação (IPVA / licenciamento)",
    "Contas Mensais / Energia", "Contas Mensais / Água", "Contas Mensais / Gás", "Contas Mensais / Internet", "Contas Mensais / Telefone", "Contas Mensais / Streaming", "Contas Mensais / Plano de celular",
    "Saúde / Plano de saúde", "Saúde / Consulta médica", "Saúde / Psicólogo / Terapia", "Saúde / Exames", "Saúde / Farmácia", "Saúde / Dentista", "Saúde / Ótica",
    "Educação / Mensalidade escolar", "Educação / Material escolar", "Educação / Cursos", "Educação / Livros", "Educação / Transporte escolar", "Educação / Faculdade",
    "Lazer / Cinema / Teatro", "Lazer / Viagens", "Lazer / Piquenique / Passeios", "Lazer / Assinaturas de jogos", "Lazer / Academia / Esportes",
    "Mercado & Casa / Produtos de higiene", "Mercado & Casa / Produtos de limpeza", "Mercado & Casa / Descartáveis", "Mercado & Casa / Utensílios domésticos", "Mercado & Casa / Pequenos reparos",
    "Compras Pessoais / Roupas", "Compras Pessoais / Calçados", "Compras Pessoais / Acessórios", "Compras Pessoais / Cosméticos", "Compras Pessoais / Celular / Eletrônicos", "Compras Pessoais / Presentes",
    "Família & Filhos / Fraldas", "Família & Filhos / Roupa infantil", "Família & Filhos / Brinquedos", "Família & Filhos / Mesada", "Família & Filhos / Saúde infantil", "Família & Filhos / Atividades infantis", "Família & Filhos / Babá / Cuidador",
    "Trabalho & Negócios / Ferramentas", "Trabalho & Negócios / Equipamentos", "Trabalho & Negócios / Uniforme", "Trabalho & Negócios / Cursos profissionais", "Trabalho & Negócios / Materiais de trabalho",
    "Impostos e Documentos / IPVA", "Impostos e Documentos / IRPF", "Impostos e Documentos / Taxas diversas", "Impostos e Documentos / Documentos pessoais",
    "Banco & Tarifas / Tarifas bancárias", "Banco & Tarifas / Anuidade cartão", "Banco & Tarifas / Juros de cartão", "Banco & Tarifas / Multas",
    "Investimentos / Aportes", "Investimentos / Tesouro Direto", "Investimentos / Renda fixa", "Investimentos / Fundos", "Investimentos / Cripto", "Investimentos / Ações",
    "Doações & Igreja / Dízimo", "Doações & Igreja / Oferta", "Doações & Igreja / Missões", "Doações & Igreja / Ajudas sociais",
    "Animais de Estimação / Ração", "Animais de Estimação / Petshop", "Animais de Estimação / Veterinário", "Animais de Estimação / Medicamentos",
    "Emergências / Saúde", "Emergências / Casa", "Emergências / Carro",
    "Outros / Outros"
  ],
  income: [
    "Receita / Salário", "Receita / Extra", "Receita / Freelancer", "Receita / Venda", "Receita / Empréstimo", "Receita / Juros", "Receita / Benefícios", "Receita / Lanche Escolar"
  ]
};

// Mapa de palavras-chave para categorias
const KEYWORD_MAP = {
  // Moradia
  "aluguel": "Moradia / Aluguel", "condominio": "Moradia / Condomínio", "iptu": "Moradia / IPTU", "faxina": "Moradia / Limpeza da casa", "reforma": "Moradia / Reformas e manutenção",
  // Alimentação
  "mercado": "Alimentação / Supermercado", "compras": "Alimentação / Supermercado", "assai": "Alimentação / Supermercado", "carrefour": "Alimentação / Supermercado", 
  "padaria": "Alimentação / Padaria", "pão": "Alimentação / Padaria", 
  "ifood": "Alimentação / Delivery", "pizza": "Alimentação / Delivery", "hamburguer": "Alimentação / Delivery",
  "restaurante": "Alimentação / Restaurante / Lanches fora", "almoço": "Alimentação / Restaurante / Lanches fora", "jantar": "Alimentação / Restaurante / Lanches fora", "mc": "Alimentação / Restaurante / Lanches fora",
  "açougue": "Alimentação / Açougue / Peixaria", "carne": "Alimentação / Açougue / Peixaria",
  // Transporte
  "gasolina": "Transporte / Combustível", "posto": "Transporte / Combustível", "etanol": "Transporte / Combustível", "abastecer": "Transporte / Combustível",
  "uber": "Transporte / Uber / 99", "99": "Transporte / Uber / 99", "taxi": "Transporte / Uber / 99", "corrida": "Transporte / Uber / 99",
  "onibus": "Transporte / Ônibus / Trem / Metrô", "metro": "Transporte / Ônibus / Trem / Metrô", "passagem": "Transporte / Ônibus / Trem / Metrô",
  "ipva": "Transporte / Documentação (IPVA / licenciamento)", "licenciamento": "Transporte / Documentação (IPVA / licenciamento)",
  // Contas
  "luz": "Contas Mensais / Energia", "energia": "Contas Mensais / Energia", "enel": "Contas Mensais / Energia", "light": "Contas Mensais / Energia",
  "agua": "Contas Mensais / Água", "sabesp": "Contas Mensais / Água", "cedae": "Contas Mensais / Água",
  "internet": "Contas Mensais / Internet", "wifi": "Contas Mensais / Internet", "vivo": "Contas Mensais / Internet", "claro": "Contas Mensais / Internet",
  "netflix": "Contas Mensais / Streaming", "spotify": "Contas Mensais / Streaming", "youtube": "Contas Mensais / Streaming", "amazon": "Contas Mensais / Streaming",
  // Saúde
  "farmacia": "Saúde / Farmácia", "remedio": "Saúde / Farmácia", "drogaria": "Saúde / Farmácia",
  "medico": "Saúde / Consulta médica", "consulta": "Saúde / Consulta médica",
  // Lazer
  "cinema": "Lazer / Cinema / Teatro", "viagem": "Lazer / Viagens", "ferias": "Lazer / Viagens", "hotel": "Lazer / Viagens",
  "academia": "Lazer / Academia / Esportes", "smartfit": "Lazer / Academia / Esportes",
  // Pets
  "ração": "Animais de Estimação / Ração", "pet": "Animais de Estimação / Petshop", "veterinario": "Animais de Estimação / Veterinário",
  // Receita
  "salario": "Receita / Salário", "pagamento": "Receita / Salário",
  "pix": "Receita / Extra", "venda": "Receita / Venda"
};

function smartCategorize(description, type) {
  if (!description) return type === 'income' ? "Receita / Extra" : "Outros / Outros";
  
  const text = description.toLowerCase();
  
  // 1. Tenta achar palavra chave
  for (const [key, category] of Object.entries(KEYWORD_MAP)) {
    if (text.includes(key)) {
      // Verifica se a categoria faz sentido com o tipo (income/expense)
      const isIncomeCat = category.startsWith("Receita");
      if ((type === 'income' && isIncomeCat) || (type === 'expense' && !isIncomeCat)) {
        return category;
      }
    }
  }

  // 2. Fallback
  return type === 'income' ? "Receita / Extra" : "Outros / Outros";
}

// ======================================================================
// 🧠 PARSERS E FORMATADORES
// ======================================================================

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const NUMBER_WORDS = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4,
  cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, cem: 100, mil: 1000
};

function parseNumberFromTextPT(text) {
  const words = text.toLowerCase().split(/\s+/);
  let total = 0, current = 0, found = false;
  for (const w of words) {
    if (NUMBER_WORDS[w] !== undefined) {
      found = true;
      const v = NUMBER_WORDS[w];
      if (v === 1000) { current = (current || 1) * 1000; total += current; current = 0; }
      else current += v;
    }
  }
  return found ? total + current : null;
}

function detectWallet(msg, wallets = []) {
  const t = msg.toLowerCase();
  // Busca exata ou parcial, retorna o OBJETO da carteira
  return wallets.find(w => t.includes(w.name.toLowerCase())) || null;
}

function cleanDescription(originalMsg, walletName, amountStr) {
  let t = originalMsg.toLowerCase();
  
  // Remove termos de comando comuns
  t = t.replace(/(paguei|gastei|comprei|recebi|ganhei|entrou|saiu|transferi|na|no|com|de|para)/gi, "");
  
  // Remove o nome da carteira se estiver na frase (ex: "almoço carteira lucas")
  if (walletName) {
    t = t.replace(new RegExp(walletName.toLowerCase(), "g"), "");
  }
  
  // Remove números e moeda
  t = t.replace(/\d+[.,]?\d*/g, "").replace(/\b(reais|real|r\$)\b/gi, "");
  
  t = t.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Lançamento Geral";
}

// ======================================================================
// 🚀 HANDLER PRINCIPAL
// ======================================================================

export default async function handler(req, res) {
  const { message, context } = req.body;
  const msg = message.trim(); // Mantém Case original para descrição, lower só para lógica

  const wallets = context?.wallets || [];
  const cards = context?.cards || []; // Suporte a cards se vier no payload
  const allAccounts = [...wallets, ...cards];
  
  let pending = context?.pending_transaction || null;

  // ===============================================================
  // 1️⃣ PRIORIDADE: CHECAR SE É RESPOSTA DE CONTEXTO (PENDÊNCIA)
  // ===============================================================
  
  if (pending && pending.wallet === null) {
    // Estamos esperando a conta. O usuário respondeu algo.
    const foundWallet = detectWallet(msg, allAccounts);
    
    if (foundWallet) {
      // ✅ Usuário respondeu a conta corretamente.
      pending.wallet = foundWallet;
      
      // Se a descrição ainda não foi categorizada ou era genérica, tenta melhorar agora
      if (!pending.category || pending.category === "Outros / Outros") {
        pending.category = smartCategorize(pending.description, pending.type);
      }

      return res.json({
        reply: buildConfirmationMessage(pending),
        action: "awaiting_confirmation",
        data: { pending_transaction: pending }
      });
    } 
    // Se não achou conta, mas o usuário digitou algo, pode ser que ele esteja tentando 
    // cancelar ou começar do zero. Se parece comando novo, o código segue.
    // Se não parece comando novo, insistimos na conta.
    const isNewCommand = /(gastei|recebi|paguei|compra|venda)/i.test(msg);
    if (!isNewCommand) {
       return res.json({
        reply: `Não encontrei essa conta. 😅\n\nDe qual conta saiu ou entrou? 💳\n${allAccounts.map(w => `• [${w.name}]`).join("\n")}`,
        action: "need_wallet",
        data: { pending_transaction: pending }
      });
    }
  }

  // ===============================================================
  // 2️⃣ EDIÇÃO E CONFIRMAÇÃO (SIM/NÃO)
  // ===============================================================

  if (pending && /(sim|confirma|ok|pode ser)/i.test(msg)) {
     // Aqui você acionaria o salvamento real no banco (webhook externo cuidará disso)
     // Por enquanto retornamos ação 'save'
     return res.json({
       reply: "Lançamento salvo com sucesso! ✅",
       action: "save_transaction",
       data: pending
     });
  }

  if (pending && /(não|cancelar|esquece)/i.test(msg)) {
    return res.json({
      reply: "Cancelado. 🗑️",
      action: "cancel_transaction",
      data: null // Limpa pendencia
    });
  }

  // ===============================================================
  // 3️⃣ NOVA TRANSAÇÃO (EXTRACT)
  // ===============================================================

  // Se chegou aqui, é uma nova intenção (ou substituição da anterior)
  const msgLower = msg.toLowerCase();
  const type = /(recebi|ganhei|sal[aá]rio|venda|entrada|deposito)/i.test(msgLower) ? "income" : "expense";
  
  // Extração de Valor
  const numericMatch = msgLower.match(/(\d+[.,]?\d*)/);
  const amount = numericMatch 
    ? Number(numericMatch[1].replace(",", ".")) 
    : parseNumberFromTextPT(msgLower);

  // Se não tem valor e não tem contexto, é conversa fiada
  if (!amount) {
     return res.json({ reply: "Olá! 👋 Diga algo como 'Gastei 20 reais no Uber' ou 'Recebi 100 reais'." });
  }

  // Tenta achar conta na frase inicial
  const wallet = detectWallet(msgLower, allAccounts);
  
  // Limpa a descrição (tira valor, tira nome da conta se houver)
  const description = cleanDescription(msg, wallet?.name, numericMatch?.[0]);
  
  // Tenta categorizar automaticamente
  const category = smartCategorize(description, type);

  const newTransaction = {
    type,
    amount,
    description,
    category,
    wallet: wallet || null,
    frequency: "Variável" // Default
  };

  // 4️⃣ VERIFICAÇÃO FINAL: FALTOU ALGO?

  if (!newTransaction.wallet) {
    return res.json({
      reply: `De qual conta saiu ou entrou? 💳\n\n${allAccounts.map(w => `• [${w.name}]`).join("\n")}`,
      action: "need_wallet",
      data: { pending_transaction: newTransaction }
    });
  }

  // Tudo certo? Pede confirmação
  return res.json({
    reply: buildConfirmationMessage(newTransaction),
    action: "awaiting_confirmation",
    data: { pending_transaction: newTransaction }
  });
}

// ======================================================================
// 📟 FORMATADOR DE MENSAGEM FINAL
// ======================================================================

function buildConfirmationMessage(t) {
  const icon = t.type === 'income' ? '🟢' : '🔴';
  const typeName = t.type === 'income' ? 'Entrada' : 'Saída';
  
  return `${icon} *${typeName}* |  📅 *${t.frequency}*
💰 *Valor*: ${formatCurrency(t.amount)}
📝 *Descrição*: ${t.description}
💳 *Conta*: ${t.wallet?.name || '---'}
📂 *Categoria*: ${t.category}

Responda *Sim* para salvar ou *Não* para cancelar.`;
}
