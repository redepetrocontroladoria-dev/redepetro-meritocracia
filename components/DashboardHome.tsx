"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DashboardExecutivo } from "@/components/DashboardExecutivo";
import {
  calcularVariacao,
  formatarCompetencia,
  mediaDeNotas,
  MESES,
  nomeMes,
} from "@/lib/competencia";

type DepartamentoOption = { id: string; nome: string };

type AvaliacaoDash = {
  mes: number;
  ano: number;
  notaFinal: number;
  departamentoId: string;
  itens: { criterioId: string; criterioNome: string; nota: number }[];
};

type ColetivaDash = {
  mes: number;
  ano: number;
  departamentoId: string;
  itens: { criterioId: string; criterioNome: string; nota: number }[];
};

type PendenciaDepartamento = {
  departamentoId: string;
  nome: string;
  metasColetivasLancadas: boolean;
  temCriteriosColetivos: boolean;
  avaliados: number;
  totalColaboradores: number;
};

type CardAcesso = {
  href: string;
  title: string;
  description: string;
};

type PeriodoMedia =
  | "mes_atual"
  | "ultimos_3"
  | "ultimos_6"
  | "ano_atual"
  | "competencia";

type JanelaEvolucao = "6" | "12" | "ano";

function competenciaOffset(mes: number, ano: number, offset: number) {
  const total = ano * 12 + (mes - 1) - offset;
  return { mes: (total % 12) + 1, ano: Math.floor(total / 12) };
}

