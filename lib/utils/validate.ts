import { AppError } from "@/lib/errors";

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(`${field} is required and must be a string`, 400);
  }

  return value.trim();
}

export function requireEmail(value: unknown, field: string): string {
  const str = requireString(value, field);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    throw new AppError(`${field} must be a valid email`, 400);
  }

  return str;
}

export function requireEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (!allowed.includes(value as T)) {
    throw new AppError(`${field} must be one of: ${allowed.join(", ")}`, 400);
  }

  return value as T;
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new AppError(`${field} must be a boolean`, 400);
  }

  return value;
}

export function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError("Invalid string field", 400);
  }

  return value.trim();
}

export function requireUuid(value: unknown, field: string): string {
  const str = requireString(value, field);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)) {
    throw new AppError(`${field} must be a valid UUID`, 400);
  }

  return str;
}

export function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new AppError(`${field} must be a valid number`, 400);
  }

  return value;
}

export function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new AppError(`${field} must be a valid number`, 400);
  }

  return value;
}
