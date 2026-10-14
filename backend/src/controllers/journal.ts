import { query } from "./../config/db.js";

export const getJournalHandler27 = async (req: any, res: any) =>
  res.json(
    (
      await query(
        "SELECT TOP 200 a.*,u.username,COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(u.last_name,' ',CASE WHEN u.first_name=u.last_name THEN '' ELSE u.first_name END))),''),u.username,N'Utilisateur supprimé') AS user_display_name FROM dbo.apes_audit a LEFT JOIN dbo.users u ON u.UID=a.user_id ORDER BY a.id DESC",
      )
    ).recordset,
  );
