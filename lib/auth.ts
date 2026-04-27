import "dotenv/config"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export function signToken(payload: { id: string; role: string }) {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "7d" })
}

export function verifyToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!)
}
