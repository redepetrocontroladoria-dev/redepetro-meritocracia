import { calcularNotaFinal } from "@/lib/escala";

export type ItemNotaPeso = {
  criterioId: string;
  criterioNome?: string;
  peso: number;
  nota: number;
  toleranciaZero?: boolean;
  origem?: "INDIVIDUAL" | "DEPARTAMENTO";
};

export function consolidarItensAvaliacao(
  individuais: ItemNotaPeso[],
  coletivos: ItemNotaPeso[],
): ItemNotaPeso[] {
  const mapa = new Map<string, ItemNotaPeso>();

  for (const item of coletivos) {
    mapa.set(item.criterioId, { ...item, origem: "DEPARTAMENTO" });
  }
  for (const item of individuais) {
    mapa.set(item.criterioId, { ...item, origem: "INDIVIDUAL" });
  }

  return Array.from(mapa.values());
}

export function calcularNotaFinalConsolidada(
  individuais: ItemNotaPeso[],
  coletivos: ItemNotaPeso[],
) {
  const itens = consolidarItensAvaliacao(individuais, coletivos);
  return calcularNotaFinal(
    itens.map((item) => ({ nota: item.nota, peso: item.peso })),
  );
}
