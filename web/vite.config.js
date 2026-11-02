import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
export default defineConfig({root:path.resolve('web'),plugins:[vue({template:{transformAssetUrls:false}})],build:{outDir:path.resolve('dist'),emptyOutDir:true},server:{proxy:{'/api':'http://localhost:3000','/assets':'http://localhost:3000','/uploads':'http://localhost:3000'}}});
