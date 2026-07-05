import {
  ok,
  requireApiUser,
  requireSameOriginMutation,
  validationError,
} from "@/server/api";
import {
  createGlossaryTerm,
  listGlossaryTerms,
} from "@/server/settings-service";
import { createGlossaryTermSchema } from "@/server/schemas";

export async function GET() {
  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  return ok({ glossary: await listGlossaryTerms() });
}

export async function POST(request: Request) {
  const csrfResponse = requireSameOriginMutation(request);
  if (csrfResponse) return csrfResponse;

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  let parsed;
  try {
    parsed = createGlossaryTermSchema.parse(await request.json());
  } catch (error) {
    return validationError(error);
  }

  const term = await createGlossaryTerm({
    ...parsed,
    actorUserId: user.id,
    userAgent: request.headers.get("user-agent"),
  });

  return ok({ term }, { status: 201 });
}
