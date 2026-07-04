import { getCurrentUser } from "@/server/auth";
import { fail, ok } from "@/server/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Authentication required.", 401);
  return ok({ user });
}
