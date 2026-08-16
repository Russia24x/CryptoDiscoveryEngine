import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Log queries only in development — 'query' level floods the console with
// every SQL statement, which is noisy in production.
const logLevel = process.env.NODE_ENV !== 'production'
  ? ['query', 'error', 'warn'] as const
  : ['error', 'warn'] as const

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [...logLevel],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db