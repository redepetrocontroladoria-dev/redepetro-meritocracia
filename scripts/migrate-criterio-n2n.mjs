import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

const criterios = await prisma.criterioAvaliacao.findMany();
const backup = criterios.map((c) => ({
  id: c.id,
  nome: c.nome,
  peso: c.peso,
  departamentoId: c.departamentoId ?? null,
  global: c.global ?? false,
  descricao: null,
}));

writeFileSync(
  new URL("./criterio-dept-backup.json", import.meta.url),
  JSON.stringify(backup, null, 2),
);

console.log(`Backup de ${backup.length} critério(s) salvo.`);
await prisma.$disconnect();
