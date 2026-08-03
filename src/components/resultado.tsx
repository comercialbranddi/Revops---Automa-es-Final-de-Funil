"use client";

import type { ResultadoEvento } from "@/lib/tipos";
import { Kpi, Painel, Tabela, TOM_BORDA, TOM_PONTO, TOM_TEXTO, Vazio, type Tom } from "./ui";

const LEITURA_TOM: Record<string, Tom> = {
  ok: "ok",
  atencao: "atencao",
  critico: "critico",
  info: "info",
};

function fmtDia(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}

export function ResumoExecutivo({ r }: { r: ResultadoEvento }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Leads captados" valor={r.totais.leads.toLocaleString("pt-BR")} nota={`${r.totais.empresas.toLocaleString("pt-BR")} empresas distintas`} tom="info" />
        <Kpi label="Reuniões agendadas" valor={r.totais.reunioes} nota={`${r.totais.taxaReuniao}% dos leads`} tom="ok" />
        <Kpi label="Relatórios entregues" valor={r.totais.relatorios} nota="diagnóstico competitivo enviado" tom="ok" />
        <Kpi label="Contratos" valor={r.totais.contratos} nota={r.totais.contratos ? "fechados no funil" : "nenhum fechado ainda"} tom={r.totais.contratos ? "ok" : "neutro"} />
        <Kpi label="Perdidos no e-mail" valor={r.totais.emailPessoal} nota={`${r.totais.taxaEmailPessoal}% — perda evitável`} tom="critico" />
        <Kpi label="Período" valor={`${fmtDia(r.janelaDe)}–${fmtDia(r.janelaAte)}`} nota="do primeiro ao último lead" />
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Estes números cobrem o evento inteiro e <strong className="text-slate-400">não mudam</strong> com o
        filtro de período do topo — é o fechamento, pra todo mundo citar o mesmo número.
      </p>
    </>
  );
}

export function Leituras({ r }: { r: ResultadoEvento }) {
  if (!r.leituras.length) return <Vazio>Sem leitura destacada — os canais performaram parecido.</Vazio>;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {r.leituras.map((l, i) => {
        const tom = LEITURA_TOM[l.tom] || "neutro";
        return (
          <div
            key={i}
            className={`min-w-0 rounded-xl border border-slate-800 border-l-4 bg-slate-900/50 p-5 ${TOM_BORDA[tom]}`}
          >
            <h3 className={`font-semibold ${TOM_TEXTO[tom]}`}>{l.titulo}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{l.texto}</p>
          </div>
        );
      })}
    </div>
  );
}

