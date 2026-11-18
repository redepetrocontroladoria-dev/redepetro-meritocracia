import { FAIXAS_PADRAO } from "@/lib/calculoMeritocracia";
import { prisma } from "@/lib/prisma";

export async function ensureFaixasPagamento() {
  const total = await prisma.faixaPagamento.count();
  if (total > 0) {
    return prisma.faixaPagamento.findMany({
      orderBy: { minPercentual: "desc" },
    });
  }

  await prisma.faixaPagamento.createMany({
    data: FAIXAS_PADRAO.map((faixa) => ({
      minPercentual: faixa.minPercentual,
      maxPercentual: faixa.maxPercentual,
      multiplicadorPeso: faixa.multiplicadorPeso,
      descricao: faixa.descricao,
    })),
  });

  return prisma.faixaPagamento.findMany({
    orderBy: { minPercentual: "desc" },
  });
}
