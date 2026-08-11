FROM node:20-alpine

WORKDIR /app

COPY shared ./shared
COPY transport-service ./transport-service

WORKDIR /app/shared
RUN npm install --omit=dev

WORKDIR /app/transport-service
RUN npm install

EXPOSE 4003

CMD ["node", "src/server.js"]
