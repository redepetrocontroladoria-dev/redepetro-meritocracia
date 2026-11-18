import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();
const backup = JSON.parse(
  readFileSync(new URL("./criterio-dept-backup.json", import.meta.url), "utf8"),
);

for (const item of backup) {
  const isGlobal = Boolean(item.global) || !item.departamentoId;
  await prisma.criterioAvaliacao.upsert({
    where: { id: item.id },
    create: {
      id: item.id,
      nome: item.nome,
      peso: item.peso,
      descricao: item.descricao ?? null,
      isGlobal,
      departamentos: item.departamentoId
        ? { connect: [{ id: item.departamentoId }] }
        : undefined,
    },
    update: {
      nome: item.nome,
      peso: item.peso,
      descricao: item.descricao ?? null,
      isGlobal,
      departamentos: item.departamentoId
        ? { set: [{ id: item.departamentoId }] }
        : { set: [] },
    },
  });
}

console.log(`Restaurados ${backup.length} critério(s).`);
await prisma.$disconnect();