function chaveComp(mes: number, ano: number) {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function listaCompetencias(
  mesRef: number,
  anoRef: number,
  periodo: PeriodoMedia,
  mesSel: number,
  anoSel: number,
) {
  if (periodo === "competencia") {
    return [{ mes: mesSel, ano: anoSel }];
  }
  if (periodo === "mes_atual") {
    return [{ mes: mesRef, ano: anoRef }];
  }
  if (periodo === "ano_atual") {
    return Array.from({ length: mesRef }, (_, i) => ({
      mes: i + 1,
      ano: anoRef,
    }));
  }
  const qtd = periodo === "ultimos_3" ? 3 : 6;
  return Array.from({ length: qtd }, (_, i) =>
    competenciaOffset(mesRef, anoRef, qtd - 1 - i),
  );
}

function listaJanelaEvolucao(
  mesRef: number,
  anoRef: number,
  janela: JanelaEvolucao,
  anoEvolucao: number,
) {
  if (janela === "ano") {
    const fimMes = anoEvolucao === anoRef ? mesRef : 12;
    return Array.from({ length: fimMes }, (_, i) => ({
      mes: i + 1,
      ano: anoEvolucao,
    }));
  }
  const qtd = janela === "12" ? 12 : 6;
  return Array.from({ length: qtd }, (_, i) =>
    competenciaOffset(mesRef, anoRef, qtd - 1 - i),
  );
}

const selectClass =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-700 outline-none focus:ring-2 focus:ring-zinc-200";

export function DashboardHome({
  isDiretoria,
  mesAtual,
  anoAtual,
  departamentos,
  avaliacoes,
  coletivas,
  pendencias,
  cards,
}: {
  isDiretoria: boolean;
  mesAtual: number;
  anoAtual: number;
  departamentos: DepartamentoOption[];
  avaliacoes: AvaliacaoDash[];
  coletivas: ColetivaDash[];
  pendencias: PendenciaDepartamento[];
  cards: CardAcesso[];
}) {
  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([anoAtual, anoAtual - 1]);
    for (const a of avaliacoes) set.add(a.ano);
    return Array.from(set).sort((a, b) => b - a);
  }, [avaliacoes, anoAtual]);

  const [periodoMedia, setPeriodoMedia] = useState<PeriodoMedia>("mes_atual");
  const [mesMedia, setMesMedia] = useState(mesAtual);
  const [anoMedia, setAnoMedia] = useState(anoAtual);
  const [deptMedia, setDeptMedia] = useState("");

  const [deptEvolucao, setDeptEvolucao] = useState("");
  const [janelaEvolucao, setJanelaEvolucao] = useState<JanelaEvolucao>("6");
  const [anoEvolucao, setAnoEvolucao] = useState(anoAtual);

  const [deptOfensor, setDeptOfensor] = useState("");
  const [mesOfensor, setMesOfensor] = useState(mesAtual);
  const [anoOfensor, setAnoOfensor] = useState(anoAtual);

  const competenciasMedia = useMemo(
    () =>
      listaCompetencias(
        mesAtual,
        anoAtual,
        periodoMedia,
        mesMedia,
        anoMedia,
      ),
    [mesAtual, anoAtual, periodoMedia, mesMedia, anoMedia],
  );

  const competenciasMediaAnterior = useMemo(() => {
    if (periodoMedia === "competencia") {
      return [competenciaOffset(mesMedia, anoMedia, 1)];
    }
    if (periodoMedia === "mes_atual") {
      return [competenciaOffset(mesAtual, anoAtual, 1)];
    }
    if (periodoMedia === "ano_atual") {
      return Array.from({ length: 12 }, (_, i) => ({
        mes: i + 1,
        ano: anoAtual - 1,
      }));
    }
    const qtd = periodoMedia === "ultimos_3" ? 3 : 6;
    return Array.from({ length: qtd }, (_, i) =>
      competenciaOffset(mesAtual, anoAtual, qtd + qtd - 1 - i),
    );
  }, [periodoMedia, mesMedia, anoMedia, mesAtual, anoAtual]);

  const setMedia = useMemo(
    () => new Set(competenciasMedia.map((c) => chaveComp(c.mes, c.ano))),
    [competenciasMedia],
  );
  const setMediaAnt = useMemo(
    () =>
      new Set(competenciasMediaAnterior.map((c) => chaveComp(c.mes, c.ano))),
    [competenciasMediaAnterior],
  );

  const avaliacoesMedia = useMemo(() => {
    return avaliacoes.filter((a) => {
      if (!setMedia.has(chaveComp(a.mes, a.ano))) return false;
      if (deptMedia && a.departamentoId !== deptMedia) return false;
      return true;
    });
  }, [avaliacoes, setMedia, deptMedia]);

  const avaliacoesMediaAnt = useMemo(() => {
    return avaliacoes.filter((a) => {
      if (!setMediaAnt.has(chaveComp(a.mes, a.ano))) return false;
      if (deptMedia && a.departamentoId !== deptMedia) return false;
      return true;
    });
  }, [avaliacoes, setMediaAnt, deptMedia]);

  const notaMedia = mediaDeNotas(avaliacoesMedia.map((a) => a.notaFinal));
  const notaMediaAnt = mediaDeNotas(
    avaliacoesMediaAnt.map((a) => a.notaFinal),
  );
  const variacao = calcularVariacao(notaMedia, notaMediaAnt);

  const labelPeriodoMedia = useMemo(() => {
    if (periodoMedia === "competencia") {
      return formatarCompetencia(mesMedia, anoMedia);
    }
    if (periodoMedia === "mes_atual") {
      return formatarCompetencia(mesAtual, anoAtual);
    }
    if (periodoMedia === "ano_atual") return `Ano ${anoAtual}`;
    if (periodoMedia === "ultimos_3") return "Últimos 3 meses";
    return "Últimos 6 meses";
  }, [periodoMedia, mesMedia, anoMedia, mesAtual, anoAtual]);

  const deptMediaNome =
    departamentos.find((d) => d.id === deptMedia)?.nome ?? "Todos";

  const tituloIndice = isDiretoria
    ? `Média Geral da Empresa — ${labelPeriodoMedia}`
    : `Índice de desempenho — ${labelPeriodoMedia}`;

  const detalheMedia = `${avaliacoesMedia.length} avaliação(ões)${
    deptMedia ? ` · ${deptMediaNome}` : ""
  }`;

  const competenciasEvolucao = useMemo(
    () =>
      listaJanelaEvolucao(mesAtual, anoAtual, janelaEvolucao, anoEvolucao),
    [mesAtual, anoAtual, janelaEvolucao, anoEvolucao],
  );

  const evolucao = useMemo(() => {
    const pontos: {
      label: string;
      media: number | null;
      serie: string;
    }[] = [];

    for (const c of competenciasEvolucao) {
      const label = `${nomeMes(c.mes).slice(0, 3)}/${String(c.ano).slice(2)}`;
      const doMes = avaliacoes.filter(
        (a) =>
          a.mes === c.mes &&
          a.ano === c.ano &&
          (!deptEvolucao || a.departamentoId === deptEvolucao),
      );

      if (!deptEvolucao && isDiretoria) {
        pontos.push({
          label,
          serie: "Empresa",
          media: mediaDeNotas(doMes.map((a) => a.notaFinal)),
        });
      }

      const depts = deptEvolucao
        ? departamentos.filter((d) => d.id === deptEvolucao)
        : departamentos;

      for (const dept of depts) {
        const notas = doMes
          .filter((a) => a.departamentoId === dept.id)
          .map((a) => a.notaFinal);
        pontos.push({
          label,
          serie: dept.nome,
          media: mediaDeNotas(notas),
        });
      }
    }

    return pontos;
  }, [
    competenciasEvolucao,
    avaliacoes,
    deptEvolucao,
    departamentos,
    isDiretoria,
  ]);

  const ofensores = useMemo(() => {
    const mapa = new Map<string, { nome: string; notas: number[] }>();

    for (const av of avaliacoes) {
      if (av.mes !== mesOfensor || av.ano !== anoOfensor) continue;
      if (deptOfensor && av.departamentoId !== deptOfensor) continue;
      for (const item of av.itens) {
        const atual = mapa.get(item.criterioId) ?? {
          nome: item.criterioNome,
          notas: [],
        };
        atual.notas.push(item.nota);
        mapa.set(item.criterioId, atual);
      }
    }

    for (const coletiva of coletivas) {
      if (coletiva.mes !== mesOfensor || coletiva.ano !== anoOfensor) continue;
      if (deptOfensor && coletiva.departamentoId !== deptOfensor) continue;
      for (const item of coletiva.itens) {
        const atual = mapa.get(item.criterioId) ?? {
          nome: item.criterioNome,
          notas: [],
        };
        atual.notas.push(item.nota);
        mapa.set(item.criterioId, atual);
      }
    }

    return Array.from(mapa.entries())
      .map(([criterioId, data]) => ({
        criterioId,
        nome: data.nome,
        media:
          data.notas.reduce((t, n) => t + n, 0) / Math.max(1, data.notas.length),
      }))
      .sort((a, b) => a.media - b.media)
      .slice(0, 5);
  }, [avaliacoes, coletivas, mesOfensor, anoOfensor, deptOfensor]);

  const competenciaLabelAtual = formatarCompetencia(mesAtual, anoAtual);
  const competenciaLabelOfensor = formatarCompetencia(mesOfensor, anoOfensor);

  const labelJanelaEvolucao =
    janelaEvolucao === "ano"
      ? `Ano ${anoEvolucao}`
      : janelaEvolucao === "12"
        ? "Últimos 12 meses"
        : "Últimos 6 meses";

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="bg-brand-secondary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white">
          {tituloIndice}
        </div>
        <div className="space-y-4 px-5 py-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Período
              </span>
              <select
                value={periodoMedia}
                onChange={(e) =>
                  setPeriodoMedia(e.target.value as PeriodoMedia)
                }
                className={selectClass}
              >
                <option value="mes_atual">Mês atual</option>
                <option value="ultimos_3">Últimos 3 meses</option>
                <option value="ultimos_6">Últimos 6 meses</option>
                <option value="ano_atual">Ano atual</option>
                <option value="competencia">Competência (Mês/Ano)</option>
              </select>
            </label>

            {periodoMedia === "competencia" ? (
              <>
                <label className="space-y-1">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    Mês
                  </span>
                  <select
                    value={mesMedia}
                    onChange={(e) => setMesMedia(Number(e.target.value))}
                    className={selectClass}
                  >
                    {MESES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    Ano
                  </span>
                  <select
                    value={anoMedia}
                    onChange={(e) => setAnoMedia(Number(e.target.value))}
                    className={selectClass}
                  >
                    {anosDisponiveis.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}

            <label className="space-y-1">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Departamento
              </span>
              <select
                value={deptMedia}
                onChange={(e) => setDeptMedia(e.target.value)}
                className={selectClass}
              >
                <option value="">Todos</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-4xl font-semibold tracking-tight text-brand-primary">
                {notaMedia == null ? "—" : notaMedia.toFixed(2)}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{detalheMedia}</p>
              <span
                className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${variacao.badgeClass}`}
              >
                vs. período anterior: {variacao.label}
              </span>
            </div>
            <Link
              href={`/relatorios?mes=${periodoMedia === "competencia" ? mesMedia : mesAtual}&ano=${periodoMedia === "competencia" ? anoMedia : anoAtual}${deptMedia ? `&departamentoId=${deptMedia}` : ""}`}
              className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800"
            >
              Ver relatórios
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-zinc-200 border-t-4 border-t-brand-primary bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow"
          >
            <h2 className="text-base font-semibold text-zinc-900">
              {card.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{card.description}</p>
          </Link>
        ))}
      </div>

      <DashboardExecutivo
        competenciaLabel={competenciaLabelAtual}
        competenciaLabelOfensor={competenciaLabelOfensor}
        labelJanelaEvolucao={labelJanelaEvolucao}
        pendencias={pendencias}
        evolucao={evolucao}
        ofensores={ofensores}
        isDiretoria={isDiretoria}
        departamentos={departamentos}
        anosDisponiveis={anosDisponiveis}
        filtrosEvolucao={{
          departamentoId: deptEvolucao,
          janela: janelaEvolucao,
          ano: anoEvolucao,
          onDepartamentoChange: setDeptEvolucao,
          onJanelaChange: setJanelaEvolucao,
          onAnoChange: setAnoEvolucao,
        }}
        filtrosOfensores={{
          departamentoId: deptOfensor,
          mes: mesOfensor,
          ano: anoOfensor,
          onDepartamentoChange: setDeptOfensor,
          onMesChange: setMesOfensor,
          onAnoChange: setAnoOfensor,
        }}
      />
    </div>
  );
}
