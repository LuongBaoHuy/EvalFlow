# 🤖 AI Setup & Integration Guide (EvalFlow Copilot)

Tài liệu này hướng dẫn chi tiết cách cấu hình và tích hợp các mô hình AI (**Google Gemini API** & **Service PhoBERT Python**) cho Hệ thống Khảo sát EvalFlow.

---

## 1. Cấu hình Google Gemini API (Chatbot RAG)

Mặc định, nếu chưa điền `GEMINI_API_KEY`, hệ thống EvalFlow đã tích hợp sẵn **Engine RAG Phân tích Bất thường Thông minh (Smart Fallback RAG Engine)** chạy offline mượt mà 100% dựa trên CSDL thực tế của từng chiến dịch.

Để kích hoạt sức mạnh trí tuệ nhân tạo thế hệ mới của **Google Gemini 1.5 Flash**:

### Bước 1: Lấy API Key miễn phí từ Google AI Studio
1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Đăng nhập bằng tài khoản Google và nhấn **"Create API Key"**.
3. Sao chép chuỗi API Key được cấp.

### Bước 2: Điền API Key vào hệ thống
Mở file `.env` ở thư mục `backend/.env` (hoặc root) và thêm dòng sau:
```env
GEMINI_API_KEY=AIzaSy...chuoi_api_key_cua_ban...
```

Khởi động lại server backend:
```bash
cd backend
npm run dev
```

---

## 2. Cấu hình Service PhoBERT Python (Tùy chọn - Phân tích Cảm xúc Tiếng Việt)

Mặc định, EvalFlow đã có bộ quy tắc **Rule-Based Sentiment & Conflict Engine** phân tích mâu thuẫn tiếng Việt cực kỳ chính xác.

Nếu bạn có chạy một Microservice Python PhoBERT mã nguồn mở riêng:

### Bước 1: Yêu cầu chuẩn API cho Microservice PhoBERT
- **Endpoint**: `POST http://localhost:8000/predict`
- **Header**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "text": "Nội dung văn bản ý kiến phản hồi"
  }
  ```
- **Response Body**:
  ```json
  {
    "label": "NEGATIVE",
    "score": 0.94
  }
  ```

### Bước 2: Tự động kết nối
Backend EvalFlow sẽ tự động gửi yêu cầu bất đồng bộ tới `http://localhost:8000/predict` ngay sau khi sinh viên nộp bài. Nếu service Python đang bật, kết quả PhoBERT sẽ được ưu tiên đưa vào phân tích và đánh dấu nhãn `is_anomaly`.

---

## 3. Cách Thử nghiệm Tính năng Anomaly & AI Copilot trên Giao diện Admin

1. Đăng nhập tài khoản Admin và truy cập **Quản lý Chiến dịch**.
2. Bấm vào **"📊 Xem kết quả"** của một chiến dịch bất kỳ.
3. Ở góc dưới bên phải màn hình sẽ có nút **🤖 AI Copilot (Trợ lý Phân tích Bất thường)**.
4. Bấm vào nút này để mở Chatbot và chọn các câu hỏi gợi ý nhanh như:
   - *"Tóm tắt các bài nộp bất thường trong đợt này"*
   - *"Có bài nộp nào mâu thuẫn điểm số và nhận xét không?"*
   - *"Đánh giá tổng quan chất lượng bài nộp"*

## 4. Cấu hình Email Tự động Xác nhận Nộp bài (Nodemailer SMTP)

Mặc định khi chưa cấu hình tài khoản Gmail SMTP, hệ thống sẽ chạy ở chế độ **Email Simulation Mode** (Ghi log thông tin gửi mail thành công mà không làm gián đoạn hay nghẽn API nộp bài).

Để kích hoạt tính năng gửi Email thực tế tới Hòm thư của Sinh viên qua Gmail:

### Bước 1: Tạo Gmail App Password (Mật khẩu ứng dụng)
1. Đăng nhập tài khoản Gmail gửi thư của bạn.
2. Truy cập [Google Account Security](https://myaccount.google.com/security) và bật **Bảo mật 2 lớp (2-Step Verification)**.
3. Tìm kiếm mục **"App Passwords" (Mật khẩu ứng dụng)** và tạo một mật khẩu mới cho ứng dụng "EvalFlow Email".
4. Khóa gồm 16 ký tự dạng: `xxxx xxxx xxxx xxxx`.

### Bước 2: Khai báo biến môi trường trong file `backend/.env`
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email_cua_ban@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM="Hệ thống Khảo sát EvalFlow" <email_cua_ban@gmail.com>
```

Khởi động lại server backend (`npm run dev`) để hoàn tất!
  