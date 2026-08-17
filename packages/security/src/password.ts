import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing — argon2id, never reversible encryption.
 * See docs/security/security-architecture.md §1.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext);
}

export async function verifyPassword(plaintext: string, hashedPassword: string): Promise<boolean> {
  return verify(hashedPassword, plaintext);
}
