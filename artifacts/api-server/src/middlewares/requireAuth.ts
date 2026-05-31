import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Log de causa do 401 — fica no servidor; a response continua só "Não autenticado"
// pra não vazar info. Ajuda diagnosticar sem ter que reinstalar APK.
function authFailReason(req: Request): string {
  if (!process.env.CLERK_SECRET_KEY) {
    return "server_missing_CLERK_SECRET_KEY";
  }
  if (!process.env.CLERK_PUBLISHABLE_KEY) {
    return "server_missing_CLERK_PUBLISHABLE_KEY";
  }
  const authHeader = req.headers.authorization ?? "";
  if (!authHeader) return "no_authorization_header";
  if (!/^Bearer\s+\S+/i.test(authHeader)) return "malformed_authorization_header";
  // Header presente mas Clerk não validou: provável mismatch de instância
  // (token emitido por instância diferente da que CLERK_SECRET_KEY pertence)
  // ou token expirado.
  return "token_present_but_clerk_did_not_validate";
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    const reason = authFailReason(req);
    req.log?.warn({ reason, path: req.path }, "requireAuth: 401");
    res.status(401).json({ error: "Não autenticado." });
    return;
  }
  req.userId = userId;
  next();
}
