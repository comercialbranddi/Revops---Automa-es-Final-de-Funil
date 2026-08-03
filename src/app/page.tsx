"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EventosData } from "@/lib/tipos";
import { Kpi, Secao, fmtData, fmtDuracao } from "@/components/ui";
import { Alertas, AoVivo, Funil, MovimentoPorHora, Novos } from "@/components/fluxo";
import { Clientes, Erros, Placar, Relatorios, Reprovados } from "@/components/erros";
import {
  Canais,
  EquipeResultado,
  FunilResultado,
  Leituras,
  LinhaDoTempo,
  Perdas,
  ResumoExecutivo,
} from "@/components/resultado";
import { Participantes } from "@/components/equipe";

const PERIODOS = [
  { dias: 1, rotulo: "Hoje" },
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 0, rotulo: "Tudo" },
];

const INTERVALO_MS = 60_000;

type Aba = "resultado" | "funil" | "equipe";

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: "resultado", rotulo: "Resultado do evento" },
  { chave: "funil", rotulo: "Funil e erros" },
  { chave: "equipe", rotulo: "Equipe e placar" },
];

export default function Home() {
  const [data, setData] = useState<EventosData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [dias, setDias] = useState(7);
  const [aba, setAba] = useState<Aba>("resultado");
  const [novosDesdeUltima, setNovosDesdeUltima] = useState(0);
  const totalAnterior = useRef<number | null>(null);

  const carregar = useCallback(
    async (periodo: number) => {
      try {
        const res = await fetch(`/api/eventos?dias=${periodo}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Falha ao carregar dados");
        // Diferença de cards entre dois refreshes — sinaliza entrada nova sem
        // precisar recarregar a página.
        if (totalAnterior.current !== null && json.periodoDias === periodo) {
          const delta = json.kpis.entraramNoPeriodo - totalAnterior.current;
          if (delta > 0) setNovosDesdeUltima((n) => n + delta);
        }
        totalAnterior.current = json.kpis.entraramNoPeriodo;
        setData(json);
        setErro(null);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setCarregando(false);
      }
    },
    []
  );

  useEffect(() => {
    setCarregando(true);
    totalAnterior.current = null;
    setNovosDesdeUltima(0);
    carregar(dias);
    const id = setInterval(() => carregar(dias), INTERVALO_MS);
    return () => clearInterval(id);
  }, [dias, carregar]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <header className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-6">
        <div className="text-xs font-medium tracking-wide text-cyan-400">
          BRANDDI · REVOPS · OBSERVABILIDADE
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-50">
          Funil de Eventos, ponta a ponta e ao vivo
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Pipeline <strong className="text-slate-300">7. Eventos</strong> (25) no Pipedrive. O lead entra
          por pré-cadastro, estande ou QR; a Lia roda a monitoria de marca, gera o relatório competitivo e
          decide se o card segue pra prospecção ou trava. Este painel mostra o que está entrando, onde
          trava, o que já foi resolvido e o que precisa de mão humana.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Pipedrive ao vivo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${data?.fontes.supabase ? "bg-emerald-400" : "bg-slate-600"}`}
            />
            Supabase (Lia) {data?.fontes.supabase ? "conectado" : "não conectado"}
          </span>
          {data && <span>Atualizado {fmtData(data.atualizadoEm)}</span>}
          <button
            onClick={() => carregar(dias)}
            className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-300 transition hover:bg-slate-800"
          >
            Atualizar agora
          </button>
          {novosDesdeUltima > 0 && (
            <span className="rounded-full border border-cyan-800 bg-cyan-950/50 px-2.5 py-1 font-medium text-cyan-300">
              +{novosDesdeUltima} card(s) desde que você abriu
            </span>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-1 border-b border-slate-800">
          {ABAS.map((a) => (
            <button
              key={a.chave}
              onClick={() => setAba(a.chave)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                aba === a.chave
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Período:</span>
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                dias === p.dias
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                  : "border-slate-700 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </header>

      {carregando && <p className="mt-6 text-slate-400">Carregando Pipedrive e Supabase…</p>}
      {erro && (
        <div className="mt-6 rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-rose-300">
          Erro ao carregar: {erro}
        </div>
      )}

      {data && aba === "resultado" && (
        <>
          <Secao
            titulo="Resultado do evento"
            subtitulo="O fechamento, ponta a ponta. Números do evento inteiro — não mudam com o filtro de período."
          >
            <ResumoExecutivo r={data.resultado} />
          </Secao>

          <Secao
            titulo="A leitura"
            subtitulo="O que os números dizem, e o que fazer diferente no próximo evento."
          >
            <Leituras r={data.resultado} />
          </Secao>

          <Secao
            titulo="Do lead ao contrato"
            subtitulo="Quanto sobra em cada etapa, em número absoluto e em conversão da etapa anterior."
          >
            <FunilResultado r={data.resultado} />
          </Secao>

          <Secao
            titulo="Estande x landing page"
            subtitulo="O corte que mais explica o resultado — os dois canais jogam jogos diferentes."
          >
            <Canais r={data.resultado} />
          </Secao>

          <Secao
            titulo="Onde o funil perdeu gente"
            subtitulo="Separando o que era descarte legítimo do que era perda evitável."
          >
            <Perdas r={data.resultado} />
          </Secao>

          <Secao
            titulo="Desempenho por pessoa"
            subtitulo="Volume e conversão, sempre com o canal ao lado — sem isso a comparação é injusta."
          >
            <EquipeResultado r={data.resultado} />
          </Secao>

          <Secao
            titulo="Dia a dia do evento"
            subtitulo="Quando os leads entraram e quando viraram reunião."
          >
            <LinhaDoTempo r={data.resultado} />
          </Secao>

          <Rodape />
        </>
      )}

      {data && aba === "funil" && (
        <>
          <Secao
            titulo="O que precisa de atenção"
            subtitulo="Leitura rápida antes do detalhe — cada card é um número e uma decisão."
          >
            <Alertas alertas={data.alertas} />
          </Secao>

          <Secao titulo="Números do período">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Kpi
                label="Entraram"
                valor={data.kpis.entraramNoPeriodo}
                nota={`${data.kpis.entraramHoje} hoje · ${data.kpis.ultimaHora} na última hora`}
                tom="info"
              />
              <Kpi
                label="Abertos no funil"
                valor={data.kpis.abertosNoFunil}
                nota="cards vivos no pipeline 25"
              />
              <Kpi
                label="Processando agora"
                valor={data.kpis.processandoAgora}
                nota="cards com automação rodando"
                tom="info"
              />
              <Kpi
                label="Travados"
                valor={data.kpis.travados}
                nota="acima do SLA em Novo Lead/Monitoria"
                tom={data.kpis.travados > 0 ? "critico" : "ok"}
              />
              <Kpi
                label="Relatório gerado"
                valor={data.kpis.relatoriosEnviados}
                nota={`${data.kpis.taxaRelatorio}% dos cards já processados`}
                tom="ok"
              />
              <Kpi
                label="Tempo até relatório"
                valor={fmtDuracao(data.kpis.medianaMinutosAteRelatorio)}
                nota="mediana da entrada até o envio"
                tom="info"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Kpi
                label="Erros abertos"
                valor={data.kpis.errosAbertos}
                nota="falhas técnicas ainda não resolvidas"
                tom={data.kpis.errosAbertos > 0 ? "critico" : "ok"}
              />
              <Kpi
                label="Erros resolvidos (24h)"
                valor={data.kpis.errosResolvidos24h}
                nota="cards que voltaram a andar sozinhos"
                tom="ok"
              />
              <Kpi
                label="Clientes ativos barrados"
                valor={data.kpis.clientesAtivos}
                nota="gate de cliente Branddi — comportamento esperado"
              />
            </div>
          </Secao>

          <Secao
            titulo="O funil ponta a ponta"
            subtitulo="Cards abertos agora em cada etapa. A saída lateral é onde o fluxo perde volume."
          >
            <Funil
              funil={data.funil}
              saidaLateral={data.saidaLateral}
              origens={data.origens}
              legado={data.legado}
            />
          </Secao>

          <Secao
            titulo="Movimento nas últimas 24 horas"
            subtitulo="Entrada, conclusão e reprovação hora a hora — passe o mouse pra ver os números."
          >
            <MovimentoPorHora porHora={data.porHora} />
          </Secao>

          <Secao
            titulo="Fluxo ao vivo — o que a automação está fazendo agora"
            subtitulo="Cards com processamento em andamento, esperando ou em erro. Clique pra abrir a timeline completa."
          >
            <AoVivo cards={data.aoVivo} supabaseOk={data.fontes.supabase} />
          </Secao>

          <Secao
            titulo="Cards novos"
            subtitulo="Últimos cards abertos, com a situação que a automação registrou pra cada um."
          >
            <Novos cards={data.novos} />
          </Secao>

          <Secao
            titulo="Erros técnicos — abertos e resolvidos"
            subtitulo="Falhas de automação registradas por card. Um erro aberto é um card que não segue sozinho."
          >
            <Erros erros={data.erros} supabaseOk={data.fontes.supabase} />
          </Secao>

          <Secao
            titulo="Relatório Reprovado — o motivo de cada card"
            subtitulo="Cards que pararam antes da prospecção. Clientes ativos têm seção própria abaixo."
          >
            <Reprovados cards={data.reprovados} porMotivo={data.reprovadosPorMotivo} />
          </Secao>

          <Secao
            titulo="Clientes Branddi ativos"
            subtitulo="Marcas que já monitoramos — não geram pescaria nem relatório competitivo, só o e-mail do sorteio."
          >
            <Clientes cards={data.clientes} />
          </Secao>

          <Secao
            titulo="Relatórios gerados"
            subtitulo="Cards que já receberam o relatório competitivo, com o link publicado no report-engine."
          >
            <Relatorios cards={data.relatorios} />
          </Secao>

          <Rodape />
        </>
      )}

      {data && aba === "equipe" && (
        <>
          <Secao
            titulo="Cada participante do time"
            subtitulo="Quantos leads cada pessoa trouxe, por canal, e no que eles viraram."
          >
            <Participantes equipe={data.equipe} placar={data.placar} />
          </Secao>

          <Secao
            titulo="Placar de pontos"
            subtitulo="1pt lead capturado · 30pt reunião agendada · 300pt contrato fechado."
          >
            <Placar placar={data.placar} />
          </Secao>

          <Rodape />
        </>
      )}

    </main>
  );
}

function Rodape() {
  return (
    <footer className="mt-16 border-t border-slate-800 pt-6 text-xs leading-relaxed text-slate-600">
      Fontes: Pipedrive (pipeline 25, abertos via v1 e perdidos/ganhos via v2) e Supabase da Lia
      (<code>deal_processing_logs</code>, <code>automation_errors</code>,{" "}
      <code>event_report_dispatches</code>, <code>evento_placar_pontos</code>). Atualiza sozinho a cada
      60s. Só o pipeline de Eventos — nenhum dado de outros funis entra aqui.
    </footer>
  );
}
