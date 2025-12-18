// /api/chat.js — Family Finance IA
// VERSÃO FINAL MERGEADA & OTIMIZADA
// ✔ Contexto (Junta info nova com antiga)
// ✔ Categorização Inteligente (Palavras-chave + Fallback)
// ✔ Consultas (Extrato/Faturas)
// ✔ Personalidade & Formatação Solicitada

// ======================================================================
// 🗂️ 1. LISTAS E CONFIGURAÇÕES
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

// Mapeamento para IA Simplificada
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
  "luz": "Contas Mensais / Energia", "energia": "Contas Mensais / Energia", "enel": "Contas Mensais / Energia",
  "agua": "Contas Mensais / Água", "sabesp": "Contas Mensais / Água",
  "internet": "Contas Mensais / Internet", "wifi": "Contas Mensais / Internet", "vivo": "Contas Mensais / Internet", "claro": "Contas Mensais / Internet",
  "netflix": "Contas Mensais / Streaming", "spotify": "Contas Mensais / Streaming", "amazon": "Contas Mensais / Streaming",
  // Saúde
  "farmacia": "Saúde / Farmácia", "remedio": "Saúde / Farmácia", "drogaria": "Saúde / Farmácia",
  "medico": "Saúde / Consulta médica", "consulta": "Saúde / Consulta médica",
  // Lazer
  "cinema": "Lazer / Cinema / Teatro", "viagem": "Lazer / Viagens", "ferias": "Lazer / Viagens",
  "academia": "Lazer / Academia / Esportes", "smartfit": "Lazer / Academia / Esportes",
  // Pets
  "ração": "Animais de Estimação / Ração", "pet": "Animais de Estimação / Petshop", "veterinario": "Animais de Estimação / Veterinário",
  // Receita
  "salario": "Receita / Salário", "pagamento": "Receita / Salário",
  "pix": "Receita / Extra", "venda": "Receita / Venda"
};

const NUMBER_WORDS = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4,
  cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, cem: 100, mil: 1000
};

// ======================================================================
// 🧠 2. FUNÇÕES AUXILIARES (Detectores e Formatadores)
// ======================================================================

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

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

// Detecta Carteiras (Wallets) ou Cartões (Cards)
function detectWallet(msg, allAccounts = []) {
  const t = msg.toLowerCase();
  return allAccounts.find(w => t.includes(w.name.toLowerCase())) || null;
}

// Lógica inteligente para definir categoria
function smartCategorize(description, type) {
  if (!description) return type === 'income' ? "Receita / Extra" : "Outros / Outros";
  const text = description.toLowerCase();
  
  // 1. Tenta achar palavra chave
  for (const [key, category] of Object.entries(KEYWORD_MAP)) {
    if (text.includes(key)) {
      // Verifica consistência (Entrada vs Saída)
      const isIncomeCat = category.startsWith("Receita");
      if ((type === 'income' && isIncomeCat) || (type === 'expense' && !isIncomeCat)) {
        return category;
      }
    }
  }
  // 2. Fallback
  return type === 'income' ? "Receita / Extra" : "Outros / Outros";
}

// Limpa a descrição removendo termos de comando e o nome da conta
function cleanDescription(msg, walletName) {
  let t = msg
    .replace(/(paguei|gastei|comprei|recebi|ganhei|entrou|transferi|na|no|com|de|para)/gi, "")
    .replace(/\d+[.,]?\d*/g, ""); // Remove números

  // Remove nome da conta se houver (ex: "Almoço Nubank" -> "Almoço")
  if (walletName) {
    t = t.replace(new RegExp(walletName, "gi"), "");
  }

  // Remove moedas escritas
  t = t.replace(/\b(por|reais|real|r\$)\b/gi, "");
  t = t.replace(/\s+/g, " ").trim();

  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Geral";
}

// ======================================================================
// 🛠️ 3. EDIÇÃO E CONSULTA
// ======================================================================

function detectQueryIntent(msg) {
  const t = msg.toLowerCase();
  if (/últim|recent|lançamentos|transações/i.test(t)) return "query_last_transactions";
  if (/contas a pagar|boletos|vencendo|faturas/i.test(t)) return "query_bills_to_pay";
  return null;
}

function handleEdit(msg, pending, allAccounts) {
  const t = msg.toLowerCase();
  let updated = false;

  // Edição de Valor
  if (/valor|r\$/.test(t)) {
    const v = parseNumberFromTextPT(t) || Number(t.match(/(\d+[.,]?\d*)/)?.[1]?.replace(",", "."));
    if (v) { pending.amount = v; updated = true; }
  }
  // Edição de Descrição
  if (/descrição|descricao/.test(t)) {
    const newDesc = t.replace(/.*(descrição|descricao)( é| ser)?/i, "").trim();
    if (newDesc) { pending.description = cleanDescription(newDesc); updated = true; }
  }
  // Edição de Conta
  if (/conta|carteira/.test(t)) {
    const w = detectWallet(t, allAccounts);
    if (w) { pending.wallet = w; updated = true; }
  }
  // Edição de Categoria (busca simples nas keys)
  if (/categoria/.test(t)) {
    // Tenta achar categoria na lista completa ou via keywords
    const catTry = smartCategorize(t, pending.type);
    if (catTry && catTry !== "Outros / Outros") { pending.category = catTry; updated = true; }
  }

  return { pending, updated };
}

// ======================================================================
// 🚀 4. HANDLER PRINCIPAL (LÓGICA CENTRAL)
// ======================================================================

