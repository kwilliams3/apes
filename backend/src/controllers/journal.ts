import { query } from "./../config/db.js";

export const getJournalHandler27 = async (req: any, res: any) =>
  res.json(
    (
      await query(
        "SELECT TOP 200 a.*,u.username FROM dbo.apes_audit a LEFT JOIN dbo.users u ON u.UID=a.user_id ORDER BY a.id DESC",
      )
    ).recordset,
  );
