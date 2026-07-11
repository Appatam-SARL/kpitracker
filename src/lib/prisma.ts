import { loadEnvForPrisma } from "../../prisma/load-env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// cPanel : variables souvent uniquement dans .env sur disque
if (!process.env.DATABASE_URL) {
  loadEnvForPrisma();
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL manquant. Définissez-le dans cPanel (Node.js App) ou dans .env à la racine du projet.",
  );
}

const adapter = new PrismaPg({ connectionString });

// Évite de recréer un client Prisma en dev (hot reload)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
