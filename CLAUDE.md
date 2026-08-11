# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong repo này.

## Tổng quan dự án

**XeDich** — Backend cho hệ thống "Lập kế hoạch Du lịch Thông minh ứng dụng AI" — đúng theo
đề tài thực tập, đã tách từ **modular monolith** sang **kiến trúc Microservices** (User/Hotel/
Transport/Recommendation/AI Service qua API Gateway). Toàn bộ code nằm trong `Backend/services/`.

**Lịch sử quan trọng:** Backend từng là 1 Express app duy nhất (`Backend/src/`, đã xoá) với 9
module chạy chung 1 process/1 MySQL DB. Đã tách thành 6 service độc lập + gateway (2026-08) để
khớp yêu cầu kiến trúc Microservices của đề tài. Lý do gộp `trip+itinerary+budget+place+location`
vào chung 1 service (`recommendation-service`) thay vì tách nhỏ hơn: `budget.service.js` gọi
thẳng `itinerary/planning.engine.js#generateItinerary` nhiều lần (1 lần/pace ứng viên) để tính
chi phí từ route thật rồi trả activities đã chọn ngược lại cho itinerary lưu — 2 module này
**đồng sản xuất** ra lịch trình cuối cùng, tách rời sẽ phá vỡ tính chính xác ngân sách hoặc phải
gọi HTTP đồng bộ giữa 2 service ngay trong 1 transaction sinh lịch trình.

## Kiến trúc

```
Client → api-gateway :5000 (proxy mỏng, http-proxy-middleware)
           ├─ /auth, /users            → user-service :4001        (DB: xedich_user_db)
           ├─ /hotels                  → hotel-service :4002       (DB: xedich_hotel_db)
           ├─ /flights                 → transport-service :4003   (không DB)
           └─ /trips, /places, /jobs,  → recommendation-service     (DB: xedich_recommendation_db)
              /locations                 :4004 (API) + recommendation-worker (BullMQ+cron, không port)
         ai-service :4005 (không public — chỉ /internal/*, gọi bởi recommendation-service)
```

Chi tiết lý do tách/gộp, sequence diagram, ERD từng DB: xem
`Tai_lieu_Thiet_Ke_Microservices_XeDich.docx` (tài liệu thiết kế đầy đủ) và
`services/README-split.md`.

## Lệnh thường dùng

```bash
docker compose up -d --build   # Build + chạy toàn bộ stack (mysql, redis, phpmyadmin,
                                # api-gateway, 5 service, 1 worker)
docker compose ps              # Xem trạng thái container
docker compose logs -f <service>  # Xem log 1 service (vd recommendation-worker)
docker compose down -v         # Dừng + XOÁ VOLUME (mất dữ liệu) — dùng khi cần khởi tạo lại schema
```

Trigger crawl thủ công (địa điểm — trong container `recommendation-service` hoặc
`recommendation-worker`, cùng code):

```bash
docker exec xedich_recommendation_service node -e "require('./src/modules/place/place.sync.job').syncAllCities().then(()=>process.exit(0))"
```

Trigger crawl khách sạn thủ công (container `hotel-service` — tự đồng bộ `locations` từ
recommendation-service trước khi crawl):

```bash
docker exec xedich_hotel_service node -e "require('./src/modules/hotel/hotel.sync.job').syncAllCities().then(()=>process.exit(0))"
```

Mỗi service dev riêng lẻ (không qua Docker): `cd services/<service> && npm install && npm run dev`
— cần MySQL/Redis chạy sẵn (qua `docker compose up -d mysql redis`) và các biến `DB_*`/`*_SERVICE_URL`
trỏ đúng (xem `docker-compose.yml` phần `environment:` của service tương ứng để biết giá trị dev).

Yêu cầu: Node >= 18. Docker image dùng node:20-alpine.

## Cấu trúc thư mục

```
Backend/
├── docker-compose.yml          # Orchestrate toàn bộ stack — NGUỒN SỰ THẬT về port/env mỗi service
├── .env                        # Biến môi trường dùng chung (KHÔNG commit — đã .gitignore)
└── services/
    ├── shared/                 # Package @xedich/shared — response.js, error.handler.js,
    │                            # auth.middleware.js (JWT verify), internal.middleware.js
    │                            # (khoá X-Internal-Key cho route /internal/*), service-client.js
    │                            # (axios wrapper gọi service khác). Mỗi service khai
    │                            # "@xedich/shared": "file:../shared" trong package.json.
    ├── api-gateway/             # Proxy mỏng — KHÔNG verify JWT, KHÔNG parse body, chỉ forward
    │                            # theo path prefix (xem src/app.js#proxy — có pathRewrite bù lại
    │                            # prefix bị Express strip, đặc thù http-proxy-middleware v3)
    ├── user-service/            # auth (đăng ký/OTP/JWT) + user (hồ sơ + preferences)
    │   └── src/modules/{auth,user}/...   # route→controller→service→repository như cũ
    ├── hotel-service/           # hotel_liteapi cũ. Bảng `locations` ở đây là BẢN SAO CHỈ ĐỌC
    │   └── src/modules/{hotel,location}/...  # (nguồn thật ở recommendation-service), đồng bộ
    │                                          # đầu mỗi lần cron tuần qua location.sync.js
    ├── transport-service/       # flight cũ (Ignav) — không DB
    ├── ai-service/               # Wrapper mỏng quanh Gemini — 1 route POST /ai/generate-json
    │                            # {prompt}→{result}. CHỈ service này giữ GEMINI_KEY.
    └── recommendation-service/  # Lõi Travel Planning Engine — gộp trip+itinerary+budget+place+location
        ├── src/modules/{trip,itinerary,budget,place,location}/...
        ├── src/clients/         # HTTP client gọi user/hotel/transport/ai-service (thay require
        │                        # xuyên module trực tiếp lúc còn monolith)
        ├── src/server.js        # CHỈ API HTTP
        └── src/worker.js        # CHỈ BullMQ worker 'trip-plan' + cron place.sync.job (process
                                  # RIÊNG với server.js — 2 container cùng image, khác command)
```

