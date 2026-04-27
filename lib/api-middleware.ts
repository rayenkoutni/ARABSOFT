import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { prisma } from "@/lib/prisma";
import { ROLE, HTTP_STATUS, ERROR_MESSAGES } from "./constants";

/**
 * Authentication middleware for API routes
 * Validates user is authenticated and returns user object
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: HTTP_STATUS.UNAUTHORIZED }
      ),
    };
  }
  return { user, response: null };
}

/**
 * Authorization middleware that requires specific roles
 */
export async function requireRoles(allowedRoles: string[]) {
  const auth = await requireAuth();
  if (auth.response) return auth;

  if (!allowedRoles.includes(auth.user.role)) {
    return {
      user: auth.user,
      response: NextResponse.json(
        { error: ERROR_MESSAGES.FORBIDDEN },
        { status: HTTP_STATUS.FORBIDDEN }
      ),
    };
  }

  return { user: auth.user, response: null };
}

/**
 * Require manager (CHEF) role
 */
export async function requireManager() {
  return requireRoles([ROLE.MANAGER, ROLE.HR]);
}

/**
 * Require HR role
 */
export async function requireHR() {
  return requireRoles([ROLE.HR]);
}

/**
 * Check if user has access to a specific project
 */
export async function checkProjectAccess(userId: string, userRole: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { select: { id: true } } },
  });

  if (!project) {
    return { access: false, project: null, error: "Project not found" };
  }

  // HR has access to all projects
  if (userRole === ROLE.HR) {
    return { access: true, project, error: null };
  }

  // Employee: only projects they're assigned to
  if (userRole === ROLE.EMPLOYEE) {
    const isAssigned = project.team.some((member) => member.id === userId);
    return { access: isAssigned, project, error: isAssigned ? null : "Access denied" };
  }

  // Manager: own projects or team member projects
  if (userRole === ROLE.MANAGER) {
    const teamMembers = await prisma.employee.findMany({
      where: { managerId: userId },
      select: { id: true },
    });
    const teamIds = teamMembers.map((e) => e.id);

    const isAuthorized =
      project.createdById === userId ||
      project.managerId === userId ||
      project.team.some((member) => teamIds.includes(member.id));

    return { access: isAuthorized, project, error: isAuthorized ? null : "Access denied" };
  }

  return { access: false, project, error: "Access denied" };
}

/**
 * Get team member IDs for a manager
 */
export async function getManagerTeamIds(managerId: string) {
  const teamMembers = await prisma.employee.findMany({
    where: { managerId },
    select: { id: true },
  });
  return teamMembers.map((e) => e.id);
}

/**
 * Standard error response handler
 */
export function errorResponse(message: string, status: number = HTTP_STATUS.BAD_REQUEST) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standard success response handler
 */
export function successResponse(data: any, status: number = HTTP_STATUS.OK) {
  return NextResponse.json(data, { status });
}
