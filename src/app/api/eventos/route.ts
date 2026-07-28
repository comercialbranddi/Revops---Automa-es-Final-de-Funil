import { NextResponse } from "next/server";
import {
  fetchEventoDeals,
  fetchDealNotes,
  pipedriveCardUrl,
  FUNIL_ORDEM,
  STAGES,
  STAGE_LEGADO,
  STAGE_NAMES,
  type EventoDeal,
} from "@/lib/pipedrive";
import {
  supabaseConfigurado,
  chaveEhServiceRole,
  fetchDealLogs,
  fetchAutomationErrors,
  fetchReportDispatches,
  fetchPlacar,
  fetchSorteio,
  type AutomationError,
  type DealProcessingLog,
  type PlacarPonto,
  type SorteioEntry,
} from "@/lib/supabase";
import {
  classificarPorNotas,
  corteDoPeriodo,
  estaTravado,
  minutosDesde,
  motivoDoCard,
  SLA_MONITORIA_MIN,
  type Motivo,
} from "@/lib/diagnostico";
import type {
  Alerta,
  CardAoVivo,
  CardResumo,
  Contagem,
  ErroItem,
  EtapaFunil,
  EventosData,
  SerieHora,
} from "@/lib/tipos";

export const dynamic = "force-dynamic";

const ETAPAS_FINAIS_OK = [
  STAGES.RELATORIO_ENVIADO,
  STAGES.PROSPECCAO_ATIVA,
  STAGES.SEM_RESPOSTA,
  STAGES.RESPONDEU,
  STAGES.REUNIAO_AGENDADA,
  STAGES.REUNIAO_REALIZADA,
] as number[];

/**
 * Buscar nota custa 1 request por card. Com o Supabase ligado o log já
 * classifica quase tudo e o fallback é só pra cauda; sem ele, o fallback é a
 * ÚNICA fonte de motivo, então vale gastar mais requests pra a seção de
 * reprovados não ficar inútil no meio do evento.
 */
const MAX_NOTAS_COM_LOG = 15;
const MAX_NOTAS_SEM_LOG = 60;
const NOTAS_POR_LOTE = 8;

function nomeOrg(d: EventoDeal): string {
  return d.orgName || d.title || `#${d.id}`;
}

function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : Math.round((v[meio - 1] + v[meio]) / 2);
}

function contar(itens: { chave: string; rotulo: string; severidade?: Motivo["severidade"] }[]): Contagem[] {
  const mapa = new Map<string, Contagem>();
  for (const i of itens) {
    const atual = mapa.get(i.chave);
    if (atual) atual.n += 1;
    else mapa.set(i.chave, { chave: i.chave, rotulo: i.rotulo, n: 1, severidade: i.severidade });
  }
  return [...mapa.values()].sort((a, b) => b.n - a.n);
}

function horaBrt(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
  });
}

