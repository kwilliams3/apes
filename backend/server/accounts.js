import { query,audit } from './db.js';
import { hashPassword,AppError } from './domain.js';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
export function usernameBase(employee){const first=normalize(employee.Nom).split('-').filter(Boolean);const second=normalize(employee.Prenom).split('-').find(Boolean)||first[1]||first[0]||'membre';return ((first[0]?.[0]||'m')+'-'+second).slice(0,10).replace(/-+$/,'');}
export function availableUsername(base,taken){let username=base,suffix=2;while(taken.has(username)){const number=String(suffix++);if(number.length>7)throw new AppError('Impossible de générer un identifiant unique.',409);username=base.slice(0,10-number.length)+number;}return username;}
export async function ensureEmployeeAccount(tx,employee,actor){
 // Serialize allocation with concurrent imports and manual account creation.
 const users=(await query('SELECT UID,username,Matricule FROM dbo.users WITH(TABLOCKX,HOLDLOCK)',{},tx)).recordset;
 const existing=users.find(u=>u.Matricule===employee.Matricule);if(existing)return {UID:existing.UID,username:existing.username,created:false};
 const base=usernameBase(employee),taken=new Set(users.map(u=>u.username.toLowerCase())),username=availableUsername(base,taken);
 const role=(await query("SELECT TOP 1 RID FROM dbo.roles WHERE name='membre' ORDER BY RID",{},tx)).recordset[0];if(!role)throw new AppError('Le rôle membre doit être créé avant cet ajout.',409);
 const password=await hashPassword('123456');
 const row=(await query("INSERT dbo.users(username,first_name,last_name,email,Matricule,password,status,online,last_action,avatar,created_at,updated_at,must_change_password) OUTPUT INSERTED.UID,INSERTED.username VALUES(@username,@first_name,@last_name,'',@Matricule,@password,1,0,0,'avatar.jpg',CONVERT(VARCHAR(19),GETDATE(),120),GETDATE(),1)",{username,first_name:employee.Prenom.slice(0,100)||employee.Nom.slice(0,100),last_name:employee.Nom.slice(0,100),Matricule:employee.Matricule,password},tx)).recordset[0];
 await query('INSERT dbo.users_roles(UID,RID) VALUES(@uid,@rid)',{uid:row.UID,rid:role.RID},tx);await audit(tx,actor,'auto_create','user',row.UID);return {...row,created:true};
}
