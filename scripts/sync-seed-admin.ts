import { prisma } from "../apps/web/src/server/db";
import { hashPassword } from "../apps/web/src/server/password";

function boolFlag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const email = (
    process.env.SEED_ADMIN_EMAIL ?? "admin@example.invalid"
  ).toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const keepSessions = boolFlag("--keep-sessions");

  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD is required.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await hashPassword(password);
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "ADMIN",
          passwordHash,
          passwordRotationRequired: false,
          disabledAt: null,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          displayName: "BabbleDeck Admin",
          role: "ADMIN",
          passwordHash,
          passwordRotationRequired: false,
        },
      });

  const revokedSessions = keepSessions
    ? { count: 0 }
    : await prisma.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

  process.stdout.write(
    `${JSON.stringify(
      {
        email,
        created: !existing,
        role: user.role,
        disabled: Boolean(user.disabledAt),
        passwordRotationRequired: user.passwordRotationRequired,
        revokedSessions: revokedSessions.count,
      },
      null,
      2,
    )}\n`,
  );
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Seed admin sync failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
