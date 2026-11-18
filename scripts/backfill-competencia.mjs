import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rows = await prisma.avaliacao.findMany();
for (const row of rows) {
  const d = new Date(row.data);
  await prisma.avaliacao.update({
    where: { id: row.id },
    data: {
      mes: d.getMonth() + 1,
      ano: d.getFullYear(),
    },
  });
}

console.log(`Atualizadas ${rows.length} avaliações`);
await prisma.$disconnect();
