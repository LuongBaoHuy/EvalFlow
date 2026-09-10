*Đây là "bản đồ tiến độ". Bạn dùng file này để giao việc cho AI từng bước một, tránh để AI bị tẩu hỏa nhập ma do làm quá nhiều thứ cùng lúc.*

```markdown
# LỘ TRÌNH PHÁT TRIỂN DỰ ÁN

## Phase 1: Setup Môi trường & Database
- [x] Thiết kế Database (ERD & SQL).
- [x] Setup Backend Node/Express (chia thư mục route, controller, service).
- [x] Cấu hình kết nối PostgreSQL vào Node.
- [x] Setup Frontend React/Vite (chia thư mục components, pages, api).
- [x] Setup cấu hình `axiosClient` trên Frontend.

## Phase 2: Đăng nhập & Quyền (Auth)
- [x] Viết API `/api/auth/login` (Tạo token JWT).
- [x] Làm UI trang Đăng nhập (Lưu Token, chuyển hướng).
- [x] Cài đặt Route Guard trên React (Chặn người dùng chưa đăng nhập, phân luồng Admin/User).

## Phase 3: Quản lý Form (Admin)
- [x] API CRUD bảng `surveys` (Thêm tên Form, lưu `theme_config`).
- [x] API CRUD bảng `questions` (Hỗ trợ cấu hình `options` JSONB).
- [x] UI tạo Form (Có thể thêm câu hỏi động, tùy chỉnh màu sắc).
- [x] API tạo Chiến dịch (`survey_campaigns`) và tự động sinh dữ liệu Giao việc (`survey_assignments`).

## Phase 4: Sinh viên làm bài & Thông báo
- [x] API lấy số lượng Thông báo chưa đọc.
- [x] Giao diện Header: Hiển thị quả chuông thông báo đỏ.
- [x] UI danh sách "Bài khảo sát đang chờ".
- [x] Màn hình làm khảo sát: Đọc `theme_config` để render màu sắc, render giao diện câu hỏi dựa trên cột `type`.
- [x] API Submit bài: Ghi vào bảng `responses` và `answers` (JSONB). Chuyển status Assignment thành Completed.

## Phase 5: Thống kê & Báo cáo (Analytics)
- [x] Cấu trúc câu truy vấn SQL lấy điểm trung bình và tổng hợp dữ liệu JSONB từ bảng `answers`.
- [x] API trả về số liệu thống kê `GET /api/campaigns/:id/analytics` gom nhóm dữ liệu theo 6 loại `type` (`radio`, `checkbox`, `slider`, `rating`, `text`, `file_upload`).
- [x] API Theo dõi tiến độ `GET /api/campaigns/:id/tracking` trả về danh sách user được giao bài (`full_name`, `email`, `department`, `status`).
- [x] API Lấy danh sách phiếu nộp `GET /api/campaigns/:id/responses` trả về thông tin người nộp (LEFT JOIN users, hiển thị 'Người dùng ẩn danh' nếu evaluator_id null) và chi tiết câu hỏi - câu trả lời.
- [x] UI Bảng danh sách Chiến dịch: Thêm nút 'Xem kết quả' vào cột Hành động chuyển hướng tới `/admin/campaigns/:id/results`.
- [x] UI Trang Báo cáo Khảo sát `CampaignResults.jsx`: Nâng cấp giao diện 3 Tab ("Thống kê Tổng quan", "Tiến độ Nộp bài", "Chi tiết Phiếu nộp"), tích hợp Recharts, giao diện đánh giá Amazon/Shopee cho `rating`, Document Grid cho `file_upload`, bộ lọc trạng thái (Tất cả / Đã nộp / Chưa nộp), nút "Gửi Email Nhắc Nhở", và Modal xem chi tiết phiếu nộp.
- [x] Cập nhật logic nộp bài Ẩn danh: Tự động cập nhật `status = 'Completed'` trong `survey_assignments` khi sinh viên submit bài.
- [x] Bổ sung Phân trang (Pagination) và Tìm kiếm (Search) cho API `GET /api/campaigns/:id/tracking` và `GET /api/campaigns/:id/responses`, cùng ô tìm kiếm (debounce 500ms) và thanh phân trang trên `CampaignResults.jsx`.
- [x] Tích hợp tính năng Xuất Báo cáo Excel cho chiến dịch: Thư viện `exceljs`, API `GET /api/campaigns/:id/export-excel`, stream file `.xlsx` định dạng cột chuẩn và nút '📥 Xuất Excel' màu xanh lá trên giao diện `CampaignResults.jsx`.
- [x] Bổ sung cơ chế kiểm duyệt chặt chẽ (Validation) cho Import Excel phân công: API `GET /api/campaigns/template-excel` cung cấp File Mẫu, kiểm tra cấu trúc 3 cột Header chuẩn (Email Sinh Viên | Email Giảng Viên | Môn Học), kiểm tra sự tồn tại của Sinh viên & Giảng viên trong DB (trả lỗi gom mảng chi tiết), chỉ tạo Assignment khi 100% dữ liệu hợp lệ, và cải thiện UI Sinh viên hiển thị 'Đánh giá: Thầy/Cô [full_name] - Môn: [context_reference]' không kèm email thô.
- [x] Tái cấu trúc UX/UI Dashboard Sinh viên & Màn hình Trung gian: Gom nhóm các nhiệm vụ thành 1 Thẻ duy nhất/chiến dịch trên Dashboard (`MySurveys.jsx`), tạo route mới Màn hình Trung gian (`CampaignDetailSelection.jsx`), tự động Redirect làm bài cho Khảo sát chung và hiển thị danh sách Thẻ Giảng viên kèm nút 'Xác nhận hoàn thành Đợt khảo sát này' (Lối thoát khi đã làm ít nhất 1 bài).
- [x] Bổ sung tính năng Auto-save Draft (Lưu nháp tự động bằng LocalStorage): Đặt tên Storage Key duy nhất `draft_survey_${campaign_id}_${assignment_id || 'public'}`, tự động lưu nháp mỗi khi người dùng thay đổi đáp án, tự động khôi phục dữ liệu làm dở kèm thông báo Toast, và dọn dẹp `localStorage` khi submit thành công.
- [x] Triển khai tính năng Chia sẻ Link khảo sát (Deep Linking) và Chuyển hướng thông minh sau đăng nhập (Post-Login Redirect): Thêm nút '🔗 Copy Link' động trên Admin (`CampaignsList.jsx`), bảo vệ route với `ProtectedRoute.jsx` giữ tham số `?redirect=...`, và chuyển hướng người dùng ngay sau khi đăng nhập thành công (`Login.jsx`).
- [x] Tích hợp tính năng AI Copilot Chatbot (Trợ lý ảo phân tích dữ liệu & phát hiện bất thường): Bổ sung cột `is_anomaly` và `anomaly_reason` trong DB (`003_add_response_anomaly_columns.sql`), viết service `anomalyDetector.service.js` kiểm tra mâu thuẫn điểm số/văn bản (hỗ trợ PhoBERT Python API `http://localhost:8000/predict`), xây dựng API `POST /api/campaigns/:id/chat` tích hợp Gemini RAG, giao diện Chatbot FAB `CampaignCopilotChatbot.jsx` tại `CampaignResults.jsx`, và tạo file hướng dẫn `AI_SETUP_GUIDE.md`.
- [x] Tích hợp tính năng Tự động Gửi Email Xác Nhận Sau Khi Nộp Bài Khảo Sát Thành Công (Nodemailer): Cài đặt `nodemailer`, tạo `emailService.js` thiết kế HTML Email Template chuyên nghiệp, cấu hình các biến `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` trong `backend/.env`, và tích hợp luồng chạy ngầm không chặn API (Fire-and-forget, không dùng `await`) trong `responses.service.js`.
- [x] Tích hợp Google Gemini AI SDK trực tiếp cho Service Phát hiện Bất thường (Anomaly Detector): Cài đặt `@google/generative-ai`, viết hàm `analyzeResponseWithGemini(ratingScore, textFeedback)` áp dụng kỹ thuật Prompt Engineering ép kiểu JSON chuẩn `{ is_anomaly: true/false, reason: "..." }`, tự động cập nhật `is_anomaly` & `anomaly_reason` vào bảng `responses` trong CSDL, và bọc `try...catch` ngầm không chặn luồng nộp bài chính.
- [x] Tối ưu hóa System Instruction của Gemini API trong Chatbot RAG (Xử lý Scale Dữ liệu Lớn): Đếm `anomalies.length` rẽ nhánh Prompt (nếu `<= 3` liệt kê chi tiết, nếu `> 3` yêu cầu viết Báo cáo Tóm tắt Vĩ mô gồm 3 phần), và tự động đính kèm Lời gọi hành động (Call to Action) chuẩn hóa ở cuối mọi câu trả lời: `*Để xem toàn bộ danh sách chi tiết, vui lòng chuyển sang tab "Phân tích Bất thường".*`.
- [x] Bổ sung Tab 'Phân tích Bất thường (AI)' tại trang Xem Báo Cáo Chiến Dịch (CampaignResults): Nâng cấp API `GET /api/campaigns/:id/responses` nhận query `?anomalyOnly=true` kèm phân trang, thêm Tab UI `⚠️ Phân tích Bất thường (AI)` kèm Red Badge hiển thị số lượng phiếu lỗi, thiết kế Bảng dữ liệu (Mã Phiếu | Người nộp | Ngày giờ | Lý do cảnh báo AI | Hành động), và tái sử dụng Modal xem chi tiết phiếu khảo sát kèm banner cảnh báo đỏ.
- [x] Bổ sung loại câu hỏi mới 'Danh sách thả xuống (Dropdown)': Cài đặt `xlsx`, bổ sung type `dropdown` trong Form Builder `QuestionBuilder.jsx` với tính năng 'Tải file mẫu (.xlsx)' và 'Nhập từ Excel' (đọc Cột A từ dòng 2), hỗ trợ Checkbox tùy chọn 'Khác...' cố định, render thẻ `<select>` linh hoạt với ô input gõ văn bản trượt mở mượt mà khi chọn 'Khác...' trong `DynamicSurveyRenderer.jsx`, bắt lỗi Validate bắt buộc khi bỏ trống ô nhập, và trích xuất trực tiếp giá trị text nhập trong ô input tự do để lưu DB trong `DoSurveyPage.jsx`.
- [x] Tối ưu luồng Mở trực tiếp Chế độ Xem lại (Read-Only Review Mode) cho bài khảo sát đã hoàn thành tại Dashboard Sinh viên (`MySurveys.jsx`).
- [x] Khắc phục triệt để lỗi z-index che khuất Popover Thông báo (`z-[100]`), tự động chuyển thông báo thành đã đọc khi nhấn vào, và bổ sung Tính năng Xóa thông báo (xóa từng dòng & xóa tất cả thông báo đã đọc) lưu trữ vĩnh viễn vào CSDL PostgreSQL.
- [x] Xây dựng Module Quản lý Người dùng (User Management) & Phân quyền Admin: Thiết lập Router Guard `AdminRoute.jsx` (đẩy non-admin về `/my-surveys`) và Middleware Backend `adminMiddleware` (chặn HTTP 403 Forbidden đối với non-admin), tạo trang Quản lý Người dùng `UsersList.jsx` (Bảng dữ liệu, Phân trang, Tìm kiếm & Lọc role, Modal Tạo mới/Sửa/Xóa tài khoản), và tích hợp tính năng Import Excel Hàng loạt (`.xlsx`) đọc Cột A (Họ tên), B (Email), C (Role) tự động hash mật khẩu mặc định `EvalFlow@123` lưu vào CSDL PostgreSQL.
- [x] Mở rộng Feature Khảo sát Công khai yêu cầu Đăng nhập Google (Public Auth Survey): Thêm cột `is_public` trong bảng `survey_campaigns` (`004_add_campaign_is_public_column.sql`), nâng cấp Modal Tạo Chiến dịch bổ sung Checkbox `[x] 🌐 Khảo sát Công khai`, tích hợp Đăng nhập bằng Google (Google SSO Button tại `Login.jsx` & API `POST /api/auth/google-login`), tự động cấp tài khoản vai trò `'Guest'` (Auto-Provisioning) khi email chưa tồn tại, và bảo vệ phân quyền tại `DoSurveyPage.jsx` (tự động cho phép người ngoài đăng nhập Google tham gia Khảo sát Công khai, chặn HTTP 403 Forbidden đối với Chiến dịch Nội bộ không phân công).
- [x] Tích hợp Đăng nhập Google OAuth2 Thực tế (Real Google SSO): Đập bỏ 100% logic prompt/giả lập, cài đặt `@react-oauth/google` cho Frontend và `google-auth-library` cho Backend, bọc `<GoogleOAuthProvider>` trong `App.jsx`, render nút bấm Google SDK chính thức `<GoogleLogin>` tại `Login.jsx`, xác thực ID Token chữ ký số Google bằng `OAuth2Client.verifyIdToken()` trên Backend, trích xuất chính chủ Email/Name từ `ticket.getPayload()`, và sinh JWT `PublicGuest` ngắn hạn (2 giờ) không chèn user rác vào CSDL.

