"use client";

import { useMemo, useState } from "react";
import { AvaliacaoDepartamentoForm } from "@/components/AvaliacaoDepartamentoForm";
import { AvaliacaoForm } from "@/components/AvaliacaoForm";
import { legendaReguaDegraus } from "@/lib/calculoMeritocracia";
import type { FaixaDegrau } from "@/lib/calculoMeritocracia";

type DepartamentoOption = { id: string; nome: string };

type ColaboradorOption = {
  id: string;
  nome: string;
  cargo: string;
  departamento: string;
  departamentoId: string;
};

type CriterioOption = {
  id: string;
  nome: string;
  peso: number;
  descricao: string | null;
  isGlobal: boolean;
  tipoAvaliacao: string;
  toleranciaZero?: boolean;
  departamentoIds: string[];
};

type EdicaoInicial = {
  id: string;
  colaboradorId: string;
  mes: number;
  ano: number;
  observacoes: string;
  notas: Record<string, string>;
  justificativas?: Record<string, string>;
};

const agora = new Date();

export function AvaliarWorkspace({
  departamentos,
  colaboradores,
  criterios,
  faixas,
  edicaoInicial = null,
}: {
  departamentos: DepartamentoOption[];
  colaboradores: ColaboradorOption[];
  criterios: CriterioOption[];
  faixas: FaixaDegrau[];
  edicaoInicial?: EdicaoInicial | null;
}) {
  const departamentoInicial = useMemo(() => {
    if (edicaoInicial) {
      const colaborador = colaboradores.find(
        (item) => item.id === edicaoInicial.colaboradorId,
      );
      if (colaborador) return colaborador.departamentoId;
    }
    return departamentos[0]?.id ?? "";
  }, [colaboradores, departamentos, edicaoInicial]);

  const [departamentoId, setDepartamentoId] = useState(departamentoInicial);
  const [mes, setMes] = useState(
    edicaoInicial?.mes ?? agora.getMonth() + 1,
  );
  const [ano, setAno] = useState(edicaoInicial?.ano ?? agora.getFullYear());
  const [coletivasRevision, setColetivasRevision] = useState(0);

  const legenda = useMemo(() => legendaReguaDegraus(faixas), [faixas]);

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-secondary">
          Régua de Degraus de Bônus
        </p>
        <p className="mb-3 text-xs text-zinc-500">
          Atingimento da meta → parte do peso paga no bônus.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {legenda.map((item) => (
            <span
              key={`${item.atingimento}-${item.parte}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px]"
            >
              <span className="font-semibold text-brand-primary">
                {item.atingimento}
              </span>
              <span className="text-zinc-500">=</span>
              <span className="font-medium text-brand-secondary">
                {item.parte}
              </span>
            </span>
          ))}
        </div>
      </div>

      <AvaliacaoDepartamentoForm
        departamentos={departamentos}
        criterios={criterios}
        faixas={faixas}
        departamentoId={departamentoId}
        mes={mes}
        ano={ano}
        onDepartamentoChange={setDepartamentoId}
        onMesChange={setMes}
        onAnoChange={setAno}
        onColetivasSalvas={() => setColetivasRevision((n) => n + 1)}
      />

      <AvaliacaoForm
        colaboradores={colaboradores}
        criterios={criterios}
        faixas={faixas}
        departamentoId={departamentoId}
        mes={mes}
        ano={ano}
        coletivasRevision={coletivasRevision}
        edicaoInicial={edicaoInicial}
      />
    </div>
  );
}
