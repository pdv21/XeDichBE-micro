FROM node:20-alpine

WORKDIR /app

COPY api-gateway ./api-gateway

WORKDIR /app/api-gateway
RUN npm install

EXPOSE 5000

CMD ["node", "src/server.js"]
