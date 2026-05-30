import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuth } from "@/lib/services/server/auth.service";
import { skillsService } from "@/lib/services/server/skills.service";
import { skillCatalogInputSchema, SkillDomainError } from "@/lib/skills";
import { apiError, handleApiError } from "@/lib/utils/api-response";

export async function GET(req: Request) {
  try {
    const user = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get("type");
    const includeInactive = searchParams.get("includeInactive") === "true";
    const type = typeParam && ["SOFT", "TECHNICAL"].includes(typeParam)
      ? (typeParam as "SOFT" | "TECHNICAL")
      : undefined;
    const result = await skillsService.listCatalog(user, { type, includeInactive });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, "Erreur lors du chargement du catalogue de competences");
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth(req);
    const input = skillCatalogInputSchema.parse(await req.json());
    const result = await skillsService.createCatalogEntry(user, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return handleApiError(apiError(error.issues[0]?.message ?? "Charge utile de competence invalide", 400));
    }
    if (error instanceof SkillDomainError) {
      return handleApiError(error, "Erreur lors de la creation de la competence");
    }
    return handleApiError(error, "Erreur lors de la creation de la competence");
  }
}
