import type { DealProcessingLog, LogStep } from "./supabase";
import { STAGES, type EventoDeal } from "./pipedrive";

/**
 * Classificação do estado de cada card a partir do log de processamento que a
 * Lia escreve em `deal_processing_logs` (pipeline25-handler.js → emitLog).
 *
 * Por que o log e não as notas do Pipedrive: as notas exigiriam 1 request por
 * card (200+ cards em dia de evento = 200 requests e ~1min de latência); o log
 * sai inteiro numa query só. As notas continuam disponíveis como fallback
 * pontual pros cards que ainda não têm log.
 */

export type Severidade = "erro" | "atencao" | "descarte" | "ok" | "neutro";

export type Motivo = {
  chave: string;
  rotulo: string;
  severidade: Severidade;
  detalhe: string;
};

const NAO_CLASSIFICADO: Motivo = {
  chave: "nao_classificado",
  rotulo: "Não classificado",
  severidade: "atencao",
  detalhe: "Nenhum marcador reconhecido no log nem nas notas — conferir o card na mão.",
};

/**
 * Diferente de "não classificado": aqui não existe log nenhum pra ler, seja
 * porque o card acabou de entrar, seja porque o Supabase não está conectado.
 * Separado de propósito — misturar os dois faria o painel acusar centenas de
 * cards "sem motivo" só por falta de credencial.
 */
const SEM_LOG: Motivo = {
  chave: "sem_log",
  rotulo: "Sem log ainda",
  severidade: "neutro",
  detalhe: "Nenhum registro de processamento pra este card — ou acabou de entrar, ou a automação ainda não tocou nele.",
};

/** Rótulos de lost_reason vêm como texto livre e às vezes com um parágrafo inteiro. */
export function encurtar(texto: string, max = 60): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}

/**
 * Ordem importa: o primeiro padrão que casar em QUALQUER passo do log vence.
 * Os padrões terminais (cliente ativo, retry esgotado) vêm antes dos
 * intermediários pra um card que passou por várias tentativas ser rotulado
 * pelo desfecho, não pela tentativa.
 *
 * Cada regex precisa cobrir DUAS redações do mesmo evento: a do log
 * (`emitLog`, ex.: "só 0 concorrente(s)") e a da nota do card (ex.: "apenas 0
 * concorrente(s)"). São textos escritos em pontos diferentes do
 * pipeline25-handler e não coincidem palavra por palavra.
 */
