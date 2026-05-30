import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/services/server/auth.service";
import { skillsService } from "@/lib/services/server/skills.service";
import { skillCatalogUpdateSchema } from "@/lib/skills";
import { apiError, handleApiError } from "@/lib/utils/api-response";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const input = skillCatalogUpdateSchema.parse(await req.json());
    const result = await skillsService.updateCatalogEntry(user, id, input);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return handleApiError(apiError(error.issues[0]?.message ?? "Charge utile de competence invalide", 400));
    }
    return handleApiError(error, "Erreur lors de la mise a jour de la competence");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const deletedSkill = await skillsService.deleteCatalogEntry(user, id);
    logAudit({
      actorId: user.id,
      actorName: user.name,
      action: "DELETED",
      entity: "Skill",
      entityId: deletedSkill.id,
      details: { name: deletedSkill.name, type: deletedSkill.type },
    });
    return NextResponse.json({ success: true, skill: deletedSkill });
  } catch (error) {
    return handleApiError(error, "Erreur lors de la suppression de la competence");
  }
}
