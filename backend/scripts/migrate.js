import fs from 'node:fs/promises';
import { pool, query } from '../server/db.js';
try {
 const directory=new URL('../sql/',import.meta.url);
 const files=(await fs.readdir(directory)).filter(n=>/^\d+.*\.sql$/.test(n)).sort();
 for(const name of files){await query(await fs.readFile(new URL(name,directory),'utf8'));console.log('Migration appliquée : '+name);}
} catch(e) { console.error('Migration non appliquée :',e.message);process.exitCode=1; }
finally { try { await (await pool()).close(); } catch {} }