const REGRAS: Array<{
  re: RegExp;
  chave: string;
  rotulo: string;
  severidade: Severidade;
  detalhe: (m: RegExpMatchArray) => string;
}> = [
  {
    re: /cliente ativo Branddi|Cliente Branddi ativo/i,
    chave: "cliente_ativo",
    rotulo: "Cliente Branddi ativo",
    severidade: "descarte",
    detalhe: () => "Marca já monitorada por nós — sem pescaria e sem relatório, só o e-mail de sorteio.",
  },
  {
    re: /Retry esgotado/i,
    chave: "baixa_captura_final",
    rotulo: "Baixa captura (retry esgotado)",
    severidade: "descarte",
    detalhe: () => "Segunda e última monitoria também ficou abaixo de 5 agressores — e-mail genérico já saiu.",
  },
  {
    re: /Falha ao disparar e-mail genérico \(baixa captura\): (.+)/i,
    chave: "email_generico_falhou",
    rotulo: "E-mail genérico falhou",
    severidade: "erro",
    detalhe: (m) => `Baixa captura finalizada mas o e-mail não saiu: ${m[1]}`,
  },
  {
    re: /Relat[óo]rio Reprovado\s*:\s*(?:só|apenas)\s+(\d+) concorrente/i,
    chave: "baixa_captura",
    rotulo: "Baixa captura de agressores",
    severidade: "atencao",
    detalhe: (m) =>
      `Só ${m[1]} concorrente(s) encontrado(s) — mínimo é 5. O sweep dispara um retry único automaticamente.`,
  },
  {
    re: /Pescaria via SerpMonitor falhou: (.+)/i,
    chave: "pescaria_falhou",
    rotulo: "Pescaria falhou",
    severidade: "erro",
    detalhe: (m) => `SerpMonitor devolveu erro: ${m[1]}`,
  },
  {
    re: /Relatório com link não disparado pra ([^\s(]+) \(([^)]+)\)/i,
    chave: "relatorio_nao_disparado",
    rotulo: "Relatório não disparado",
    severidade: "erro",
    detalhe: (m) => `Dados ficaram só na nota do card — envio pra ${m[1]} falhou: ${m[2]}`,
  },
  {
    re: /Envio 1 \(([^)]+)\) não disparado \(([^)]+)\)/i,
    chave: "envio1_falhou",
    rotulo: "Envio 1 não disparado",
    severidade: "erro",
    detalhe: (m) => `O primeiro e-mail (${m[1]}) não saiu: ${m[2]}`,
  },
  {
    re: /Semrush instantâneo falhou: (.+)/i,
    chave: "semrush_falhou",
    rotulo: "Semrush falhou",
    severidade: "erro",
    detalhe: (m) => `Diagnóstico instantâneo sem números: ${m[1]}`,
  },
  {
    re: /E-mail "([^"]*)": inválido ❌ \(([^)]+)\)/i,
    chave: "email_invalido",
    rotulo: "E-mail inválido",
    severidade: "descarte",
    detalhe: (m) => `"${m[1]}" reprovou na verificação (${m[2]}).`,
  },
  {
    re: /Contato inválido: e-mail "([^"]*)" não é corporativo|não é corporativo \(domínio genérico\)/i,
    chave: "contato_invalido",
    rotulo: "E-mail pessoal (domínio genérico)",
    severidade: "descarte",
    detalhe: (m) =>
      `${m[1] ? `"${m[1]}"` : "O e-mail informado"} é de domínio genérico (gmail/hotmail/etc). ` +
      "A captação barrou na entrada: sem diagnóstico e sem ponto pro colaborador.",
  },
  {
    re: /Sem e-mail no lead/i,
    chave: "sem_email",
    rotulo: "Lead sem e-mail",
    severidade: "descarte",
    detalhe: () => "Card entrou sem e-mail — não dá pra validar nem enviar relatório.",
  },
  {
    re: /Pescaria ainda em andamento|Pescaria ainda coletando dados/i,
    chave: "pescaria_andamento",
    rotulo: "Pescaria em andamento",
    severidade: "ok",
    detalhe: () => "Monitoria rodando — o sweep watchdog reconsulta em alguns minutos.",
  },
  {
    re: /Monitoria reaproveitada|Monitoria fresca já existe/i,
    chave: "monitoria_reaproveitada",
    rotulo: "Monitoria reaproveitada",
    severidade: "ok",
    detalhe: () => "Havia dado de menos de 90 dias — não criou pescaria nova.",
  },
  {
    re: /Reunião Agendada, mas e-mail não foi validado/i,
    chave: "reuniao_sem_email_ok",
    rotulo: "Reunião sem e-mail validado",
    severidade: "atencao",
    detalhe: () => "Card chegou em Reunião Agendada sem e-mail validado — não pontuou no placar.",
  },
  {
    re: /Relat[óo]rio completo (?:enviado|da pescaria)|Entrou em Prospecção Ativa/i,
    chave: "relatorio_enviado",
    rotulo: "Relatório completo enviado",
    severidade: "ok",
    detalhe: () => "Fluxo completou: relatório da pescaria foi pro lead e o card seguiu pra prospecção.",
  },
];

export function classificarPorLog(steps: LogStep[] | null): Motivo | null {
  if (!steps?.length) return null;
  // Varre do passo mais recente pro mais antigo: o desfecho manda.
  for (let i = steps.length - 1; i >= 0; i--) {
    const msg = steps[i]?.msg || "";
    for (const r of REGRAS) {
      const m = msg.match(r.re);
      if (m) {
        return { chave: r.chave, rotulo: r.rotulo, severidade: r.severidade, detalhe: r.detalhe(m) };
      }
    }
  }
  return null;
}

/** Fallback pras notas do Pipedrive (HTML), pros cards ainda sem log. */
export function classificarPorNotas(notas: string[]): Motivo | null {
  const texto = notas.map((n) => n.replace(/<[^>]+>/g, " ")).join(" \n ");
  if (!texto.trim()) return null;
  for (const r of REGRAS) {
    const m = texto.match(r.re);
    if (m) {
      return { chave: r.chave, rotulo: r.rotulo, severidade: r.severidade, detalhe: r.detalhe(m) };
    }
  }
  if (/cliente ativo branddi|🛡️/i.test(texto)) {
    return {
      chave: "cliente_ativo",
      rotulo: "Cliente Branddi ativo",
      severidade: "descarte",
      detalhe: "Marca já monitorada por nós — sem pescaria e sem relatório.",
    };
  }
  return null;
}

