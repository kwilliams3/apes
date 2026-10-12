import "dotenv/config";
import sql from "mssql";
export { sql };
let pending;
export function pool() {
  if (!process.env.DB_PASSWORD)
    throw new Error("DB_PASSWORD manque dans backend/.env.");
  if (!pending)
    pending = new sql.ConnectionPool({
      server: process.env.DB_SERVER || "localhost",
      port: Number(process.env.DB_PORT || 1433),
      database: process.env.DB_DATABASE || "apes",
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectionTimeout: 10000,
      requestTimeout: 30000,
      options: {
        encrypt: process.env.DB_ENCRYPT !== "false",
        trustServerCertificate: process.env.DB_TRUST_CERTIFICATE === "true",
        enableArithAbort: true,
        useUTC: true,
        tdsVersion: "7_4",
      },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    })
      .connect()
      .catch((e) => {
        pending = undefined;
        throw e;
      });
  return pending;
}
export async function query(
  text: any,
  values: any = {},
  transaction: any = undefined,
) {
  const request = transaction
    ? new sql.Request(transaction)
    : (await pool()).request();
  for (const [key, value] of Object.entries(values)) {
    if (
      typeof value === "number" &&
      (!Number.isInteger(value) || Math.abs(value) > 2147483647)
    )
      request.input(key, sql.Decimal(18, 4), value);
    else request.input(key, value === undefined ? null : value);
  }
  return request.query(text);
}
export async function atomic(fn: any) {
  const tx = new sql.Transaction(await pool());
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (e) {
    try {
      await tx.rollback();
    } catch {}
    throw e;
  }
}
export async function audit(
  tx: any,
  user: any,
  action: any,
  entity: any,
  id: any,
) {
  await query(
    "INSERT dbo.apes_audit(user_id,action,entity,entity_id) VALUES (@uid,@action,@entity,@id)",
    { uid: user.UID, action, entity, id: String(id) },
    tx,
  );
}
