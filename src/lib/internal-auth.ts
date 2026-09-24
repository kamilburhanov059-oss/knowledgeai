import crypto from "crypto";

// Authenticates server-to-server calls between our own API routes (e.g.
// process-document -> process-chunks) without exposing a raw secret.
function secret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return key;
}

export function signInternalRequest(documentId: string): string {
  return crypto.createHmac("sha256", secret()).update(`process-chunks:${documentId}`).digest("hex");
}

export function verifyInternalRequest(documentId: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signInternalRequest(documentId), "hex");
  const given = Buffer.from(signature, "hex");
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
