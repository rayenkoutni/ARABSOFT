import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ROLE, HTTP_STATUS, ERROR_MESSAGES } from "./constants";
import { ApiError, errorResponse as buildErrorResponse } from "./api-response";
import { serverAuthService } from "@/lib/services/server/auth.service";

/**
 * Authentication middleware for API routes
 * Validates user is authenticated and returns user object
 */
export async function requireAuth(request?: Request, allowedRoles?: Array<(typeof ROLE)[keyof typeof ROLE]>) {
  try {
    const user = await serverAuthService.requireAuth(request, allowedRoles);
    return { user, response: null };
  } catch (error) {
    const status =
      error instanceof ApiError ? error.status : allowedRoles ? HTTP_STATUS.FORBIDDEN : HTTP_STATUS.UNAUTHORIZED;
    const message =
      status === HTTP_STATUS.FORBIDDEN ? ERROR_MESSAGES.FORBIDDEN : ERROR_MESSAGES.UNAUTHORIZED;
    return { user: null, response: errorResponse(message, status) };
  }
}

/**
 * Authorization middleware that requires specific roles
 */
export async function requireRoles(allowedRoles: string[]) {
  const auth = await requireAuth(undefined, allowedRoles as Array<(typeof ROLE)[keyof typeof ROLE]>);
  if (auth.response) return auth;
  return auth;
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
    const isAssigned = project.team.some((member: { id: string }) => member.id === userId);
    return { access: isAssigned, project, error: isAssigned ? null : "Access denied" };
  }

  // Manager: own projects or team member projects
  if (userRole === ROLE.MANAGER) {
    const teamMembers = await prisma.employee.findMany({
      where: { managerId: userId },
      select: { id: true },
    });
    const teamIds = teamMembers.map((e: { id: string }) => e.id);

    const isAuthorized =
      project.createdById === userId ||
      project.managerId === userId ||
      project.team.some((member: { id: string }) => teamIds.includes(member.id));

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
  return teamMembers.map((e: { id: string }) => e.id);
}

/**
 * Standard error response handler
 */
export function errorResponse(message: string, status: number = HTTP_STATUS.BAD_REQUEST) {
  return buildErrorResponse(message, status);
}

/**
 * Standard success response handler
 */
export function successResponse(data: unknown, status: number = HTTP_STATUS.OK) {
  return NextResponse.json(data, { status });
}
