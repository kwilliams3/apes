import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig(({mode})=>{
 const {PORT}=loadEnv(mode,fileURLToPath(new URL('../backend',import.meta.url)),'PORT');
 return {plugins:[react()],server:{host:'0.0.0.0',port:5173,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:'+(PORT||3017),changeOrigin:false}}}};
});
