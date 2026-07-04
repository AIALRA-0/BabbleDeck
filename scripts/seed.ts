import { prisma } from "../apps/web/src/server/db";
import { hashPassword } from "../apps/web/src/server/password";

const email = (
  process.env.SEED_ADMIN_EMAIL ?? "admin@example.invalid"
).toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;

async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN", disabledAt: null },
  });

  if (existingAdmin) {
    console.log("Bootstrap admin already exists; seed skipped.");
    return;
  }

  if (!password) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is required when no admin user exists.",
    );
  }

  await prisma.user.create({
    data: {
      email,
      displayName: "BabbleDeck Admin",
      role: "ADMIN",
      passwordHash: await hashPassword(password),
      passwordRotationRequired: true,
    },
  });

  console.log(`Bootstrap admin created for ${email}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Seed failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
