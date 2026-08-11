FROM node:20-alpine

WORKDIR /app

COPY shared ./shared
COPY ai-service ./ai-service

WORKDIR /app/shared
RUN npm install --omit=dev

WORKDIR /app/ai-service
RUN npm install

EXPOSE 4005

CMD ["node", "src/server.js"]
