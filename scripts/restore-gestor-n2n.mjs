import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rows = JSON.parse(
  readFileSync("scripts/gestor-dept-backup.json", "utf8"),
);

for (const row of rows) {
  await prisma.gestor.update({
    where: { id: row.id },
    data: {
      departamentos: {
        connect: [{ id: row.departamentoId }],
      },
    },
  });
}

console.log(`Restaurados ${rows.length} vínculos`);
await prisma.$disconnect();
