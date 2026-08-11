FROM node:20-alpine

WORKDIR /app

COPY shared ./shared
COPY user-service ./user-service

# shared là dependency file: — npm không tự cài deps CỦA shared (jsonwebtoken,
# axios) khi link qua file:, phải cài riêng trước.
WORKDIR /app/shared
RUN npm install --omit=dev

WORKDIR /app/user-service
RUN npm install

EXPOSE 4001

CMD ["node", "src/server.js"]