# CHI TIẾT CÁC TASK GIAO DIỆN (FRONTEND - REACTJS)

## [UI] Phase 2: Đăng nhập & Layout
- [x] Cài đặt `react-router-dom` và `tailwindcss` vào frontend.
- [x] Tạo trang `/login`: Form đăng nhập gồm Email, Password, nút Submit. Bắt lỗi nhập thiếu dữ liệu.
- [x] Tạo file `src/components/Layout.jsx`: Xây dựng khung giao diện chung (Sidebar bên trái chứa Menu, Header bên trên chứa thông tin User và Quả chuông thông báo).
- [x] Cài đặt Role-based Routing: 
      - Nếu `role === 'Admin'`, hiện menu "Quản lý Khảo sát", "Chiến dịch".
      - Nếu `role === 'Sinh viên'`, hiện menu "Bài khảo sát của tôi".

## [UI] Phase 3: Quản lý Form (Dành cho Admin)
- [x] Tạo trang `/admin/surveys`: Bảng hiển thị danh sách các Form đã tạo. Cột gồm: Tên form, Người tạo, Ngày tạo, Hành động (Sửa/Xóa).
- [x] Tạo trang `/admin/surveys/create`: Giao diện chia 2 cột.
      - Cột trái: Form nhập Tên, Mô tả và bộ Color Picker để chọn màu `theme_config`.
      - Cột phải: Giao diện kéo thả/thêm Câu hỏi động (Thêm câu hỏi Text, Trắc nghiệm, Thang điểm).
