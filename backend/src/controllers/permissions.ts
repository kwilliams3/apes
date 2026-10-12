import {
  permissionSettings,
  savePermissions,
} from "./../services/permissions.js";

import { z } from "zod";

import { AppError, isAdmin } from "./../utils/domain.js";
import { idOf } from "../routes/shared.js";
export const getPermissionsHandler50 = async (req: any, res: any) => {
  if (!isAdmin(req.user))
    throw new AppError("Accès administrateur requis.", 403);
  res.json(await permissionSettings());
};
export const putPermissionsHandler51 = async (req: any, res: any) =>
  res.json(
    await savePermissions(
      req.user,
      z.enum(["role", "user"]).parse(req.params.type),
      idOf(req),
      z
        .record(z.string(), z.record(z.string(), z.boolean()))
        .parse(req.body.rules),
    ),
  );
