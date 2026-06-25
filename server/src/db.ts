import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** Convert date-only strings ("YYYY-MM-DD") to ISO-8601 DateTime */
export function normalizeDates(body: Record<string, unknown>, ...fields: string[]): Record<string, unknown> {
  const out = { ...body };
  for (const field of fields) {
    const v = out[field];
    if (typeof v === 'string' && v.length === 10) {
      out[field] = new Date(v + 'T00:00:00.000Z').toISOString();
    }
    if (v === '') out[field] = undefined;
  }
  return out;
}
