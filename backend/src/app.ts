import { loadPermissions } from "./services/permissions.js";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { query } from "./config/db.js";
import { AppError, verifyPassword, isAdmin } from "./utils/domain.js";
import { isAllowedOrigin } from "./middleware/origin.js";
import { router } from "./routes/index.js";
export const app = express();
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32 || secret.startsWith("replace-"))
  throw new Error(
    "Configurez JWT_SECRET (au moins 32 caractères aléatoires) dans .env.",
  );
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production" ? undefined : false,
  }),
);
app.use(express.json({ limit: "1mb" }), cookieParser());
app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (
      !isAllowedOrigin(
        req.get("origin"),
        req.get("host"),
        process.env.APP_ORIGIN,
        process.env.PORT || 3001,
      )
    )
      return res
        .status(403)
        .json({ message: "Origine de la requête refusée." });
  }
  next();
});
app.get("/api/health", async (req, res) => {
  try {
    await query("SELECT 1 AS ok");
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({
      message:
        "Connexion SQL Server indisponible. Vérifiez backend/.env et TCP/IP sur le serveur.",
    });
  }
});
app.post(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  async (req, res) => {
    const { username, password } = req.body;
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username.length > 100 ||
      password.length > 200
    )
      throw new AppError("Identifiants invalides.");
    const identifier = username.trim();
    if (!identifier) throw new AppError("Identifiants invalides.");
    // Preserve existing username ownership, including disabled accounts.
    let row = (
      await query(
        "SELECT UID,password,auth_version,status FROM dbo.users WHERE username=@identifier",
        { identifier },
      )
    ).recordset[0];
    if (!row) {
      const matches = (
        await query(
          "SELECT TOP 2 UID,password,auth_version,status FROM dbo.users WHERE Matricule=@identifier AND Matricule<>'' AND status=1 ORDER BY UID",
          { identifier },
        )
      ).recordset;
      if (matches.length === 1) row = matches[0];
    }
    if (
      !row ||
      row.status !== 1 ||
      !(await verifyPassword(password, row.password))
    )
      throw new AppError(
        "Identifiant, matricule ou mot de passe incorrect.",
        401,
      );
    // On conserve le hash historique pour que l’ancien PHP continue de fonctionner.
    res.cookie(
      "apes_session",
      jwt.sign({ uid: row.UID, version: row.auth_version }, secret, {
        expiresIn: "8h",
        issuer: "apes",
      }),
      {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.COOKIE_SECURE === "true",
        maxAge: 8 * 3600000,
        path: "/",
      },
    );
    await query(
      "UPDATE dbo.users SET online=1,last_action=@time WHERE UID=@uid",
      { uid: row.UID, time: Math.floor(Date.now() / 1000) },
    );
    res.json({ ok: true });
  },
);
app.use("/api", async (req, res, next) => {
  let token;
  try {
    token = jwt.verify(req.cookies.apes_session || "", secret, {
      issuer: "apes",
      algorithms: ["HS256"],
    });
  } catch {
    throw new AppError("Connectez-vous pour continuer.", 401);
  }
  const user = (
    await query(
      "SELECT UID,username,first_name,last_name,email,Matricule,auth_version,must_change_password FROM dbo.users WHERE UID=@uid AND status=1",
      { uid: token.uid },
    )
  ).recordset[0];
  if (!user || user.auth_version !== token.version)
    throw new AppError("Reconnectez-vous pour continuer.", 401);
  delete user.auth_version;
  user.roles = (
    await query(
      "SELECT r.name FROM dbo.roles r JOIN dbo.users_roles ur ON ur.RID=r.RID WHERE ur.UID=@uid",
      { uid: user.UID },
    )
  ).recordset.map((r) => r.name);
  user.must_change_password = !!user.must_change_password;
  user.permissions = await loadPermissions(user);
  req.user = user;
  if (
    user.must_change_password &&
    !["/auth/me", "/auth/password", "/auth/logout"].includes(req.path)
  )
    return res.status(403).json({
      message: "Vous devez changer votre mot de passe pour continuer.",
      code: "PASSWORD_CHANGE_REQUIRED",
    });
  next();
});
app.get("/api/auth/me", (req, res) =>
  res.json({ ...req.user, isAdmin: isAdmin(req.user) }),
);
app.post("/api/auth/logout", async (req, res) => {
  await query("UPDATE dbo.users SET online=0 WHERE UID=@uid", {
    uid: req.user.UID,
  });
  res.clearCookie("apes_session", { path: "/" }).json({ ok: true });
});
app.use("/api", router);
app.use("/api", (req, res) =>
  res.status(404).json({ message: "Route inconnue." }),
);
const dist = fileURLToPath(new URL("../../frontend/dist", import.meta.url));
app.use(express.static(dist));
app.get("/{*path}", (req, res) => res.sendFile(path.join(dist, "index.html")));
app.use((error, req, res, next) => {
  if (error.code === "LIMIT_FILE_SIZE")
    return res
      .status(400)
      .json({ message: "Le fichier dépasse la limite de 5 Mo." });
  if (error.name === "MulterError")
    return res.status(400).json({
      message: "Envoi de fichier invalide. Un seul fichier est accepté.",
    });
  if (error.name === "ZodError")
    return res.status(400).json({
      message: error.issues
        .map((x) => `${x.path.join(".")} : ${x.message}`)
        .join(" ; "),
    });
  if (error.code === "EREQUEST" && [2601, 2627].includes(error.number))
    return res.status(409).json({ message: "Cet enregistrement existe déjà." });
  if (!error.status) console.error(error.message);
  res.status(error.status || 500).json({
    message: error.status
      ? error.message
      : "Opération impossible. Vérifiez la connexion SQL et la migration (npm run db:migrate).",
  });
});
app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "0.0.0.0",
  (error?: any) => {
    if (error) {
      console.error("Démarrage impossible :", error.message);
      process.exitCode = 1;
      return;
    }
    console.log(
      `APES API : http://${process.env.HOST || "0.0.0.0"}:${process.env.PORT || 3001}`,
    );
  },
);