export default async function handler(req, res) {
  const { message, context } = req.body;
  const msg = message.toLowerCase().trim();

  // Junta Wallets e Cards para busca unificada
  const wallets = context?.wallets || [];
  const cards = context?.cards || [];
  const allAccounts = [...wallets, ...cards];
  
  let pending = context?.pending_transaction || null;

  // ---------------------------------------------------------
  // A. INTENÇÃO DE CONSULTA (Prioridade Alta)
  // ---------------------------------------------------------
  const queryIntent = detectQueryIntent(msg);
  if (queryIntent) {
    return res.json({
      reply: "Certo 👍 Já vou verificar isso pra você.",
      action: queryIntent,
      data: { family_id: context?.family_id, member_id: context?.member_id }
    });
  }

  // ---------------------------------------------------------
  // B. LOOP DE CONTEXTO: RESPOSTA DE CONTA FALTANTE
  // ---------------------------------------------------------
  // Se existe transação pendente SEM carteira, assume que a msg é a conta
  if (pending && !pending.wallet) {
    const foundWallet = detectWallet(msg, allAccounts);
    
    if (foundWallet) {
      // JUNTAR INFORMAÇÃO
      pending.wallet = foundWallet;
      
      // Tenta recategorizar se a descrição estava genérica
      if (!pending.category || pending.category === "Outros / Outros") {
         pending.category = smartCategorize(pending.description, pending.type);
      }

      return res.json({
        reply: buildConfirmationMessage(pending),
        action: "awaiting_confirmation",
        data: { pending_transaction: pending }
      });
    } else {
      // Usuário respondeu algo que não é conta.
      // Se parece comando novo (Ex: "Esquece, gastei 50"), deixa passar para o bloco C.
      // Se não, insiste na pergunta.
      if (!/(gastei|recebi|paguei|compra|venda)/i.test(msg)) {
         return res.json({
           reply: `Não entendi qual conta usar. 😅\n\nDe qual conta saiu ou entrou? 💳\n${allAccounts.map(w => `• [${w.name}]`).join("\n")}`,
           action: "need_wallet",
           data: { pending_transaction: pending }
         });
      }
    }
  }

  // ---------------------------------------------------------
  // C. EDIÇÃO OU CONFIRMAÇÃO (Com contexto completo)
  // ---------------------------------------------------------
  if (pending && pending.wallet) {
    // Confirmação
    if (/(sim|ok|confirma|pode ser|isso)/i.test(msg)) {
      return res.json({
        reply: "Salvo com sucesso! ✅",
        action: "save_transaction", // Frontend deve processar isso
        data: pending
      });
    }
    // Cancelamento
    if (/(não|nao|cancelar|esquece)/i.test(msg)) {
      return res.json({
        reply: "Cancelado. 🗑️",
        action: "cancel_transaction",
        data: null
      });
    }
    // Edição
    if (/(altera|muda|valor|descrição|conta|categoria)/i.test(msg)) {
      const { pending: updatedPending } = handleEdit(msg, pending, allAccounts);
      return res.json({
        reply: `Atualizei! 👌\n\n${buildConfirmationMessage(updatedPending)}`,
        action: "awaiting_confirmation",
        data: { pending_transaction: updatedPending }
      });
    }
  }

  // ---------------------------------------------------------
  // D. NOVA TRANSAÇÃO (Extract)
  // ---------------------------------------------------------
  const type = /(recebi|ganhei|sal[aá]rio|venda|entrada|deposito)/i.test(msg) ? "income" : "expense";
  
  const numericMatch = msg.match(/(\d+[.,]?\d*)/);
  const amount = numericMatch 
    ? Number(numericMatch[1].replace(",", ".")) 
    : parseNumberFromTextPT(msg);

  // Se não achou valor, assume conversa fiada
  if (!amount) {
     return res.json({ reply: "Olá! 👋 Sou sua IA Financeira.\nDiga algo como: 'Gastei 50 reais no Mercado'." });
  }

  // Detecta dados
  const wallet = detectWallet(msg, allAccounts);
  const description = cleanDescription(message, wallet?.name); // Usa message original para case sensitive
  const category = smartCategorize(description, type);

  const newTransaction = {
    type,
    amount,
    description,
    category,
    wallet: wallet || null,
    frequency: "Variável"
  };

  // ---------------------------------------------------------
  // E. VALIDAÇÃO FINAL
  // ---------------------------------------------------------
  
  // Faltou a conta?
  if (!newTransaction.wallet) {
    return res.json({
      reply: `De qual conta saiu ou entrou? 💳\n\n${allAccounts.map(w => `• [${w.name}]`).join("\n")}`,
      action: "need_wallet",
      data: { pending_transaction: newTransaction }
    });
  }

  // Tudo certo?
  return res.json({
    reply: buildConfirmationMessage(newTransaction),
    action: "awaiting_confirmation",
    data: { pending_transaction: newTransaction }
  });
}

// ======================================================================
// 📟 FORMATADOR DE RESPOSTA (PERSONALIDADE)
// ======================================================================

function buildConfirmationMessage(t) {
  const icon = t.type === 'income' ? '🟢' : '🔴';
  const typeName = t.type === 'income' ? 'Receita' : 'Saída'; // Ajustado conforme pedido
  
  return `${icon} *${typeName}* |  📅 *${t.frequency}*
💰 *Valor*: ${formatCurrency(t.amount)}
📝 *Descrição*: ${t.description}
💳 *Conta*: ${t.wallet?.name || '---'}
📂 *Categoria*: ${t.category}

Responda *Sim* para salvar ou *Não* para cancelar.`;
}
