export function isAllowedOrigin(origin,host,appOrigin,apiPort){
 const accepted=new Set([appOrigin||'http://localhost:5173','http://localhost:5173','http://127.0.0.1:5173',`http://localhost:${apiPort}`,`http://127.0.0.1:${apiPort}`]);
 if(host){accepted.add(`http://${host}`);accepted.add(`https://${host}`);}
 return accepted.has(origin);
}
