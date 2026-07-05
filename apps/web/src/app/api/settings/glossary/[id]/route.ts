import {
  fail,
  ok,
  requireApiUser,
  requireSameOriginMutation,
  validationError,
} from "@/server/api";
import {
  deleteGlossaryTerm,
  updateGlossaryTerm,
} from "@/server/settings-service";
import { updateGlossaryTermSchema } from "@/server/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrfResponse = requireSameOriginMutation(request);
  if (csrfResponse) return csrfResponse;

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;

  let parsed;
  try {
    parsed = updateGlossaryTermSchema.parse(await request.json());
  } catch (error) {
    return validationError(error);
  }

  const term = await updateGlossaryTerm({
    id,
    ...parsed,
    actorUserId: user.id,
    userAgent: request.headers.get("user-agent"),
  });
  if (!term) return fail("NOT_FOUND", "Glossary term not found.", 404);

  return ok({ term });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const csrfResponse = requireSameOriginMutation(request);
  if (csrfResponse) return csrfResponse;

  const auth = await requireApiUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  const { id } = await context.params;

  const term = await deleteGlossaryTerm({
    id,
    actorUserId: user.id,
    userAgent: request.headers.get("user-agent"),
  });
  if (!term) return fail("NOT_FOUND", "Glossary term not found.", 404);

  return ok({ term });
}