export function FunilResultado({ r }: { r: ResultadoEvento }) {
  const max = Math.max(1, ...r.funil.map((f) => f.n));
  return (
    <Painel>
      <div className="space-y-3">
        {r.funil.map((f, i) => (
          <div key={f.rotulo} className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-slate-300">{f.rotulo}</span>
              <span className="shrink-0 tabular-nums text-slate-400">
                <strong className={TOM_TEXTO[f.tom]}>{f.n.toLocaleString("pt-BR")}</strong>
                <span className="ml-2 text-xs text-slate-500">{f.pctDoTotal}% do total</span>
                {f.pctDaAnterior !== null && (
                  <span className="ml-2 text-xs text-slate-600">
                    · {f.pctDaAnterior}% da etapa anterior
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${TOM_PONTO[f.tom]}`}
                style={{ width: `${Math.max(1, (f.n / max) * 100)}%` }}
              />
            </div>
            {i === 0 && (
              <p className="mt-1 text-[11px] text-slate-600">
                A queda pra linha de baixo é o filtro de e-mail — acontece antes de qualquer automação
                rodar.
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-slate-800 pt-3 text-xs leading-relaxed text-slate-500">
        Cada linha é subconjunto da anterior, então a conversão nunca passa de 100%. Os{" "}
        <strong className="text-slate-400">{r.totais.relatorios} relatórios entregues</strong> ficam
        fora do funil de propósito: são um entregável, não um portão — dá pra chegar em prospecção sem o
        link do relatório gravado no card.
      </p>
    </Painel>
  );
}

export function Canais({ r }: { r: ResultadoEvento }) {
  const melhor = [...r.canais].filter((c) => c.leads >= 20).sort((a, b) => b.taxaReuniao - a.taxaReuniao)[0];
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {r.canais.map((c) => {
          const destaque = melhor && c.canal === melhor.canal;
          return (
            <div
              key={c.canal}
              className={`min-w-0 rounded-xl border bg-slate-900/50 p-5 ${
                destaque ? "border-emerald-800" : "border-slate-800"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold text-slate-100">{c.canal}</h3>
                {destaque && <span className="text-[11px] font-medium text-emerald-400">melhor conversão</span>}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className={`text-3xl font-semibold tabular-nums ${destaque ? "text-emerald-400" : "text-slate-100"}`}>
                  {c.taxaReuniao}%
                </span>
                <span className="text-xs text-slate-500">viraram reunião</span>
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Leads</dt>
                  <dd className="tabular-nums text-slate-300">{c.leads.toLocaleString("pt-BR")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Reuniões</dt>
                  <dd className="tabular-nums text-emerald-400">{c.reunioes}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Relatórios</dt>
                  <dd className="tabular-nums text-slate-300">{c.relatorios}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Barrados no e-mail</dt>
                  <dd className="tabular-nums text-amber-400">
                    {c.emailPessoal} <span className="text-slate-600">({c.taxaEmailPessoal}%)</span>
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Comparar canal por canal é o ponto mais importante desta página: a média juntando os dois
        esconde a diferença. Volume e conversão puxam pra lados opostos — a landing traz escala, o
        balcão traz agenda.
      </p>
    </>
  );
}

export function Perdas({ r }: { r: ResultadoEvento }) {
  const total = r.perdas.reduce((s, p) => s + p.n, 0);
  return (
    <>
      <div className="space-y-3">
        {r.perdas.map((p) => (
          <div
            key={p.rotulo}
            className={`min-w-0 rounded-xl border border-slate-800 border-l-4 bg-slate-900/40 p-4 ${
              p.evitavel ? TOM_BORDA.critico : TOM_BORDA.neutro
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-medium text-slate-100">
                {p.rotulo}{" "}
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    p.evitavel
                      ? "bg-rose-500/15 text-rose-300"
                      : "bg-slate-700/40 text-slate-400"
                  }`}
                >
                  {p.evitavel ? "evitável" : "esperado"}
                </span>
              </h3>
              <span className="tabular-nums text-slate-300">
                <strong className={p.evitavel ? "text-rose-400" : "text-slate-300"}>{p.n}</strong>
                <span className="ml-1.5 text-xs text-slate-500">{p.pct}% dos leads</span>
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{p.explicacao}</p>
          </div>
        ))}
      </div>
      {r.reunioesPerdidasEstimadas > 0 && (
        <Painel className="mt-4">
          <p className="text-sm leading-relaxed text-slate-300">
            Se os leads barrados por e-mail pessoal tivessem convertido na mesma taxa dos que passaram{" "}
            <em>dentro do próprio canal</em>, o evento teria fechado com cerca de{" "}
            <strong className="text-rose-300">
              +{r.reunioesPerdidasEstimadas} {r.reunioesPerdidasEstimadas > 1 ? "reuniões" : "reunião"}
            </strong>{" "}
            — {Math.round((r.reunioesPerdidasEstimadas / Math.max(1, r.totais.reunioes)) * 100)}% a mais
            que as {r.totais.reunioes} que aconteceram.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            É uma <strong className="text-slate-400">estimativa</strong>, não um número observado: assume
            que quem escreve e-mail pessoal tem o mesmo interesse de quem escreve o corporativo, o que
            pode não ser verdade. Serve pra dimensionar a ordem de grandeza da correção, não pra meta.
          </p>
        </Painel>
      )}
      <p className="mt-3 text-xs text-slate-500">
        {total.toLocaleString("pt-BR")} cards classificados em algum motivo de parada. O resto seguiu o
        fluxo ou ainda está em aberto.
      </p>
    </>
  );
}

export function EquipeResultado({ r }: { r: ResultadoEvento }) {
  if (!r.equipe.length) return <Vazio>Nenhum card do evento tem colaborador preenchido.</Vazio>;
  const taxa = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <>
      <Tabela
        cabecalho={[
          "Pessoa",
          "Reuniões",
          "Leads",
          "Conversão",
          "Estande — leads",
          "Estande — conversão",
          "LP — leads",
          "LP — conversão",
        ]}
      >
        {r.equipe.map((p) => (
          <tr key={p.pessoa} className="bg-slate-950/30">
            <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-200">{p.pessoa}</td>
            <td className="px-4 py-2.5 text-base font-semibold tabular-nums text-emerald-400">
              {p.reunioes || "—"}
            </td>
            <td className="px-4 py-2.5 tabular-nums text-slate-300">{p.total}</td>
            <td className="px-4 py-2.5 tabular-nums text-slate-400">{p.taxa}%</td>
            <td className="px-4 py-2.5 tabular-nums text-slate-400">{p.estandeLeads || "—"}</td>
            <td className="px-4 py-2.5 tabular-nums text-cyan-300">
              {taxa(p.estandeReunioes, p.estandeLeads)}
            </td>
            <td className="px-4 py-2.5 tabular-nums text-slate-400">{p.lpLeads || "—"}</td>
            <td className="px-4 py-2.5 tabular-nums text-slate-500">{taxa(p.lpReunioes, p.lpLeads)}</td>
          </tr>
        ))}
      </Tabela>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        As duas últimas duplas de coluna existem pra evitar a leitura injusta: quem ficou na landing page
        tinha um teto de conversão muito mais baixo que quem ficou no balcão, independente de esforço.
        Comparar pessoas só faz sentido <strong className="text-slate-400">dentro do mesmo canal</strong>.
        Card trabalhado por duas pessoas conta pras duas.
      </p>
    </>
  );
}

export function LinhaDoTempo({ r }: { r: ResultadoEvento }) {
  const maxLeads = Math.max(1, ...r.linhaDoTempo.map((d) => d.leads));
  return (
    <Painel>
      <div className="space-y-3">
        {r.linhaDoTempo.map((d) => (
          <div key={d.dia} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="tabular-nums text-slate-400">{d.dia}</span>
              <span className="tabular-nums text-slate-400">
                <strong className="text-slate-200">{d.leads.toLocaleString("pt-BR")}</strong> leads
                {d.reunioes > 0 && (
                  <span className="ml-2 text-emerald-400">{d.reunioes} reuniões</span>
                )}
              </span>
            </div>
            <div className="mt-1 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-cyan-500/70"
                style={{ width: `${(d.leads / maxLeads) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Painel>
  );
}