- [x] Xây dựng Component `QuestionBuilder.jsx`: Cho phép Admin định nghĩa cột `options` (VD: chọn Trắc nghiệm thì hiện thêm nút "Thêm đáp án A, B, C").

## [UI] Phase 4: Sinh viên làm bài & Hiển thị Form động
- [x] Xây dựng Component `DynamicSurveyRenderer.jsx`: Nhận cục dữ liệu `theme_config` từ API và áp dụng biến màu CSS (CSS Variables) vào style của form.
- [x] Hiển thị câu hỏi dựa theo `type`: 
      - `type="text"` -> render thẻ `<textarea>`.
      - `type="radio"` -> render danh sách `<input type="radio">` dựa vào cục JSON `options`.
      - `type="slider"` -> render thanh trượt `<input type="range">`.
- [x] Nút Submit Form: Thu thập toàn bộ dữ liệu người dùng đã nhập thành mảng `answers` JSON và gọi API POST gửi lên Backend.

## Phase 6: Nâng cấp Tùy chỉnh Form & Xử lý Hình ảnh (Advanced Customization)

### 6.1. Định nghĩa lại cấu trúc JSON (Dành cho AI đọc hiểu)
Bắt đầu từ Phase này, cấu trúc lưu trữ JSONB trong CSDL sẽ được mở rộng:
- Bảng `surveys` (Cột `theme_config`): Bổ sung thêm `logoUrl` (string), `coverImageUrl` (string), `fontFamily` (string - "Inter" | "Roboto" | "Merriweather").
- Bảng `questions` (Cột `options`): Bổ sung thêm `imageUrl` (string) để đính kèm ảnh minh họa cho câu hỏi. Thêm type mới là `file_upload`.

