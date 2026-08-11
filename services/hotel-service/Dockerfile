FROM node:20-alpine

WORKDIR /app

COPY shared ./shared
COPY hotel-service ./hotel-service

WORKDIR /app/shared
RUN npm install --omit=dev

WORKDIR /app/hotel-service
RUN npm install

EXPOSE 4002

CMD ["node", "src/server.js"]
