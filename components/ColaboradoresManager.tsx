"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  atualizarColaborador,
  criarColaborador,
  excluirColaborador,
} from "@/actions/cadastros";
import { importarColaboradoresLote } from "@/actions/colaboradores";
import {
  EmptyState,
  Field,
  Panel,
  SelectField,
  SubmitButton,
} from "@/components/ui";
import { formatarMoeda } from "@/lib/calculoMeritocracia";

type DepartamentoOption = { id: string; nome: string };
type ColaboradorItem = {
  id: string;
  nome: string;
  cargo: string;
  departamentoId: string;
  departamentoNome: string;
  valorAlvo: number;
};

type LinhaPreview = {
  linha: number;
  nome: string;
  cargo: string;
  departamentoRaw: string;
  departamentoId: string | null;
  valorAlvo: number;
  ok: boolean;
  erro?: string;
};

function normalizarTexto(valor: string) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseValorAlvo(valor: unknown) {
  if (valor == null || String(valor).trim() === "") return 0;
  const n = Number(
    String(valor)
      .trim()
      .replace(/\s/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function lerCelula(
  row: Record<string, unknown>,
  aliases: string[],
): string {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const alvo = normalizarTexto(alias);
    const found = entries.find(([key]) => normalizarTexto(key) === alvo);
    if (found && found[1] != null && String(found[1]).trim() !== "") {
      return String(found[1]).trim();
    }
  }
  return "";
}

export function ColaboradoresManager({
  colaboradores,
  departamentos,
}: {
  colaboradores: ColaboradorItem[];
  departamentos: DepartamentoOption[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<ColaboradorItem | null>(null);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [departamentoId, setDepartamentoId] = useState("");
  const [valorAlvo, setValorAlvo] = useState("0");
  const [erro, setErro] = useState<string | null>(null);
  const [sucessoImport, setSucessoImport] = useState<string | null>(null);
  const [painelImport, setPainelImport] = useState(false);
  const [preview, setPreview] = useState<LinhaPreview[]>([]);
  const [pending, startTransition] = useTransition();

  const options = departamentos.map((d) => ({ value: d.id, label: d.nome }));

  const mapaDepartamentos = useMemo(() => {
    const mapa = new Map<string, DepartamentoOption>();
    for (const dept of departamentos) {
      mapa.set(normalizarTexto(dept.nome), dept);
    }
    return mapa;
  }, [departamentos]);

  const validos = preview.filter((item) => item.ok);
  const invalidos = preview.filter((item) => !item.ok);

  function iniciarEdicao(item: ColaboradorItem) {
    setEditing(item);
    setNome(item.nome);
    setCargo(item.cargo);
    setDepartamentoId(item.departamentoId);
    setValorAlvo(String(item.valorAlvo));
    setErro(null);
  }

  function cancelar() {
    setEditing(null);
    setNome("");
    setCargo("");
    setDepartamentoId("");
    setValorAlvo("0");
    setErro(null);
  }

  function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setErro(null);
    startTransition(async () => {
      try {
        await atualizarColaborador(editing.id, {
          nome,
          cargo,
          departamentoId,
          valorAlvo: Number(String(valorAlvo).replace(",", ".")),
        });
        cancelar();
        router.refresh();
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao atualizar.");
      }
    });
  }

  function remover(item: ColaboradorItem) {
    if (!window.confirm(`Excluir o colaborador "${item.nome}"?`)) return;
    setErro(null);
    startTransition(async () => {
      try {
        await excluirColaborador(item.id);
        if (editing?.id === item.id) cancelar();
        router.refresh();
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Erro ao excluir.");
      }
    });
  }

  function baixarModelo() {
    const workbook = XLSX.utils.book_new();
    const modelo = XLSX.utils.aoa_to_sheet([
      ["Nome Completo", "Departamento", "Cargo", "Valor Alvo"],
      ["Ana Silva", departamentos[0]?.nome ?? "Comercial", "Analista", 1500],
    ]);
    XLSX.utils.book_append_sheet(workbook, modelo, "Colaboradores");

    const referencia = XLSX.utils.aoa_to_sheet([
      ["Departamentos Cadastrados (use o nome exato)"],
      ...departamentos.map((d) => [d.nome]),
    ]);
    XLSX.utils.book_append_sheet(workbook, referencia, "Departamentos");

    XLSX.writeFile(workbook, "modelo-colaboradores-redepetro.xlsx");
  }

  function processarArquivo(file: File) {
    setErro(null);
    setSucessoImport(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setErro("Planilha vazia.");
          setPreview([]);
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
        });

        const linhas: LinhaPreview[] = rows.map((row, index) => {
          const nomeLinha = lerCelula(row, [
            "Nome Completo",
            "Nome",
            "Colaborador",
          ]);
          const cargoLinha = lerCelula(row, ["Cargo", "Função", "Funcao"]);
          const departamentoRaw = lerCelula(row, [
            "Departamento",
            "Setor",
            "Área",
            "Area",
          ]);
          const valorRaw =
            lerCelula(row, [
              "Valor Alvo",
              "Valor-Alvo",
              "Valor Alvo do Bonus",
              "Valor Alvo do Bônus",
              "valorAlvo",
            ]) || "0";
          const valor = parseValorAlvo(valorRaw);
          const dept = mapaDepartamentos.get(normalizarTexto(departamentoRaw));

          if (!nomeLinha) {
            return {
              linha: index + 2,
              nome: nomeLinha,
              cargo: cargoLinha,
              departamentoRaw,
              departamentoId: null,
              valorAlvo: 0,
              ok: false,
              erro: "Nome vazio",
            };
          }
          if (!cargoLinha) {
            return {
              linha: index + 2,
              nome: nomeLinha,
              cargo: cargoLinha,
              departamentoRaw,
              departamentoId: null,
              valorAlvo: Number.isFinite(valor) ? valor : 0,
              ok: false,
              erro: "Cargo vazio",
            };
          }
          if (!departamentoRaw || !dept) {
            return {
              linha: index + 2,
              nome: nomeLinha,
              cargo: cargoLinha,
              departamentoRaw,
              departamentoId: null,
              valorAlvo: Number.isFinite(valor) ? valor : 0,
              ok: false,
              erro: "Departamento não encontrado",
            };
          }
          if (!Number.isFinite(valor)) {
            return {
              linha: index + 2,
              nome: nomeLinha,
              cargo: cargoLinha,
              departamentoRaw,
              departamentoId: dept.id,
              valorAlvo: 0,
              ok: false,
              erro: "Valor Alvo inválido",
            };
          }

          return {
            linha: index + 2,
            nome: nomeLinha,
            cargo: cargoLinha,
            departamentoRaw,
            departamentoId: dept.id,
            valorAlvo: valor,
            ok: true,
          };
        });

        setPreview(linhas);
        setPainelImport(true);
      } catch {
        setErro("Não foi possível ler o arquivo. Use .xlsx ou .csv.");
        setPreview([]);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function confirmarImportacao() {
    if (validos.length === 0) {
      setErro("Nenhuma linha válida para importar.");
      return;
    }
    setErro(null);
    setSucessoImport(null);
    startTransition(async () => {
      const result = await importarColaboradoresLote(
        validos.map((item) => ({
          nome: item.nome,
          cargo: item.cargo,
          departamentoId: item.departamentoId!,
          valorAlvo: item.valorAlvo,
        })),
      );
      if (!result.ok) {
        setErro(result.error ?? "Erro ao importar colaboradores.");
        return;
      }
      setSucessoImport(
        `Importação concluída: ${result.criados ?? 0} criado(s), ${result.atualizados ?? 0} atualizado(s).`,
      );
      setPreview([]);
      setPainelImport(false);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <>
      <Panel title={editing ? "Editar colaborador" : "Novo colaborador"}>
        {editing ? (
          <form onSubmit={salvar} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">Nome</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">Cargo</span>
              <input
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Departamento
              </span>
              <select
                value={departamentoId}
                onChange={(e) => setDepartamentoId(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-700">
                Valor-Alvo do Bônus (R$)
              </span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={valorAlvo}
                onChange={(e) => setValorAlvo(e.target.value)}
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
              />
            </label>
            {erro ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
              >
                Salvar Alterações
              </button>
              <button
                type="button"
                onClick={cancelar}
                className="flex-1 rounded-md border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar Edição
              </button>
            </div>
          </form>
        ) : (
          <form action={criarColaborador} className="space-y-4">
            <Field label="Nome" name="nome" placeholder="Ex: Ana Silva" />
            <Field label="Cargo" name="cargo" placeholder="Ex: Analista" />
            <SelectField
              label="Departamento"
              name="departamentoId"
              options={options}
              placeholder="Selecione o departamento"
            />
            <Field
              label="Valor-Alvo do Bônus (R$)"
              name="valorAlvo"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 1500"
              required={false}
            />
            <SubmitButton>Cadastrar</SubmitButton>
          </form>
        )}
      </Panel>

      <Panel title="Lista">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={baixarModelo}
            className="rounded-md bg-brand-secondary px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Baixar Modelo Excel
          </button>
          <button
            type="button"
            onClick={() => {
              setPainelImport((v) => !v);
              setErro(null);
              setSucessoImport(null);
            }}
            className="rounded-md bg-brand-primary px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            Importar Excel
          </button>
        </div>

        {painelImport ? (
          <div className="mb-4 space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm text-zinc-600">
              Selecione um arquivo .xlsx ou .csv com as colunas{" "}
              <strong>Nome Completo</strong>, <strong>Departamento</strong>,{" "}
              <strong>Cargo</strong> e <strong>Valor Alvo</strong> (opcional).
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processarArquivo(file);
              }}
              className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-red-800"
            />

            {preview.length > 0 ? (
              <>
                <p className="text-xs text-zinc-500">
                  {validos.length} válida(s) · {invalidos.length} com erro
                </p>
                <div className="max-h-64 overflow-auto rounded-md border border-zinc-200 bg-white">
                  <table className="min-w-full text-left text-xs">
                    <thead>
                      <tr className="bg-brand-secondary text-white">
                        <th className="px-2 py-2 font-semibold">Linha</th>
                        <th className="px-2 py-2 font-semibold">Nome</th>
                        <th className="px-2 py-2 font-semibold">Cargo</th>
                        <th className="px-2 py-2 font-semibold">
                          Departamento
                        </th>
                        <th className="px-2 py-2 font-semibold text-right">
                          Valor-Alvo
                        </th>
                        <th className="px-2 py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {preview.map((item) => (
                        <tr key={`${item.linha}-${item.nome}`}>
                          <td className="px-2 py-2 tabular-nums">
                            {item.linha}
                          </td>
                          <td className="px-2 py-2">{item.nome || "—"}</td>
                          <td className="px-2 py-2">{item.cargo || "—"}</td>
                          <td className="px-2 py-2">
                            {item.departamentoRaw || "—"}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {formatarMoeda(item.valorAlvo)}
                          </td>
                          <td className="px-2 py-2">
                            {item.ok ? (
                              <span className="font-semibold text-emerald-700">
                                ✅ Pronto
                              </span>
                            ) : (
                              <span className="font-semibold text-red-700">
                                ❌ {item.erro}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  disabled={pending || validos.length === 0}
                  onClick={confirmarImportacao}
                  className="rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
                >
                  {pending
                    ? "Importando..."
                    : `Confirmar importação (${validos.length})`}
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {sucessoImport ? (
          <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {sucessoImport}
          </p>
        ) : null}
        {erro && !editing ? (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {erro}
          </p>
        ) : null}
        {colaboradores.length === 0 ? (
          <EmptyState message="Nenhum colaborador cadastrado." />
        ) : (
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-brand-secondary text-xs uppercase tracking-wide text-white">
                  <th className="px-3 py-3 font-semibold">Nome</th>
                  <th className="px-3 py-3 font-semibold">Cargo</th>
                  <th className="px-3 py-3 font-semibold">Departamento</th>
                  <th className="px-3 py-3 font-semibold text-right">
                    Valor-Alvo
                  </th>
                  <th className="px-3 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {colaboradores.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 font-medium">{item.nome}</td>
                    <td className="px-3 py-3">{item.cargo}</td>
                    <td className="px-3 py-3">{item.departamentoNome}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatarMoeda(item.valorAlvo)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => iniciarEdicao(item)}
                        className="mr-2 rounded-md px-2 py-1 text-xs font-medium text-brand-primary hover:bg-red-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => remover(item)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
