# EvalFlow - Hệ thống Quản lý Khảo sát Động

## Tổng quan dự án

Công nghệ sử dụng:
- **Backend**: Node.js + Express.js + PostgreSQL (kiến trúc 3 lớp: Route → Controller → Service)
- **Frontend**: React.js (Vite) + React Router v6 + Tailwind CSS v3 + Axios

---

## Bước 1: Chuẩn bị Cơ sở dữ liệu (PostgreSQL)

1. **Cài đặt PostgreSQL** (nếu chưa có):
   - Tải về: https://www.postgresql.org/download/windows/
   - Trong quá trình cài, nhớ ghi lại **password** cho user `postgres`.

2. **Tạo CSDL mới** tên là `evalflow`:
   - Mở `pgAdmin` hoặc `psql` và chạy:
     ```sql
     CREATE DATABASE evalflow;
     ```

3. **Chạy SQL tạo bảng và dữ liệu mẫu** — chọn **một trong 2 cách** sau:

   **Cách 1 (Nhanh nhất - chạy file .sql đã có sẵn):**
   - Mở PowerShell và chạy lệnh sau (nhập password postgres khi được hỏi):
     ```powershell
     psql -U postgres -d evalflow -f "d:\DuAnHocViec\EvalFlow\backend\sql\001_init_tables_seed.sql"
     ```

   **Cách 2 (Copy-paste vào pgAdmin / psql Query Tool):**
   ```sql
   -- 1. Bảng ROLES
   CREATE TABLE roles (
       id SERIAL PRIMARY KEY,
       role_name VARCHAR(50) NOT NULL UNIQUE
   );

   -- 2. Bảng USERS
   CREATE TABLE users (
       id SERIAL PRIMARY KEY,
       role_id INT NOT NULL,
       full_name VARCHAR(255) NOT NULL,
       email VARCHAR(255) UNIQUE NOT NULL,
       password_hash VARCHAR(255) NOT NULL,
       department VARCHAR(255),
       FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
   );

   -- 3. Bảng NOTIFICATIONS
   CREATE TABLE notifications (
       id SERIAL PRIMARY KEY,
       user_id INT NOT NULL,
       message TEXT NOT NULL,
       action_link VARCHAR(500),
       is_read BOOLEAN DEFAULT FALSE,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );

   -- 4. Bảng SURVEYS
   CREATE TABLE surveys (
       id SERIAL PRIMARY KEY,
       title VARCHAR(255) NOT NULL,
       description TEXT,
       theme_config JSONB DEFAULT '{}',
       created_by INT NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
   );

   -- 5. Bảng SURVEY_CAMPAIGNS
   CREATE TABLE survey_campaigns (
       id SERIAL PRIMARY KEY,
       survey_id INT NOT NULL,
       name VARCHAR(255) NOT NULL,
       start_date DATE NOT NULL,
       end_date DATE NOT NULL,
       is_active BOOLEAN DEFAULT TRUE,
       FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
   );

   -- 6. Bảng SURVEY_ASSIGNMENTS
   CREATE TABLE survey_assignments (
       id SERIAL PRIMARY KEY,
       campaign_id INT NOT NULL,
       user_id INT NOT NULL,
       status VARCHAR(50) DEFAULT 'Pending',
       FOREIGN KEY (campaign_id) REFERENCES survey_campaigns(id) ON DELETE CASCADE,
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );

   -- 7. Bảng QUESTIONS
   CREATE TABLE questions (
       id SERIAL PRIMARY KEY,
       survey_id INT NOT NULL,
       question_text TEXT NOT NULL,
       type VARCHAR(50) NOT NULL,
       is_required BOOLEAN DEFAULT TRUE,
       order_index INT NOT NULL,
       options JSONB DEFAULT '{}',
       FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
   );

   -- 8. Bảng RESPONSES
   CREATE TABLE responses (
       id SERIAL PRIMARY KEY,
       campaign_id INT NOT NULL,
       evaluator_id INT NOT NULL,
       target_user_id INT,
       context_reference VARCHAR(255),
       submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (campaign_id) REFERENCES survey_campaigns(id) ON DELETE CASCADE,
       FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE,
       FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
   );

   -- 9. Bảng ANSWERS
   CREATE TABLE answers (
       id SERIAL PRIMARY KEY,
       response_id INT NOT NULL,
       question_id INT NOT NULL,
       answer_value JSONB NOT NULL,
       FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
       FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
   );

   -- ===== DỮ LIỆU MẪU =====

   INSERT INTO roles (role_name) VALUES ('Admin'), ('Sinh viên'), ('Giảng viên') ON CONFLICT DO NOTHING;

   -- Mật khẩu cho tất cả tài khoản mẫu: MatKhau123
   -- (password_hash được băm bằng bcrypt với cost=10 - đã xác minh hoạt động)
   INSERT INTO users (role_id, full_name, email, password_hash, department) VALUES
   (1, 'Quản trị viên', 'admin@evalflow.edu', '$2b$10$o473wGYc.FP.G41ueQC9S.5EuIK5IMDNgUbE6W1Ym0mViv7cvBpjK', 'Phòng CNTT'),
   (2, 'Nguyễn Văn Sinh', 'sinh1@evalflow.edu', '$2b$10$o473wGYc.FP.G41ueQC9S.5EuIK5IMDNgUbE6W1Ym0mViv7cvBpjK', 'Công nghệ thông tin K17'),
   (3, 'Trần Thị Giảng', 'giang1@evalflow.edu', '$2b$10$o473wGYc.FP.G41ueQC9S.5EuIK5IMDNgUbE6W1Ym0mViv7cvBpjK', 'Khoa CNTT')
   ON CONFLICT (email) DO NOTHING;
   ```

