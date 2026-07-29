"use client";

import { useMemo, useState } from "react";
import type { EventosData, Participante } from "@/lib/tipos";
import { Etiqueta, Kpi, Painel, Tabela, Vazio, fmtData } from "./ui";

export function Participantes({
  equipe,
  placarDisponivel,
}: {
  equipe: Participante[];
  placarDisponivel: boolean;
}) {
  if (!equipe.length) {
    return (
      <Vazio>
        Nenhum card do período tem colaborador preenchido no campo Observação/Status.
      </Vazio>
    );
  }

  const totais = equipe.reduce(
    (acc, p) => ({
      estande: acc.estande + p.estande + p.qrEstande,
      preCadastro: acc.preCadastro + p.preCadastro,
      reunioes: acc.reunioes + p.reunioesAgendadas + p.reunioesRealizadas,
      relatorios: acc.relatorios + p.relatorios,
    }),
    { estande: 0, preCadastro: 0, reunioes: 0, relatorios: 0 }
  );

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Pessoas captando" valor={equipe.length} nota="com pelo menos 1 card no período" />
        <Kpi
          label="Leads pelo estande"
          valor={totais.estande}
          nota="formulário e QR, ao vivo no balcão"
          tom="info"
        />
        <Kpi
          label="Leads pela LP"
          valor={totais.preCadastro}
          nota="pré-cadastro, antes do evento"
          tom="info"
        />
        <Kpi label="Reuniões" valor={totais.reunioes} nota="agendadas + realizadas" tom="ok" />
      </div>

      <Tabela
        cabecalho={[
          "Pessoa",
          "Total",
          "Estande",
          "QR",
          "LP (pré-cadastro)",
          "Reunião agendada",
          "Reunião realizada",
          "Relatórios",
          "E-mail pessoal",
          ...(placarDisponivel ? ["Pontos"] : []),
        ]}
      >
        {equipe.map((p) => (
          <tr key={p.pessoa} className="bg-slate-950/30">
            <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-200">{p.pessoa}</td>
            <td className="px-4 py-2.5 text-base font-semibold tabular-nums text-slate-100">{p.total}</td>
            <td className="px-4 py-2.5 tabular-nums text-slate-400">{p.estande || "—"}</td>
            <td className="px-4 py-2.5 tabular-nums text-slate-400">{p.qrEstande || "—"}</td>
            <td className="px-4 py-2.5 tabular-nums text-slate-400">{p.preCadastro || "—"}</td>
            <td className="px-4 py-2.5 tabular-nums text-emerald-400">{p.reunioesAgendadas || "—"}</td>
            <td className="px-4 py-2.5 tabular-nums text-emerald-400">{p.reunioesRealizadas || "—"}</td>
            <td className="px-4 py-2.5 tabular-nums text-slate-400">{p.relatorios || "—"}</td>
            <td className="px-4 py-2.5 tabular-nums text-amber-400">{p.emailPessoal || "—"}</td>
            {placarDisponivel && (
              <td className="px-4 py-2.5 text-base font-semibold tabular-nums text-cyan-300">
                {p.pontos ?? "—"}
              </td>
            )}
          </tr>
        ))}
      </Tabela>

      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        Quem captou o lead sai do campo <strong className="text-slate-400">Observação/Status</strong> do
        card, preenchido pelas Edge Functions de captação. Card trabalhado por duas pessoas conta pras
        duas — por isso a soma da coluna Total pode passar do número de cards do período.
        {!placarDisponivel && " A coluna de pontos precisa da credencial do Supabase."}
      </p>
    </>
  );
}

export function Sorteio({ sorteio }: { sorteio: EventosData["sorteio"] }) {
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return sorteio.entradas;
    return sorteio.entradas.filter(
      (e) =>
        e.nome.toLowerCase().includes(termo) || (e.email || "").toLowerCase().includes(termo)
    );
  }, [busca, sorteio.entradas]);

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi
          label="Entradas no sorteio"
          valor={sorteio.total}
          nota={sorteio.aproximado ? "aproximado pelo Pipedrive" : "1 entrada por pessoa por canal"}
          tom={sorteio.aproximado ? "atencao" : "info"}
        />
        {sorteio.porFonte.map((f) => (
          <Kpi key={f.chave} label={f.rotulo} valor={f.n} nota="canal de participação" />
        ))}
      </div>

      {sorteio.aproximado && (
        <div className="mb-4 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm leading-relaxed text-amber-200/90">
          Este número é uma <strong>aproximação</strong>: sem a credencial do Supabase o painel conta os
          cards de pré-cadastro em vez das entradas reais. A entrada do sorteio é por{" "}
          <strong>pessoa</strong> e o card é por <strong>organização</strong>, então duas pessoas da
          mesma empresa viram um card só e o total real é maior. A lista nominal, que é o que serve pra
          sortear, também só existe no Supabase.
        </div>
      )}

      {!sorteio.aproximado && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail…"
              className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-600 focus:outline-none"
            />
            <span className="text-xs text-slate-500">
              {filtradas.length} de {sorteio.entradas.length} entradas
            </span>
          </div>

          {filtradas.length === 0 ? (
            <Vazio>Nenhuma entrada corresponde à busca.</Vazio>
          ) : (
            <Tabela cabecalho={["#", "Participante", "E-mail", "Canal", "Entrou em", ""]}>
              {filtradas.map((e, i) => (
                <tr key={`${e.nome}-${e.criadoEm}-${i}`} className="bg-slate-950/30">
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">{i + 1}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-200">{e.nome}</td>
                  <td className="px-4 py-2.5 text-slate-400">{e.email || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Etiqueta tom="info">
                      {e.fonte === "pre_cadastro" ? "Pré-cadastro (LP)" : e.fonte}
                    </Etiqueta>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">{fmtData(e.criadoEm)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {e.link ? (
                      <a
                        href={e.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline"
                      >
                        Card →
                      </a>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </Tabela>
          )}
        </>
      )}

      <Painel className="mt-4">
        <p className="text-xs leading-relaxed text-slate-500">
          Hoje só o <strong className="text-slate-400">pré-cadastro da landing page</strong> gera entrada
          no sorteio — é a participação extra prometida na nota do card. O estande não grava entrada. Cada
          pessoa entra uma vez por canal, então quem preencher por mais de um canal acumula.
        </p>
      </Painel>
    </>
  );
}