/**
 * Motivo final de um card. O `lost_reason` do Pipedrive tem prioridade sobre o
 * log: quando o gate de cliente ativo marca Perdido, é a informação mais
 * confiável e nem sempre há log (o card pode nunca ter entrado em Monitoria).
 */
export function motivoDoCard(deal: EventoDeal, log: DealProcessingLog | undefined): Motivo {
  if (deal.status === "lost" && deal.lostReason) {
    if (/cliente branddi ativo/i.test(deal.lostReason)) {
      return {
        chave: "cliente_ativo",
        rotulo: "Cliente Branddi ativo",
        severidade: "descarte",
        detalhe: "Marcado Perdido pelo gate de cliente ativo — só recebe o e-mail de sorteio.",
      };
    }
    return {
      chave: `perdido_${deal.lostReason.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}`,
      rotulo: encurtar(deal.lostReason),
      severidade: "descarte",
      detalhe: deal.lostReason,
    };
  }
  const porLog = classificarPorLog(log?.steps ?? null);
  if (porLog) return porLog;
  if (nasceuEmReprovado(deal)) {
    return {
      chave: "contato_invalido",
      rotulo: "E-mail pessoal (domínio genérico)",
      severidade: "descarte",
      detalhe:
        "Card já nasceu em Relatório Reprovado — a captação barrou o e-mail de domínio genérico " +
        "(gmail/hotmail/etc) antes de qualquer automação. Sem diagnóstico e sem ponto pro colaborador.",
    };
  }
  return log ? NAO_CLASSIFICADO : SEM_LOG;
}

/**
 * Card criado JÁ em Relatório Reprovado, sem nunca passar por Monitoria. As
 * duas Edge Functions de captação (pre-ecomm-lead e formoff-pipedrive) fazem
 * isso num único caso: e-mail de domínio pessoal. Como nenhuma automação chega
 * a rodar, esses cards não têm log nenhum — sem esta inferência eles apareceriam
 * como "sem motivo", e hoje são a maior fatia do estágio.
 */
function nasceuEmReprovado(deal: EventoDeal): boolean {
  if (deal.stageId !== STAGES.RELATORIO_REPROVADO) return false;
  if (!deal.stageChangeTime) return true;
  const delta = new Date(deal.stageChangeTime).getTime() - new Date(deal.addTime).getTime();
  return Math.abs(delta) < 60_000;
}

// ─── Tempo ────────────────────────────────────────────────────────────

export function minutosDesde(iso: string | null | undefined, agora = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round((agora - t) / 60000);
}

/**
 * Um card em Monitoria (501) é considerado travado quando passa do SLA de
 * processamento. O sweep da Lia re-dispara automaticamente até escalar; aqui
 * só espelhamos o mesmo limite pra o painel mostrar antes do alerta chegar.
 */
export const SLA_MONITORIA_MIN = 15;
export const SLA_NOVO_LEAD_MIN = 5;

export function estaTravado(deal: EventoDeal, agora = Date.now()): boolean {
  if (deal.status !== "open") return false;
  const min = minutosDesde(deal.stageChangeTime || deal.addTime, agora);
  if (min === null) return false;
  if (deal.stageId === STAGES.MONITORIA) return min > SLA_MONITORIA_MIN;
  if (deal.stageId === STAGES.NOVO_LEAD) return min > SLA_NOVO_LEAD_MIN;
  return false;
}

/** Início do dia corrente no fuso de São Paulo, em epoch ms. */
export function inicioDoDiaBrt(agora = new Date()): number {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(agora);
  const get = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? 0);
  const decorridoMs =
    (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000 + agora.getMilliseconds();
  return agora.getTime() - decorridoMs;
}

/** Corte de período: 1 = desde 00:00 BRT de hoje; N>1 = últimos N dias; 0 = tudo. */
export function corteDoPeriodo(dias: number, agora = new Date()): number {
  if (!dias || dias <= 0) return 0;
  if (dias === 1) return inicioDoDiaBrt(agora);
  return agora.getTime() - dias * 24 * 3600 * 1000;
}
