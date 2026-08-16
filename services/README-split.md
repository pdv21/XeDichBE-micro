# Ghi chú tách monolith → microservices

Tóm tắt nhanh (chi tiết đầy đủ: `Tai_lieu_Thiet_Ke_Microservices_XeDich.docx` ở gốc repo).

## Vì sao gộp trip+itinerary+budget+place+location vào 1 service

`budget.service.js#fitBudgetForPlanning` gọi thẳng `itinerary/planning.engine.js#generateItinerary`
nhiều lần (1 lần/pace ứng viên: packed→moderate→relaxed) để tính chi phí ăn/vé/di chuyển từ ĐÚNG
route vừa sinh, rồi trả `activities` đã chọn ngược lại cho `itinerary.service.js` lưu thẳng —
không sinh lại lần 2. Hai module này **đồng sản xuất** kết quả cuối, không có ranh giới rõ ràng
để tách thành 2 service mà không phải: (a) gọi HTTP đồng bộ nhiều lần ngay giữa 1 transaction sinh
lịch trình (chậm + phức tạp xử lý lỗi), hoặc (b) trùng lặp thuật toán `generateItinerary` ở 2 nơi.
`place`/`location` cũng bị `itinerary`/`trip` JOIN/require trực tiếp rất nhiều (xem lịch sử khảo
sát trong tài liệu thiết kế) — gộp chung giữ đúng ranh giới miền nghiệp vụ "Recommendation Service"
mà đề tài đặt tên, đồng thời tránh vỡ tính đúng đắn của budget-aware planning.

## Vì sao `locations` có 2 bản (recommendation-service nguồn thật, hotel-service bản sao)

`locations` gần như tĩnh (17 thành phố, admin seed 1 lần). `hotel-service` cần nó ở **hot path**
(`search-by-city` — user gọi trực tiếp), nên giữ bản sao cục bộ thay vì gọi HTTP mỗi request.
Đồng bộ bằng cách gọi `GET /internal/locations` ở đầu mỗi lần chạy cron tuần
(`hotel.sync.job.js` → `location.sync.js`) — tần suất đủ vì dữ liệu gần như không đổi.

## Vì sao AI Service chỉ có 1 endpoint chung

`POST /ai/generate-json {prompt}` — provider-agnostic, không biết gì về "itinerary"/"feedback".
Toàn bộ prompt-building nghiệp vụ (`ai.personalizer.js`, `feedback.interpreter.js`,
`place.enrich.job.js`) vẫn nằm trong `recommendation-service`, chỉ đổi lệnh gọi cuối. Giữ
`GEMINI_KEY` tập trung 1 chỗ, dễ đổi provider sau này (đề tài cho phép "OpenAI hoặc LLM khác").

## Đã kiểm thử end-to-end (2026-08-04)

`docker compose up -d --build` toàn bộ 10 container ổn định, luồng
register→OTP→login→tạo trip→`POST /trips/:id/plan`→poll job→`GET /trips/:id/itinerary`+`/budget`
chạy đúng qua gateway với dữ liệu thật (LiteAPI, Ignav, Gemini), so khớp qua cả curl và Frontend
(Next.js, không sửa gì) qua trình duyệt.
