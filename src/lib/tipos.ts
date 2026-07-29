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
  relatorios: number;
  emailPessoal: number;
  pontos: number | null;
};

export type EntradaSorteio = {
  nome: string;
  email: string | null;
  fonte: string;
  criadoEm: string;
  link: string | null;
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
  erros: {
    abertos: ErroItem[];
    resolvidos: ErroItem[];
    porTipo: Contagem[];
    medianaResolucaoMin: number | null;
  };
  placar: {
    disponivel: boolean;
    total: number;
    ranking: { pessoa: string; pontos: number; leads: number; reunioes: number; contratos: number }[];
  };
  equipe: Participante[];
  sorteio: {
    disponivel: boolean;
    /** true quando o número veio do Pipedrive por aproximação, não do Supabase. */
    aproximado: boolean;
    total: number;
    porFonte: Contagem[];
    entradas: EntradaSorteio[];
  };
  legado: { abertos: number; perdidos: number };
};
