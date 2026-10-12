import { pool, query } from '../server/db.js';
try {
  console.log((await query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' ORDER BY TABLE_NAME")).recordset);
  console.log((await query("SELECT COLUMN_NAME,DATA_TYPE,CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users'")).recordset);
} catch(e) { console.error('Connexion SQL impossible :', e.message); process.exitCode = 1; }
finally { try { await (await pool()).close(); } catch {} }
