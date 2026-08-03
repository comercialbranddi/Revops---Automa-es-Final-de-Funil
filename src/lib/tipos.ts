import type { Severidade } from "./diagnostico";

export type NivelAlerta = "critico" | "atencao" | "resolvido" | "info";

export type Alerta = {
  nivel: NivelAlerta;
  titulo: string;
  valor: string | null;
  texto: string;
};

export type CardResumo = {
  id: number;
  org: string;
  estagio: string;
  stageId: number;
  status: "open" | "won" | "lost";
  origem: string;
  criadoEm: string;
  naEtapaHaMin: number | null;
  companyScore: number | null;
  relatorio: string | null;
  emailValidado: string | null;
  motivo: string;
  motivoChave: string;
  severidade: Severidade;
  detalhe: string;
  link: string;
};

export type CardAoVivo = {
  id: number;
  org: string;
  estagio: string;
  statusLog: string;
  etapaLog: string | null;
  ultimoPasso: string;
  ultimoPassoIcon: string;
  atualizadoHaMin: number | null;
  duracaoMin: number | null;
  passos: { time: string; icon: string; msg: string }[];
  link: string;
};

export type ErroItem = {
  id: number;
  dealId: number;
  org: string;
  stage: string;
  tipo: string;
  detalhe: string;
  retries: number;
  ocorridoEm: string;
  resolvidoEm: string | null;
  minutosAberto: number | null;
  link: string;
};

/** Card em que o e-mail final (relatório ou Envio 1) falhou por SMTP/credencial. */
export type EmailFalhaItem = {
  id: number;
  org: string;
  emailLead: string | null;
  estagio: string;
  status: "open" | "won" | "lost";
  mensagem: string;
  ocorreuEm: string;
  link: string;
};

export type Contagem = { chave: string; rotulo: string; n: number; severidade?: Severidade };

export type EtapaFunil = {
  stageId: number;
  nome: string;
  abertos: number;
  perdidos: number;
  ganhos: number;
  travados: number;
};

export type SerieHora = { hora: string; criados: number; concluidos: number; reprovados: number };

/** Uma linha por pessoa do time que captou lead no evento. */
export type Participante = {
  pessoa: string;
  estande: number;
  qrEstande: number;
  preCadastro: number;
  semOrigem: number;
  total: number;
  reunioesAgendadas: number;
  reunioesRealizadas: number;
  /** agendadas + realizadas — é o número que o placar remunera a 30pt cada. */
  reunioes: number;
  relatorios: number;
  emailPessoal: number;
  pontos: number | null;
};

// ─── Fechamento do evento (visão de liderança) ────────────────────────
// Calculado sobre a coorte inteira do evento, de propósito ignorando o
// filtro de período do topo: o número que a liderança discute é o do evento
// fechado, não o dos últimos 7 dias.

export type LinhaFunilResultado = {
  rotulo: string;
  n: number;
  pctDoTotal: number;
  /** Conversão em relação à etapa anterior do funil. */
  pctDaAnterior: number | null;
  tom: "ok" | "atencao" | "critico" | "neutro";
};

export type CanalResultado = {
  canal: string;
  leads: number;
  reunioes: number;
  taxaReuniao: number;
  emailPessoal: number;
  taxaEmailPessoal: number;
  relatorios: number;
};

export type PerdaResultado = {
  rotulo: string;
  n: number;
  pct: number;
  evitavel: boolean;
  explicacao: string;
};

export type PessoaResultado = {
  pessoa: string;
  estandeLeads: number;
  estandeReunioes: number;
  lpLeads: number;
  lpReunioes: number;
  total: number;
  reunioes: number;
  taxa: number;
};

export type DiaResultado = { dia: string; leads: number; reunioes: number };

export type Leitura = {
  tom: "ok" | "atencao" | "critico" | "info";
  titulo: string;
  texto: string;
};

export type ResultadoEvento = {
  janelaDe: string;
  janelaAte: string;
  totais: {
    leads: number;
    empresas: number;
    reunioes: number;
    relatorios: number;
    contratos: number;
    taxaReuniao: number;
    emailPessoal: number;
    taxaEmailPessoal: number;
  };
  funil: LinhaFunilResultado[];
  canais: CanalResultado[];
  perdas: PerdaResultado[];
  equipe: PessoaResultado[];
  linhaDoTempo: DiaResultado[];
  leituras: Leitura[];
  /** Reuniões que os leads barrados por e-mail pessoal renderiam na taxa do próprio canal. */
  reunioesPerdidasEstimadas: number;
};

export type EntradaSorteio = {
  nome: string;
  entradas: number;
  fontes: string[];
};

export type EventosData = {
  atualizadoEm: string;
  periodoDias: number;
  fontes: {
    pipedrive: boolean;
    supabase: boolean;
    supabaseErro: string | null;
  };
  kpis: {
    entraramNoPeriodo: number;
    entraramHoje: number;
    ultimaHora: number;
    abertosNoFunil: number;
    processandoAgora: number;
    travados: number;
    relatoriosEnviados: number;
    taxaRelatorio: number;
    clientesAtivos: number;
    errosAbertos: number;
    errosResolvidos24h: number;
    medianaMinutosAteRelatorio: number | null;
    emailsFalhados: number;
  };
  alertas: Alerta[];
  funil: EtapaFunil[];
  saidaLateral: Contagem[];
  origens: Contagem[];
  porHora: SerieHora[];
  aoVivo: CardAoVivo[];
  novos: CardResumo[];
  reprovados: CardResumo[];
  reprovadosPorMotivo: Contagem[];
  clientes: CardResumo[];
  relatorios: CardResumo[];
  emailsFalhados: {
    itens: EmailFalhaItem[];
    /** quantos cards do período foram checados nas notas — a busca é limitada por custo. */
    checados: number;
    /** total de cards do período que ENTRARIAM na checagem — se > checados, a lista está truncada. */
    elegiveis: number;
  };
  erros: {
    abertos: ErroItem[];
    resolvidos: ErroItem[];
    porTipo: Contagem[];
    medianaResolucaoMin: number | null;
  };
  placar: {
    disponivel: boolean;
    /** true só com a service key: aí dá pra quebrar os pontos por motivo. */
    detalhado: boolean;
    total: number;
    ranking: {
      pessoa: string;
      pontos: number;
      leads: number | null;
      reunioes: number | null;
      contratos: number | null;
    }[];
  };
  equipe: Participante[];
  resultado: ResultadoEvento;
  sorteio: {
    disponivel: boolean;
    total: number;
    participantes: number;
    porFonte: Contagem[];
    entradas: EntradaSorteio[];
  };
  legado: { abertos: number; perdidos: number };
};
