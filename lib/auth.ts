import "dotenv/config"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import type { Role } from "@/lib/constants"

type AuthTokenPhase = "pre-auth" | "session"

interface BaseTokenPayload {
  sub: string
  phase: AuthTokenPhase
}

interface SessionTokenPayload extends BaseTokenPayload {
  id: string
  role: Role
  phase: "session"
}

interface PreAuthTokenPayload extends BaseTokenPayload {
  phase: "pre-auth"
}

interface TrustedDeviceTokenPayload extends BaseTokenPayload {
  phase: "session"
  type: "trusted-device"
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export function signSessionToken(payload: { id: string; role: Role }) {
  return jwt.sign(
    { sub: payload.id, id: payload.id, role: payload.role, phase: "session" } satisfies SessionTokenPayload,
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  )
}

export function signPreAuthToken(userId: string) {
  return jwt.sign(
    { sub: userId, phase: "pre-auth" } satisfies PreAuthTokenPayload,
    process.env.JWT_SECRET!,
    { expiresIn: "5m" },
  )
}

export function signTrustedDeviceToken(userId: string) {
  return jwt.sign(
    { sub: userId, phase: "session", type: "trusted-device" } satisfies TrustedDeviceTokenPayload,
    process.env.JWT_SECRET!,
    { expiresIn: "30d" },
  )
}

export function verifyToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!)
}

export type { AuthTokenPhase, PreAuthTokenPayload, SessionTokenPayload, TrustedDeviceTokenPayload }