---

## Bước 2: Chạy Backend (port 3000)

Mở **Terminal / PowerShell** và chạy:

```powershell
cd d:\DuAnHocViec\EvalFlow\backend
npm.cmd install        # (chạy 1 lần duy nhất nếu chưa cài dependencies)
```

**Kiểm tra file `.env`** trong thư mục `backend/.env` (đã có sẵn), sửa lại nếu password PostgreSQL của bạn khác `postgres`:

```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=evalflow
DB_USER=postgres
DB_PASSWORD=postgres        <-- sửa theo mật khẩu postgres của bạn
JWT_SECRET=evalflow_super_secret_key_please_change_in_production_2024
JWT_EXPIRES_IN=7d
```

**Khởi động Backend:**

```powershell
npm.cmd start
```

→ Thành công sẽ hiển thị:
```
Database connected successfully
Server is running on port 3000
```

**Kiểm tra nhanh & Tra cứu Backend API:**
- **Dashboard Explorer giao diện trực quan:** Mở trình duyệt truy cập [http://localhost:3000/api/health](http://localhost:3000/api/health) để xem Live Health Dashboard, Uptime, lượt gọi API thực tế và bảng tra cứu đầy đủ 44 API Endpoints.
- **Danh mục API dạng JSON:** Mở [http://localhost:3000/api/routes](http://localhost:3000/api/routes) để xem toàn bộ danh mục API phân loại theo 11 nhóm tính năng.
**Đường dẫn truy cập Swagger UI: http://localhost:3000/api-docs**
**http://localhost:3000/api-docs/#/Surveys**
---

## Bước 3: Chạy Frontend (port 5173)

Mở **Terminal / PowerShell KHÁC** (không tắt terminal chạy Backend) và chạy:

```powershell
cd d:\DuAnHocViec\EvalFlow\frontend
npm.cmd install        # (chạy 1 lần duy nhất nếu chưa cài)
npm.cmd run dev
```

→ Thành công sẽ hiển thị:
```
  ➜  Local:   http://localhost:5173/
```

---

## Bước 4: Kiểm tra đăng nhập

1. Mở trình duyệt: **http://localhost:5173/login**
2. Sử dụng một trong các tài khoản mẫu dưới đây (mật khẩu: **`MatKhau123`**):

   | Email | Vai trò | Chuyển hướng sau login |
   |-------|---------|----------------------|
   | `admin@evalflow.edu` | Admin | `/admin` |
   | `sinh1@evalflow.edu` | Sinh viên | `/` |
   | `giang1@evalflow.edu` | Giảng viên | `/` |

3. Nhập Email + `MatKhau123` → nhấn **Đăng nhập**:
   - Thành công sẽ tự động chuyển hướng
   - Token được lưu vào `localStorage` (2 key: `evalflow_token` và `evalflow_user`)
   - Sai thông tin sẽ hiện ô lỗi màu đỏ dưới form

4. Kiểm tra API `/api/auth/login` trực tiếp (optional):

   ```powershell
   Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST `
     -ContentType "application/json" `
     -Body '{"email":"admin@evalflow.edu","password":"MatKhau123"}'
   ```

   Kết quả trả về đúng format chuẩn:
   ```json
   { "success": true, "message": "Đăng nhập thành công", "data": { "token": "...", "user": {...} } }
   ```

---

## Cấu trúc thư mục chính

```
EvalFlow/
├── backend/
│   ├── server.js                 # Entry point Express
│   ├── config/
│   │   └── db.js                 # Kết nối PostgreSQL Pool
│   ├── routes/
│   │   └── auth.route.js         # POST /api/auth/login
│   ├── controllers/
│   │   └── auth.controller.js    # Xử lý Request/Response (try/catch)
│   ├── services/
│   │   └── auth.service.js       # Logic nghiệp vụ (SQL, bcrypt, JWT)
│   ├── sql/
│   │   └── 001_init_tables_seed.sql  # Script tạo 9 bảng + seed data mẫu
│   ├── .env                      # Biến môi trường DB + JWT
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # React Router routes
│   │   ├── api/
│   │   │   ├── axiosClient.js    # Axios trung tâm (Interceptors + Token)
│   │   │   └── auth.api.js       # loginApi() gọi qua axiosClient
│   │   ├── utils/
│   │   │   └── auth.utils.js     # saveAuth/getToken/clearAuth (localStorage)
│   │   └── pages/
│   │       └── Login.jsx         # UI trang Đăng nhập
│   ├── vite.config.js            # Proxy /api -> localhost:3000
│   ├── tailwind.config.js
│   └── postcss.config.js
└── docs/
    ├── tasks.md                  # Lộ trình phát triển
    ├── database-schema.md        # Schema CSDL
    └── rules.cursorrules         # Quy tắc code
```

---

## Lệnh hữu ích

| Công việc | Lệnh (chạy trong thư mục backend/ hoặc frontend/) |
|----------|-------------------------------------------------|
| Chạy Backend production mode | `cd backend ; npm.cmd start` |
| Chạy Backend watch mode | `cd backend ; npm.cmd run dev` |
| Chạy Frontend dev server | `cd frontend ; npm.cmd run dev` |
| Build Frontend ra `dist/` | `cd frontend ; npm.cmd run build` |
| Lint Frontend (oxlint) | `cd frontend ; npm.cmd run lint` |

---

## Troubleshooting (Lỗi thường gặp)

❌ **Lỗi `Database connection error` / `password authentication failed`**:
→ Kiểm tra lại `DB_USER` và `DB_PASSWORD` trong file `backend/.env` xem có khớp với tài khoản PostgreSQL của bạn không.

❌ **Lỗi `relation "users" does not exist`**:
→ Bạn chưa chạy SQL tạo bảng ở Bước 1. Hãy tạo CSDL `evalflow` và chạy toàn bộ script SQL tạo bảng.

❌ **Đăng nhập với `MatKhau123` báo "Thông tin đăng nhập không hợp lệ"**:
→ Dữ liệu mẫu chưa được insert vào bảng users/roles. Chạy đoạn `INSERT INTO roles` và `INSERT INTO users` trong script SQL ở Bước 1.

❌ **Frontend báo lỗi Network Error khi đăng nhập**:
→ Đảm bảo Backend đang chạy ở port 3000 trước. Vite đã cấu hình proxy tự động.

## Cách dừng và khởi động lại Backend (Cổng 3000)
```powershell
# 1. Dừng / Giải phóng Cổng 3000 (nếu bị lỗi EADDRINUSE)
npx kill-port 3000


# 2. Hoặc lệnh dừng tất cả các tiến trình Node đang chạy ngầm:
Get-Process -Name node | Stop-Process -Force

# 3. Khởi động lại Server Backend
cd d:\DuAnHocViec\EvalFlow\backend
npm run dev
```
