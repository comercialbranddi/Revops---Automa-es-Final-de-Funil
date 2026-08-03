import { STAGES, type EventoDeal } from "./pipedrive";
import type {
  CanalResultado,
  DiaResultado,
  Leitura,
  LinhaFunilResultado,
  PerdaResultado,
  PessoaResultado,
  ResultadoEvento,
} from "./tipos";

/**
 * Fechamento do evento — a leitura que a liderança faz depois que acabou.
 *
 * Duas escolhas que valem explicar:
 *
 * 1. Ignora o filtro de período do painel. O número que se discute numa
 *    reunião de resultado é o do evento inteiro; deixar isso variar com um
 *    seletor no topo é receita pra duas pessoas citarem números diferentes.
 *
 * 2. Separa SEMPRE por canal. O estande e a landing page convertem em ordens
 *    de grandeza diferentes, então qualquer média que junte os dois esconde a
 *    única informação acionável que o evento produziu.
 */

/** Início da coorte. Os primeiros cards da campanha do evento são de 24/07. */
const INICIO_PADRAO = "2026-07-20T00:00:00Z";

const CANAL_ESTANDE = "Estande";
const CANAL_QR = "QR Estande";
const CANAL_LP = "Pré-cadastro LinkedIn";

function pct(parte: number, total: number): number {
  if (!total) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

function ehEstande(d: EventoDeal): boolean {
  return d.origem === CANAL_ESTANDE || d.origem === CANAL_QR;
}

function ehReuniao(d: EventoDeal): boolean {
  return d.stageId === STAGES.REUNIAO_AGENDADA || d.stageId === STAGES.REUNIAO_REALIZADA;
}

function diaBrt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}