## Quy ước code (giữ nguyên từ lúc còn monolith)

- **CommonJS**, tầng `route → controller → service → repository`, response chuẩn
  `{ success, message, data }` qua `@xedich/shared`'s `response.js`.
- Message/log tiếng Việt, comment giải thích "vì sao" — giữ và cập nhật khi sửa code liên quan.
- Lỗi nghiệp vụ gán `error.statusCode`, controller `next(err)` → `errorHandler` dùng chung
  (`@xedich/shared/error.handler.js`).
- **Cross-service call**: dùng `createServiceClient` (`@xedich/shared/service-client.js`) — tự
  gắn header `X-Internal-Key` cho route `/internal/*`. Route public (vd `/hotels/rates`) gọi
  thẳng không cần key.
- **KHÔNG** để 2 service cùng ghi 1 bảng — mỗi bảng có đúng 1 service sở hữu (xem ERD trong tài
  liệu thiết kế). `locations` là ngoại lệ có chủ đích: recommendation-service là nguồn thật,
  hotel-service giữ bản sao chỉ đọc.
- Thêm biến môi trường mới: cập nhật `.env.example` (placeholder) VÀ khai báo trong
  `docker-compose.yml` (env_file dùng chung `.env`, hoặc `environment:` riêng nếu chỉ 1 service cần).

## Database — schema & cách quản lý thay đổi

Mỗi service có `database/init.sql` riêng (own database, tự `CREATE DATABASE IF NOT EXISTS`).
KHÔNG dùng migration tool. Mount vào `/docker-entrypoint-initdb.d/` của **1 container MySQL
dùng chung** (3 database logic, không phải 3 container riêng — pragmatic cho quy mô đồ án).

**Script `docker-entrypoint-initdb.d` chỉ chạy khi volume MySQL còn trống** — sửa schema DB đang
chạy phải `ALTER TABLE` thủ công, hoặc `docker compose down -v` để tạo lại (mất dữ liệu).

FK xuyên service KHÔNG tồn tại được (khác DB) — 3 chỗ đã bỏ FK so với schema monolith gốc:
`hotels.location_id`, `trips.user_id`, `ai_jobs.user_id`. Validate các trường này ở tầng ứng
dụng (JWT `req.user.id`, hoặc trust dữ liệu đến từ internal API đã xác thực).

## Biến môi trường

Xem `.env.example`. File `.env` dùng CHUNG cho mọi service qua `env_file` trong
docker-compose.yml — mỗi service override `PORT`/`DB_*`/`REDIS_*`/`*_SERVICE_URL` riêng qua
`environment:` (không đặt trong `.env` để tránh xung đột giữa các service).

Biến mới so với lúc còn monolith: `INTERNAL_API_KEY` (xác thực route `/internal/*`),
`USER_SERVICE_URL`/`HOTEL_SERVICE_URL`/`TRANSPORT_SERVICE_URL`/`RECOMMENDATION_SERVICE_URL`/
`AI_SERVICE_URL` (URL nội bộ giữa các service trong mạng docker-compose).

**Không bao giờ commit `.env` hay hard-code API key.**

## Kiểm tra trước khi hoàn thành

1. `docker compose up -d --build` toàn bộ stack thành công, `docker compose ps` không có
   container `Restarting`.
2. Test luồng chính qua gateway (`curl`/Postman tới `:5000`, KHÔNG gọi thẳng port service):
   register → verify OTP → login → tạo trip → `POST /trips/:id/plan` → poll `GET /jobs/:id` →
   `GET /trips/:id/itinerary` + `/budget`.
3. Nếu sửa `recommendation-service`: kiểm tra CẢ `src/server.js` (API) LẪN `src/worker.js`
   (BullMQ worker) còn `require` đúng — 2 entrypoint dùng chung code nhưng chạy 2 container khác
   nhau, lỗi import ở 1 bên không lộ ra khi chỉ test bên kia.
