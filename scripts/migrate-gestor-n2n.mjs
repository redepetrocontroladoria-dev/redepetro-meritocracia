import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const gestores = await prisma.$queryRawUnsafe(
  `SELECT id, departamentoId FROM Gestor WHERE departamentoId IS NOT NULL`,
);

for (const g of gestores) {
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO _DepartamentoToGestor (A, B) VALUES (?, ?)`,
    g.departamentoId,
    g.id,
  );
}

console.log(`Migrados ${gestores.length} vínculos gestor-departamento`);
await prisma.$disconnect();
