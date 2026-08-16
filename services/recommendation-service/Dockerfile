FROM node:20-alpine

WORKDIR /app

COPY shared ./shared
COPY recommendation-service ./recommendation-service

WORKDIR /app/shared
RUN npm install --omit=dev

WORKDIR /app/recommendation-service
RUN npm install

EXPOSE 4004

# docker-compose override `command` thành `node src/worker.js` cho container
# recommendation-worker — cùng image, khác entrypoint chạy.
CMD ["node", "src/server.js"]