### 6.2. Backend - Xử lý Upload File (NodeJS)
- [x] Cài đặt thư viện `multer` (xử lý multipart/form-data) và `cloudinary` (hoặc lưu local tùy cấu hình).
- [x] Viết Route & Controller: `POST /api/uploads/image`. API này nhận 1 file ảnh, lưu trữ và trả về `{ "success": true, "data": { "url": "https://..." } }`.
- [x] Xây dựng Middleware lọc file: Chỉ cho phép định dạng `.jpg`, `.png`, `.jpeg` và giới hạn dung lượng dưới 5MB.

### 6.3. Frontend - Component Upload Ảnh (ReactJS)
- [x] Tạo Component `ImageUploader.jsx` dùng chung: Giao diện có nút "Chọn ảnh", khi người dùng chọn sẽ tự động gọi API `/api/uploads/image`, hiển thị thanh loading, và trả về chuỗi URL ảnh sau khi upload thành công.

### 6.4. Frontend - Cập nhật Trang Tạo Form (Admin)
- [x] Nâng cấp Sidebar Cấu hình (Theme Config): Thêm Dropdown chọn `fontFamily`. Thêm 2 khối `ImageUploader` để upload Logo và Ảnh bìa (Cover Image).
- [x] Cập nhật UI Preview: Hiển thị ngay lập tức Logo và Cover Image trên đầu Form khi có URL. Thay đổi font chữ toàn bộ Form dựa vào biến CSS `--font-family`.
- [x] Nâng cấp Component `QuestionBuilder.jsx`: Thêm nút "Đính kèm ảnh minh họa" cho mỗi câu hỏi. Khi có ảnh, render thẻ `<img src="..." />` ngay dưới nội dung câu hỏi.
- [x] Thêm tùy chọn loại câu hỏi (Type): `Tải lên tệp (File Upload)`.

### 6.5. Frontend - Màn hình Sinh viên làm bài
- [x] Cập nhật `DynamicSurveyRenderer.jsx`: Đọc `logoUrl`, `coverImageUrl` và `fontFamily` từ API để render giao diện Form hoàn chỉnh.
- [x] Xử lý câu hỏi type `file_upload`: Hiển thị Component `ImageUploader` để sinh viên tải ảnh lên (VD: ảnh minh chứng cơ sở vật chất hỏng). Lấy URL ảnh gán vào mảng `answers` để submit.