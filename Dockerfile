FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY web ./web
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=80 CLOUD_HOSTING=true DATABASE_DRIVER=mysql TRUST_PROXY=1 ENABLE_DEV_LOGIN=false DATA_DIR=/app/data UPLOAD_DIR=/app/uploads
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p data uploads && chown -R node:node data uploads
COPY --from=build /app/dist ./dist
COPY server ./server
COPY tools/reset-admin.js ./tools/reset-admin.js
COPY miniprogram/assets ./miniprogram/assets
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server/index.js"]
