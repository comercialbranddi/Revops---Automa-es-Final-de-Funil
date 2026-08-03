import type { EventosData, Participante } from "@/lib/tipos";
import { Kpi, Tabela, Vazio } from "./ui";

export function Participantes({
  equipe,
  placar,
}: {
  equipe: Participante[];
  placar: EventosData["placar"];
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
      reunioes: acc.reunioes + p.reunioes,
      pontos: acc.pontos + (p.pontos ?? 0),
    }),
    { estande: 0, preCadastro: 0, reunioes: 0, pontos: 0 }
  );

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Pessoas captando" valor={equipe.length} nota="com card ou ponto no período" />
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
        <Kpi
          label="Reuniões"
          valor={totais.reunioes}
          nota={placar.detalhado ? "do placar, acumulado" : "cards em Reunião Agendada/Realizada"}
          tom="ok"
        />
      </div>

      <Tabela
        cabecalho={[
          "Pessoa",
          "Pontos",
          "Leads",
          "Estande",
          "QR",
          "LP (pré-cadastro)",
          "Reuniões",
          "Relatórios",
          "E-mail pessoal (não pontua)",
        ]}
      >
        {equipe.map((p) => (
          <tr key={p.pessoa} className="bg-slate-950/30">
            <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-200">{p.pessoa}</td>
            <td className="px-4 py-2.5 text-base font-semibold tabular-nums text-cyan-300">
              {p.pontos ?? "—"}
            </td>
            <td className="px-4 py-2.5 text-base font-semibold tabular-nums text-slate-100">
              {p.total || "—"}
            </td>
            <td className="px-4 py-2.5 tabular-nums text-slate-400">{p.estande || "—"}</td>
            <td className="px-4 py-2.5 tabular-nums text-slate-400">{p.qrEstande || "—"}</td>
            <td className="px-4 py-2.5 tabular-nums text-slate-400">{p.preCadastro || "—"}</td>
            <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-emerald-400">
              {p.reunioes || "—"}
              {p.reunioesRealizadas > 0 && (
                <span className="ml-1 text-[11px] text-slate-500">
                  ({p.reunioesRealizadas} realizada{p.reunioesRealizadas > 1 ? "s" : ""})
                </span>
              )}
            </td>
            <td className="px-4 py-2.5 tabular-nums text-slate-400">{p.relatorios || "—"}</td>
            <td className="px-4 py-2.5 tabular-nums text-amber-400">{p.emailPessoal || "—"}</td>
          </tr>
        ))}
      </Tabela>

      <div className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-500">
        <p>
          <strong className="text-slate-400">Pontos</strong> vêm do placar oficial (mesma fonte do
          placar do formulário), acumulados desde o começo do evento — não mudam quando você troca o
          período aqui em cima. <strong className="text-slate-400">Leads</strong> e os canais vêm dos
          cards do Pipedrive e respeitam o período.
        </p>
        <p>
          <strong className="text-slate-400">Reuniões</strong>{" "}
          {placar.detalhado
            ? "saem do ledger do placar: o ponto é registrado quando a reunião é marcada e não some quando o card anda de etapa."
            : "estão sendo contadas pela etapa atual do card (Reunião Agendada/Realizada). Com a credencial do Supabase elas passam a sair do ledger do placar, que é acumulado e não perde o registro quando o card anda."}
        </p>
        <p>
          <strong className="text-slate-400">E-mail pessoal</strong> são leads que a captação barrou por
          domínio genérico — <strong className="text-slate-400">esses não contam ponto</strong> pra
          ninguém, o card já nasce em Relatório Reprovado.
        </p>
        <p>
          Quem captou sai do campo Observação/Status do card. Card trabalhado por duas pessoas conta
          pras duas, então a soma da coluna Leads pode passar do número de cards do período.
        </p>
      </div>
    </>
  );
}