export function montarResultado(
  todos: EventoDeal[],
  motivoChavePorDeal: Map<number, string>,
  temRelatorio: (d: EventoDeal) => boolean,
  inicioIso = process.env.EVENTO_INICIO || INICIO_PADRAO
): ResultadoEvento {
  const corte = new Date(inicioIso).getTime();
  const deals = todos.filter(
    (d) => d.stageId !== STAGES.EVENTO_ANTIGO && new Date(d.addTime).getTime() >= corte
  );

  const leads = deals.length;
  const reunioes = deals.filter(ehReuniao);
  const relatorios = deals.filter(temRelatorio);
  const contratos = deals.filter((d) => d.status === "won");
  const emailPessoal = deals.filter((d) => motivoChavePorDeal.get(d.id) === "contato_invalido");
  const empresas = new Set(deals.map((d) => d.orgId ?? `t:${d.title}`)).size;

  const datas = deals.map((d) => new Date(d.addTime).getTime()).sort((a, b) => a - b);

  // ── Funil ────────────────────────────────────────────────────────────
  const chegaramNaMonitoria = deals.filter(
    (d) => motivoChavePorDeal.get(d.id) !== "contato_invalido"
  ).length;
  const prospeccao = deals.filter(
    (d) => d.stageId === STAGES.PROSPECCAO_ATIVA || d.stageId === STAGES.SEM_RESPOSTA || d.stageId === STAGES.RESPONDEU
  ).length;

  // Só etapas REALMENTE aninhadas — cada uma é subconjunto da anterior, senão
  // a conversão passa de 100% e o funil vira ficção. "Relatório entregue" ficou
  // de fora de propósito: é um entregável, não um portão (card chega em
  // Prospecção Ativa sem ter o link do relatório gravado), e misturar os dois
  // produzia "127% da etapa anterior".
  const etapas: { rotulo: string; n: number; tom: LinhaFunilResultado["tom"] }[] = [
    { rotulo: "Leads captados", n: leads, tom: "neutro" },
    { rotulo: "Passaram do filtro de e-mail", n: chegaramNaMonitoria, tom: "atencao" },
    { rotulo: "Chegaram à prospecção", n: prospeccao + reunioes.length, tom: "ok" },
    { rotulo: "Reunião agendada", n: reunioes.length, tom: "ok" },
    { rotulo: "Contrato fechado", n: contratos.length, tom: contratos.length ? "ok" : "neutro" },
  ];

  const funil: LinhaFunilResultado[] = etapas.map((e, i) => ({
    rotulo: e.rotulo,
    n: e.n,
    pctDoTotal: pct(e.n, leads),
    pctDaAnterior: i === 0 ? null : pct(e.n, etapas[i - 1].n),
    tom: e.tom,
  }));

  // ── Canais ───────────────────────────────────────────────────────────
  const porCanal = new Map<string, EventoDeal[]>();
  for (const d of deals) {
    const canal = ehEstande(d)
      ? "Estande (ao vivo)"
      : d.origem === CANAL_LP
        ? "Landing page (pré-cadastro)"
        : "Origem não informada";
    const lista = porCanal.get(canal) ?? [];
    lista.push(d);
    porCanal.set(canal, lista);
  }

  const canais: CanalResultado[] = [...porCanal.entries()]
    .map(([canal, ds]) => {
      const r = ds.filter(ehReuniao).length;
      const ep = ds.filter((d) => motivoChavePorDeal.get(d.id) === "contato_invalido").length;
      return {
        canal,
        leads: ds.length,
        reunioes: r,
        taxaReuniao: pct(r, ds.length),
        emailPessoal: ep,
        taxaEmailPessoal: pct(ep, ds.length),
        relatorios: ds.filter(temRelatorio).length,
      };
    })
    .sort((a, b) => b.leads - a.leads);

  // Quantas reuniões os barrados renderiam se convertessem como os que
  // passaram, DENTRO do mesmo canal. Estimativa — está rotulada como tal na
  // tela. Usar a taxa geral aqui inflaria o número, porque o canal que mais
  // barra é justamente o que menos converte.
  let reunioesPerdidasEstimadas = 0;
  for (const ds of porCanal.values()) {
    const passaram = ds.filter((d) => motivoChavePorDeal.get(d.id) !== "contato_invalido");
    const barrados = ds.length - passaram.length;
    if (!passaram.length || !barrados) continue;
    const taxa = passaram.filter(ehReuniao).length / passaram.length;
    reunioesPerdidasEstimadas += Math.round(barrados * taxa);
  }

  // ── Perdas ───────────────────────────────────────────────────────────
  const duplicados = deals.filter((d) => /duplicad/i.test(d.lostReason || "")).length;
  const clienteAtivo = deals.filter((d) => motivoChavePorDeal.get(d.id) === "cliente_ativo").length;
  const baixaCaptura = deals.filter((d) =>
    (motivoChavePorDeal.get(d.id) || "").startsWith("baixa_captura")
  ).length;

  const perdas: PerdaResultado[] = [
    {
      rotulo: "E-mail pessoal na captação",
      n: emailPessoal.length,
      pct: pct(emailPessoal.length, leads),
      evitavel: true,
      explicacao:
        "O lead escreveu um gmail/hotmail no formulário e a captação barrou na entrada. " +
        "Nunca virou diagnóstico e não pontuou pra ninguém — é a maior perda do evento e a mais barata de resolver.",
    },
    {
      rotulo: "Duplicados (mesma empresa)",
      n: duplicados,
      pct: pct(duplicados, leads),
      evitavel: false,
      explicacao:
        "Cards fundidos automaticamente quando dois contatos da mesma empresa entraram. " +
        "É a automação funcionando — não é perda real de oportunidade.",
    },
    {
      rotulo: "Já era cliente Branddi",
      n: clienteAtivo,
      pct: pct(clienteAtivo, leads),
      evitavel: false,
      explicacao:
        "Marca já monitorada por nós. O gate tirou da pescaria pra não mandar diagnóstico " +
        "de concorrência pra quem já é cliente. Comportamento correto.",
    },
    {
      rotulo: "Poucos concorrentes na pescaria",
      n: baixaCaptura,
      pct: pct(baixaCaptura, leads),
      evitavel: false,
      explicacao:
        "A monitoria achou menos de 5 anunciantes na marca — sem material suficiente pro " +
        "relatório competitivo. Recebeu um e-mail genérico no lugar.",
    },
  ]
    .filter((p) => p.n > 0)
    .sort((a, b) => b.n - a.n);

  // ── Equipe ───────────────────────────────────────────────────────────
  const mapaPessoa = new Map<string, PessoaResultado>();
  for (const d of deals) {
    for (const pessoa of d.colaboradores) {
      const l =
        mapaPessoa.get(pessoa) ??
        {
          pessoa,
          estandeLeads: 0,
          estandeReunioes: 0,
          lpLeads: 0,
          lpReunioes: 0,
          total: 0,
          reunioes: 0,
          taxa: 0,
        };
      const reuniao = ehReuniao(d);
      l.total += 1;
      if (reuniao) l.reunioes += 1;
      if (ehEstande(d)) {
        l.estandeLeads += 1;
        if (reuniao) l.estandeReunioes += 1;
      } else if (d.origem === CANAL_LP) {
        l.lpLeads += 1;
        if (reuniao) l.lpReunioes += 1;
      }
      mapaPessoa.set(pessoa, l);
    }
  }
  const equipe = [...mapaPessoa.values()]
    .map((l) => ({ ...l, taxa: pct(l.reunioes, l.total) }))
    .sort((a, b) => b.reunioes - a.reunioes || b.total - a.total);

  // ── Linha do tempo ───────────────────────────────────────────────────
  const dias = new Map<string, DiaResultado>();
  for (const d of deals) {
    const dia = diaBrt(d.addTime);
    const linha = dias.get(dia) ?? { dia, leads: 0, reunioes: 0 };
    linha.leads += 1;
    if (ehReuniao(d)) linha.reunioes += 1;
    dias.set(dia, linha);
  }
  const linhaDoTempo = [...dias.values()].sort((a, b) => {
    const [da, ma] = a.dia.split("/").map(Number);
    const [db, mb] = b.dia.split("/").map(Number);
    return ma - mb || da - db;
  });

  return {
    janelaDe: datas.length ? new Date(datas[0]).toISOString() : inicioIso,
    janelaAte: datas.length ? new Date(datas[datas.length - 1]).toISOString() : inicioIso,
    totais: {
      leads,
      empresas,
      reunioes: reunioes.length,
      relatorios: relatorios.length,
      contratos: contratos.length,
      taxaReuniao: pct(reunioes.length, leads),
      emailPessoal: emailPessoal.length,
      taxaEmailPessoal: pct(emailPessoal.length, leads),
    },
    funil,
    canais,
    perdas,
    equipe,
    linhaDoTempo,
    reunioesPerdidasEstimadas,
    leituras: montarLeituras({ canais, perdas, equipe, reunioesPerdidasEstimadas, leads, reunioes: reunioes.length }),
  };
}

