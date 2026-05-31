import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import miarRouter from "./miar";
import engajaRouter from "./engaja";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use("/miar", miarRouter);
router.use("/engaja", engajaRouter);

// Publishable key é PÚBLICA por definição (vai embutida em todo cliente Clerk).
// Endpoint serve só pra build do APK pegar a chave live correta da instância
// gerenciada pelo Replit no deploy, sem precisar copiar manualmente.
router.get("/clerk/pk", (_req, res) => {
  res.json({ pk: process.env.CLERK_PUBLISHABLE_KEY ?? null });
});

export default router;
