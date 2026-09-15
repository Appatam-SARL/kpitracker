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

/**
 * Incrémentez après un changement d’enum / modèle incompatible avec le
 * singleton `globalThis.prisma` du hot-reload Next.js.
 */
const PRISMA_CLIENT_EPOCH = "negotiation-stage-v1";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaEpoch?: string;
};

function createPrismaClient() {
  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

function isStalePrismaClient(client: PrismaClient): boolean {
  if (typeof (client as { prospect?: unknown }).prospect === "undefined") {
    return true;
  }
  if (globalForPrisma.prismaEpoch !== PRISMA_CLIENT_EPOCH) {
    return true;
  }
  return false;
}

const cached = globalForPrisma.prisma;
export const prisma =
  cached && !isStalePrismaClient(cached) ? cached : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaEpoch = PRISMA_CLIENT_EPOCH;
}
