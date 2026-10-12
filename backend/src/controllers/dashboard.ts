import { dashboard } from "./../services/dashboard.js";

export const getDashboardHandler1 = async (req: any, res: any) =>
  res.json(await dashboard(req.user));