export async function GET(request: Request) {
  const agora = new Date();
  const url = new URL(request.url);
  const periodoDias = Number(url.searchParams.get("dias") ?? "7");
  const corte = corteDoPeriodo(periodoDias, agora);

  try {
    const todos = await fetchEventoDeals();

    // Cards do evento corrente = tudo fora do estágio legado, dentro do período.
    const legado = todos.filter((d) => d.stageId === STAGE_LEGADO);
    const deals = todos.filter(
      (d) => d.stageId !== STAGE_LEGADO && new Date(d.addTime).getTime() >= corte
    );
    const ids = deals.map((d) => d.id);

    // ── Supabase (opcional) ────────────────────────────────────────────
    let logs: DealProcessingLog[] = [];
    let erros: AutomationError[] = [];
    let dispatches: { deal_id: number; dispatched_at: string }[] = [];
    let placarRows: PlacarPonto[] = [];
    let sorteioRows: SorteioEntry[] = [];
    let supabaseErro: string | null = null;
    const temSupabase = supabaseConfigurado();

    if (temSupabase && !chaveEhServiceRole()) {
      supabaseErro =
        "A chave configurada não é service_role. As tabelas de evento têm RLS ligado e devolvem " +
        "lista vazia (sem erro) pra chave anon/publishable — troque por SUPABASE_SERVICE_ROLE_KEY.";
    } else if (temSupabase && ids.length) {
      try {
        [logs, erros, dispatches, placarRows, sorteioRows] = await Promise.all([
          fetchDealLogs(ids),
          fetchAutomationErrors(ids),
          fetchReportDispatches(ids),
          fetchPlacar(),
          fetchSorteio(),
        ]);
      } catch (err) {
        supabaseErro = err instanceof Error ? err.message : "falha ao ler o Supabase";
      }
    }

    const logPorDeal = new Map(logs.map((l) => [l.deal_id, l]));
    const dispatchPorDeal = new Map(dispatches.map((d) => [d.deal_id, d.dispatched_at]));

    // ── Classificação por card ─────────────────────────────────────────
    const motivos = new Map<number, Motivo>();
    for (const d of deals) motivos.set(d.id, motivoDoCard(d, logPorDeal.get(d.id)));

    // Fallback nas notas só pros cards parados e sem classificação — mantém o
    // custo em requests limitado mesmo em dia de pico.
    const semClassificacao = deals
      .filter((d) => {
        const chave = motivos.get(d.id)?.chave;
        return (
          (chave === "nao_classificado" || chave === "sem_log") &&
          (d.stageId === STAGES.RELATORIO_REPROVADO || estaTravado(d, agora.getTime()))
        );
      })
      .sort((a, b) => (a.addTime < b.addTime ? 1 : -1));

    const teto = logs.length ? MAX_NOTAS_COM_LOG : MAX_NOTAS_SEM_LOG;
    const alvo = semClassificacao.slice(0, teto);
    for (let i = 0; i < alvo.length; i += NOTAS_POR_LOTE) {
      await Promise.all(
        alvo.slice(i, i + NOTAS_POR_LOTE).map(async (d) => {
          const m = classificarPorNotas(await fetchDealNotes(d.id));
          if (m) motivos.set(d.id, m);
        })
      );
    }

    const resumo = (d: EventoDeal): CardResumo => {
      const m = motivos.get(d.id)!;
      return {
        id: d.id,
        org: nomeOrg(d),
        estagio: STAGE_NAMES[d.stageId] || String(d.stageId),
        stageId: d.stageId,
        status: d.status,
        origem: d.origem,
        criadoEm: d.addTime,
        naEtapaHaMin: minutosDesde(d.stageChangeTime || d.addTime, agora.getTime()),
        companyScore: d.companyScore,
        relatorio: d.relatorioHtml,
        emailValidado: d.emailValidado,
        motivo: m.rotulo,
        motivoChave: m.chave,
        severidade: m.severidade,
        detalhe: m.detalhe,
        link: pipedriveCardUrl(d.id),
      };
    };

    // ── Funil ──────────────────────────────────────────────────────────
    const funil: EtapaFunil[] = FUNIL_ORDEM.map((stageId) => {
      const naEtapa = deals.filter((d) => d.stageId === stageId);
      return {
        stageId,
        nome: STAGE_NAMES[stageId],
        abertos: naEtapa.filter((d) => d.status === "open").length,
        perdidos: naEtapa.filter((d) => d.status === "lost").length,
        ganhos: naEtapa.filter((d) => d.status === "won").length,
        travados: naEtapa.filter((d) => estaTravado(d, agora.getTime())).length,
      };
    });

    const perdidos = deals.filter((d) => d.status === "lost");
    const saidaLateral = contar(
      perdidos.map((d) => {
        const m = motivos.get(d.id)!;
        return { chave: m.chave, rotulo: m.rotulo, severidade: m.severidade };
      })
    );

    const origens = contar(deals.map((d) => ({ chave: d.origem, rotulo: d.origem })));

    // ── Entrada por hora (últimas 24h) ─────────────────────────────────
    const janela24h = agora.getTime() - 24 * 3600 * 1000;
    const buckets = new Map<string, SerieHora>();
    for (let i = 23; i >= 0; i--) {
      const t = new Date(agora.getTime() - i * 3600 * 1000).toISOString();
      buckets.set(horaBrt(t), { hora: horaBrt(t), criados: 0, concluidos: 0, reprovados: 0 });
    }
    for (const d of deals) {
      const criado = new Date(d.addTime).getTime();
      if (criado >= janela24h) {
        const b = buckets.get(horaBrt(d.addTime));
        if (b) b.criados += 1;
      }
      const mudou = d.stageChangeTime ? new Date(d.stageChangeTime).getTime() : 0;
      if (mudou >= janela24h) {
        const b = buckets.get(horaBrt(d.stageChangeTime!));
        if (!b) continue;
        if (ETAPAS_FINAIS_OK.includes(d.stageId)) b.concluidos += 1;
        if (d.stageId === STAGES.RELATORIO_REPROVADO) b.reprovados += 1;
      }
    }
    const porHora = [...buckets.values()];

    // ── Ao vivo (log de processamento) ─────────────────────────────────
    const aoVivo: CardAoVivo[] = logs
      .filter((l) => l.status === "running" || l.status === "waiting" || l.status === "error")
      .map((l) => {
        const deal = deals.find((d) => d.id === l.deal_id);
        const passos = (l.steps || []).slice(-12).map((s) => ({
          time: s.time || "",
          icon: s.icon || "info",
          msg: s.msg || "",
        }));
        const ultimo = passos[passos.length - 1];
        return {
          id: l.deal_id,
          org: deal ? nomeOrg(deal) : `#${l.deal_id}`,
          estagio: deal ? STAGE_NAMES[deal.stageId] || String(deal.stageId) : "—",
          statusLog: l.status || "idle",
          etapaLog: l.stage,
          ultimoPasso: ultimo?.msg || "sem passos registrados",
          ultimoPassoIcon: ultimo?.icon || "info",
          atualizadoHaMin: minutosDesde(l.updated_at, agora.getTime()),
          duracaoMin:
            l.started_at && l.updated_at
              ? Math.max(
                  0,
                  Math.round(
                    (new Date(l.updated_at).getTime() - new Date(l.started_at).getTime()) / 60000
                  )
                )
              : null,
          passos,
          link: pipedriveCardUrl(l.deal_id),
        };
      })
      .sort((a, b) => (a.atualizadoHaMin ?? 0) - (b.atualizadoHaMin ?? 0));

    // ── Listas ─────────────────────────────────────────────────────────
    const novos = deals
      .filter((d) => d.status === "open")
      .sort((a, b) => (a.addTime < b.addTime ? 1 : -1))
      .slice(0, 60)
      .map(resumo);

    const clientes = deals
      .filter((d) => motivos.get(d.id)?.chave === "cliente_ativo")
      .sort((a, b) => (a.addTime < b.addTime ? 1 : -1))
      .map(resumo);

    const reprovados = deals
      .filter((d) => d.stageId === STAGES.RELATORIO_REPROVADO && motivos.get(d.id)?.chave !== "cliente_ativo")
      .sort((a, b) => (a.addTime < b.addTime ? 1 : -1))
      .map(resumo);

    const reprovadosPorMotivo = contar(
      reprovados.map((r) => ({ chave: r.motivoChave, rotulo: r.motivo, severidade: r.severidade }))
    );

    const relatorios = deals
      .filter((d) => d.relatorioHtml || dispatchPorDeal.has(d.id))
      .sort((a, b) => (a.addTime < b.addTime ? 1 : -1))
      .map(resumo);

    // ── Erros técnicos ─────────────────────────────────────────────────
    const orgPorDeal = new Map(deals.map((d) => [d.id, nomeOrg(d)]));
    const paraErro = (e: AutomationError): ErroItem => ({
      id: e.id,
      dealId: e.deal_id,
      org: orgPorDeal.get(e.deal_id) || e.org_name || `#${e.deal_id}`,
      stage: e.stage,
      tipo: e.error_type,
      detalhe: e.error_detail || "",
      retries: e.retries ?? 0,
      ocorridoEm: e.occurred_at,
      resolvidoEm: e.resolved_at,
      minutosAberto: e.resolved_at
        ? Math.round((new Date(e.resolved_at).getTime() - new Date(e.occurred_at).getTime()) / 60000)
        : minutosDesde(e.occurred_at, agora.getTime()),
      link: pipedriveCardUrl(e.deal_id),
    });

    const errosAbertos = erros.filter((e) => !e.resolved_at).map(paraErro);
    const errosResolvidos = erros
      .filter((e) => e.resolved_at)
      .map(paraErro)
      .sort((a, b) => (a.resolvidoEm! < b.resolvidoEm! ? 1 : -1));

    const errosPorTipo = contar(
      erros.map((e) => ({ chave: e.error_type, rotulo: `${e.stage} · ${e.error_type}` }))
    );
    const medianaResolucaoMin = mediana(
      errosResolvidos.map((e) => e.minutosAberto ?? 0).filter((n) => n > 0)
    );

    const limite24h = agora.getTime() - 24 * 3600 * 1000;
    const errosResolvidos24h = errosResolvidos.filter(
      (e) => new Date(e.resolvidoEm!).getTime() >= limite24h
    ).length;

    // ── Placar e sorteio ───────────────────────────────────────────────
    const dealsDoPeriodo = new Set(ids);
    const placarFiltrado = placarRows.filter(
      (p) => !p.deal_id || dealsDoPeriodo.has(p.deal_id)
    );
    const rankingMapa = new Map<
      string,
      { pessoa: string; pontos: number; leads: number; reunioes: number; contratos: number }
    >();
    for (const p of placarFiltrado) {
      const r =
        rankingMapa.get(p.person) ||
        { pessoa: p.person, pontos: 0, leads: 0, reunioes: 0, contratos: 0 };
      r.pontos += p.points;
      if (p.reason === "lead_capturado") r.leads += 1;
      if (p.reason === "reuniao_agendada" || p.reason === "reuniao_realizada") r.reunioes += 1;
      if (p.reason === "contrato_fechado") r.contratos += 1;
      rankingMapa.set(p.person, r);
    }
    const ranking = [...rankingMapa.values()].sort((a, b) => b.pontos - a.pontos);

    const sorteioFiltrado = sorteioRows.filter((s) => !s.deal_id || dealsDoPeriodo.has(s.deal_id));

    // ── KPIs ───────────────────────────────────────────────────────────
    const abertos = deals.filter((d) => d.status === "open");
    const travados = deals.filter((d) => estaTravado(d, agora.getTime()));
    const inicioHoje = corteDoPeriodo(1, agora);
    const umaHoraAtras = agora.getTime() - 3600 * 1000;
    const comRelatorio = deals.filter((d) => d.relatorioHtml || dispatchPorDeal.has(d.id));
    const processados = deals.filter(
      (d) => ETAPAS_FINAIS_OK.includes(d.stageId) || d.stageId === STAGES.RELATORIO_REPROVADO
    );

    const tempoAteRelatorio = deals
      .filter((d) => (d.relatorioHtml || dispatchPorDeal.has(d.id)) && d.stageChangeTime)
      .map((d) => Math.round((new Date(d.stageChangeTime!).getTime() - new Date(d.addTime).getTime()) / 60000))
      .filter((n) => n >= 0 && n < 24 * 60);

    const kpis: EventosData["kpis"] = {
      entraramNoPeriodo: deals.length,
      entraramHoje: deals.filter((d) => new Date(d.addTime).getTime() >= inicioHoje).length,
      ultimaHora: deals.filter((d) => new Date(d.addTime).getTime() >= umaHoraAtras).length,
      abertosNoFunil: abertos.length,
      processandoAgora: logs.filter((l) => l.status === "running").length,
      travados: travados.length,
      relatoriosEnviados: comRelatorio.length,
      taxaRelatorio: processados.length
        ? Math.round((comRelatorio.length / processados.length) * 100)
        : 0,
      clientesAtivos: clientes.length,
      errosAbertos: errosAbertos.length,
      errosResolvidos24h,
      medianaMinutosAteRelatorio: mediana(tempoAteRelatorio),
    };

    // ── Alertas (o que precisa de atenção) ─────────────────────────────
    const alertas: Alerta[] = [];

    if (kpis.travados > 0) {
      alertas.push({
        nivel: "critico",
        titulo: "Cards travados no processamento",
        valor: String(kpis.travados),
        texto:
          `Cards abertos em Novo Lead ou Monitoria além do SLA (${SLA_MONITORIA_MIN}min em Monitoria). ` +
          "O sweep da Lia re-dispara sozinho — se o número não cair, a fila do SerpMonitor está represada.",
      });
    }

    if (kpis.errosAbertos > 0) {
      alertas.push({
        nivel: "critico",
        titulo: "Erros técnicos abertos",
        valor: String(kpis.errosAbertos),
        texto:
          "Falhas registradas em automation_errors que ainda não foram marcadas como resolvidas — " +
          "cada uma é um card que não seguiu sozinho.",
      });
    }

    const contatoInvalido = reprovadosPorMotivo.find((m) => m.chave === "contato_invalido");
    if (contatoInvalido && reprovados.length) {
      alertas.push({
        nivel: "atencao",
        titulo: "Leads entrando com e-mail pessoal",
        valor: `${Math.round((contatoInvalido.n / reprovados.length) * 100)}%`,
        texto:
          `${contatoInvalido.n} dos ${reprovados.length} cards em Relatório Reprovado nem chegaram a rodar: ` +
          "o e-mail informado é de domínio genérico e a captação barra na entrada. " +
          "É perda de formulário, não de automação — quem preenche no estande precisa ser lembrado do e-mail corporativo.",
      });
    }

    const baixaCaptura = reprovadosPorMotivo.find((m) => m.chave === "baixa_captura");
    const baixaCapturaFinal = reprovadosPorMotivo.find((m) => m.chave === "baixa_captura_final");
    if (baixaCaptura || baixaCapturaFinal) {
      alertas.push({
        nivel: "atencao",
        titulo: "Baixa captura de agressores",
        valor: String((baixaCaptura?.n ?? 0) + (baixaCapturaFinal?.n ?? 0)),
        texto:
          `cards com menos de 5 concorrentes na pescaria — ${baixaCaptura?.n ?? 0} aguardando o retry único e ` +
          `${baixaCapturaFinal?.n ?? 0} com o retry esgotado (esses já receberam o e-mail genérico e ficam parados).`,
      });
    }

    if (kpis.clientesAtivos > 0) {
      alertas.push({
        nivel: "info",
        titulo: "Clientes ativos barrados",
        valor: String(kpis.clientesAtivos),
        texto:
          "O gate de cliente ativo tirou essas marcas da pescaria e marcou o card como Perdido — " +
          "elas só recebem o e-mail do sorteio. É o comportamento esperado.",
      });
    }

    if (errosResolvidos24h > 0) {
      alertas.push({
        nivel: "resolvido",
        titulo: "Erros resolvidos nas últimas 24h",
        valor: String(errosResolvidos24h),
        texto: medianaResolucaoMin
          ? `Mediana de ${medianaResolucaoMin}min entre o erro aparecer e o card voltar a andar.`
          : "Cards reprocessados com sucesso depois de falhar.",
      });
    }

    const naoClassificados = reprovados.filter((r) => r.motivoChave === "nao_classificado").length;
    if (naoClassificados > 0 && temSupabase && !supabaseErro) {
      alertas.push({
        nivel: "atencao",
        titulo: "Reprovados sem motivo identificado",
        valor: String(naoClassificados),
        texto:
          "Cards em Relatório Reprovado sem marcador reconhecido no log nem nas notas — " +
          "ou é um caminho novo do fluxo, ou o card foi movido na mão.",
      });
    }

    if (!temSupabase) {
      alertas.push({
        nivel: "atencao",
        titulo: "Supabase não conectado",
        valor: null,
        texto:
          "Sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY o painel só enxerga o Pipedrive: " +
          "fluxo ao vivo, erros abertos/resolvidos, placar e sorteio ficam vazios.",
      });
    } else if (supabaseErro) {
      alertas.push({
        nivel: "critico",
        titulo: "Falha ao ler o Supabase",
        valor: null,
        texto: supabaseErro,
      });
    }

    const payload: EventosData = {
      atualizadoEm: agora.toISOString(),
      periodoDias,
      fontes: { pipedrive: true, supabase: temSupabase && !supabaseErro, supabaseErro },
      kpis,
      alertas,
      funil,
      saidaLateral,
      origens,
      porHora,
      aoVivo,
      novos,
      reprovados,
      reprovadosPorMotivo,
      clientes,
      relatorios,
      erros: {
        abertos: errosAbertos,
        resolvidos: errosResolvidos.slice(0, 80),
        porTipo: errosPorTipo,
        medianaResolucaoMin,
      },
      placar: { disponivel: temSupabase && !supabaseErro, total: ranking.reduce((s, r) => s + r.pontos, 0), ranking },
      sorteio: {
        disponivel: temSupabase && !supabaseErro,
        total: sorteioFiltrado.length,
        porFonte: contar(sorteioFiltrado.map((s) => ({ chave: s.source, rotulo: s.source }))),
      },
      legado: {
        abertos: legado.filter((d) => d.status === "open").length,
        perdidos: legado.filter((d) => d.status === "lost").length,
      },
    };

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