/**
 * As conclusões saem dos dados, não de texto fixo — se num próximo evento o
 * estande deixar de ganhar da LP, a leitura muda junto em vez de mentir.
 */
function montarLeituras(d: {
  canais: CanalResultado[];
  perdas: PerdaResultado[];
  equipe: PessoaResultado[];
  reunioesPerdidasEstimadas: number;
  leads: number;
  reunioes: number;
}): Leitura[] {
  const leituras: Leitura[] = [];

  const comVolume = d.canais.filter((c) => c.leads >= 20);
  const melhor = [...comVolume].sort((a, b) => b.taxaReuniao - a.taxaReuniao)[0];
  const pior = [...comVolume].sort((a, b) => a.taxaReuniao - b.taxaReuniao)[0];

  if (melhor && pior && melhor.canal !== pior.canal && pior.taxaReuniao > 0) {
    const fator = (melhor.taxaReuniao / pior.taxaReuniao).toFixed(1);
    leituras.push({
      tom: "ok",
      titulo: `${melhor.canal} converte ${fator}× mais que ${pior.canal.toLowerCase()}`,
      texto:
        `${melhor.taxaReuniao}% dos leads do ${melhor.canal.toLowerCase()} viraram reunião (${melhor.reunioes} de ${melhor.leads}), ` +
        `contra ${pior.taxaReuniao}% do ${pior.canal.toLowerCase()} (${pior.reunioes} de ${pior.leads}). ` +
        `O ${pior.canal.toLowerCase()} trouxe ${pior.leads > melhor.leads ? "mais" : "menos"} volume, mas a conversa ` +
        `cara a cara é o que fecha agenda. Num próximo evento, vale dimensionar o time pelo balcão, não pela mídia.`,
    });
  }

  const emailPessoal = d.perdas.find((p) => p.evitavel);
  if (emailPessoal && emailPessoal.pct >= 10) {
    leituras.push({
      tom: "critico",
      titulo: `${emailPessoal.pct}% dos leads morreram no campo de e-mail`,
      texto:
        `${emailPessoal.n} pessoas preencheram o formulário com e-mail pessoal e o fluxo parou ali — ` +
        `sem diagnóstico, sem relatório, sem ponto pro time. Pela taxa de conversão de cada canal, ` +
        `isso equivale a cerca de ${d.reunioesPerdidasEstimadas} ${d.reunioesPerdidasEstimadas > 1 ? "reuniões" : "reunião"} que não aconteceram. ` +
        `É a correção mais barata do próximo evento: validar o domínio no próprio formulário, ` +
        `avisando na hora em vez de descartar depois.`,
    });
  }

  const noBalcao = d.equipe.filter((p) => p.estandeLeads >= 10);
  if (noBalcao.length >= 3) {
    const taxas = noBalcao.map((p) => ({ p, t: pct(p.estandeReunioes, p.estandeLeads) }));
    const top = [...taxas].sort((a, b) => b.t - a.t)[0];
    const media = Math.round((taxas.reduce((s, x) => s + x.t, 0) / taxas.length) * 10) / 10;
    if (top.t > media * 1.4) {
      leituras.push({
        tom: "info",
        titulo: `No balcão, ${top.p.pessoa} converte bem acima da média do time`,
        texto:
          `${top.t}% dos leads que ${top.p.pessoa} captou no estande viraram reunião, contra ${media}% de média ` +
          `entre quem atendeu o balcão. Com ${top.p.estandeLeads} leads a amostra é pequena pra cravar, mas é ` +
          `barato descobrir o que essa abordagem tem de diferente e treinar o resto do time nela.`,
      });
    }
  }

  const semRelatorio = d.canais.reduce((s, c) => s + c.leads - c.relatorios, 0);
  if (semRelatorio > 0 && d.leads > 0) {
    leituras.push({
      tom: "atencao",
      titulo: "A maior parte dos leads nunca recebeu o relatório competitivo",
      texto:
        `${semRelatorio} dos ${d.leads} leads não têm relatório entregue. Parte é descarte legítimo ` +
        `(cliente ativo, e-mail pessoal, marca sem concorrência detectada), mas é o número que mais pesa ` +
        `no aproveitamento do evento: o relatório é o que dá motivo pra segunda conversa.`,
    });
  }

  return leituras;
}
