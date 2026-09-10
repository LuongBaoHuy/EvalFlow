<div align="center">

# 🌟 EvalFlow

**Hệ thống Quản lý và Phân tích Khảo sát Động Toàn diện**

*Một nền tảng doanh nghiệp linh hoạt giúp tạo, quản lý và phân tích các chiến dịch khảo sát, đánh giá hiệu suất với kiến trúc hiện đại và bảo mật.*

[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

<br />

## 📖 Mục lục

- [Tổng quan dự án](#-tổng-quan-dự-án)
- [Kiến trúc & Công nghệ](#-kiến-trúc--công-nghệ)
- [Tính năng nổi bật](#-tính-năng-nổi-bật)
- [Hướng dẫn Cài đặt & Vận hành](#-hướng-dẫn-cài-đặt--vận-hành)
  - [1. Thiết lập Cơ sở dữ liệu (PostgreSQL)](#1-thiết-lập-cơ-sở-dữ-liệu-postgresql)
  - [2. Khởi chạy Backend](#2-khởi-chạy-backend)
  - [3. Khởi chạy Frontend](#3-khởi-chạy-frontend)
- [Tài khoản Thử nghiệm](#-tài-khoản-thử-nghiệm)
- [Tài liệu API & Monitoring](#-tài-liệu-api--monitoring)
- [Cấu trúc Dự án](#-cấu-trúc-dự-án)
- [Xử lý Sự cố (Troubleshooting)](#-xử-lý-sự-cố-troubleshooting)

---

## 🎯 Tổng quan dự án

**EvalFlow** là một hệ thống phần mềm cấp doanh nghiệp được thiết kế để giải quyết bài toán quản lý các chiến dịch khảo sát và đánh giá (ví dụ: đánh giá giảng viên, đánh giá KPI nhân sự) một cách tự động và trực quan. 

Hệ thống cung cấp trải nghiệm liền mạch cho nhiều nhóm người dùng (Admin, Sinh viên, Giảng viên) với luồng dữ liệu (workflow) được kiểm soát chặt chẽ từ khâu xây dựng form khảo sát động cho đến khâu phân tích dữ liệu và xuất báo cáo tự động.

---

## 🛠 Kiến trúc & Công nghệ

Dự án áp dụng mô hình **Kiến trúc 3 lớp (3-Tier Architecture)** ở phía Backend (Route → Controller → Service) nhằm đảm bảo tính phân tách trách nhiệm (Separation of Concerns), dễ dàng mở rộng (scalability) và bảo trì (maintainability).

### Phân hệ Frontend (Client)
- **Core Framework**: React.js 18 (Xây dựng thông qua Vite mang lại tốc độ HMR siêu tốc).
- **Điều hướng (Routing)**: React Router v6.
- **Giao diện (UI/UX)**: Áp dụng hệ thống thiết kế hiện đại với Tailwind CSS v3.
- **Tương tác API**: Sử dụng Axios với Interceptors để tự động đính kèm và gia hạn Token.

### Phân hệ Backend (Server)
- **Core Runtime**: Node.js môi trường bất đồng bộ (Non-blocking I/O).
- **Web Framework**: Express.js tối ưu hóa xử lý RESTful API.
- **Hệ quản trị CSDL**: PostgreSQL đảm bảo tính toàn vẹn dữ liệu chuẩn ACID.
- **Bảo mật**: Cơ chế xác thực JSON Web Tokens (JWT) và mã hóa mật khẩu một chiều Bcrypt (Cost=10).

---

## ✨ Tính năng nổi bật

- **Quản lý Form Động**: Admin có thể tạo ra các bảng câu hỏi với nhiều loại định dạng (Trắc nghiệm, Tự luận, Matrix...) mà không cần can thiệp vào mã nguồn.
- **Tổ chức Chiến dịch**: Định cấu hình thời gian bắt đầu, kết thúc, đối tượng tham gia đánh giá và đối tượng được đánh giá.
- **Đa vai trò & Phân quyền (RBAC)**: Giao diện và quyền hạn được thay đổi tương ứng theo Role (Quản trị viên, Người đánh giá, Người được đánh giá).
- **Báo cáo & Phân tích Theo thời gian thực**: Trực quan hóa dữ liệu phản hồi, phát hiện các điểm bất thường (Anomaly detection) trong kết quả.
- **Tích hợp Trợ lý AI Copilot**: Hỗ trợ tự động hóa trong việc đánh giá và tóm tắt phản hồi (nếu được cấu hình).

---

## 🚀 Hướng dẫn Cài đặt & Vận hành

### 1. Thiết lập Cơ sở dữ liệu (PostgreSQL)

1. **Cài đặt PostgreSQL**: Tải về và cài đặt từ [trang chủ chính thức](https://www.postgresql.org/download/). Vui lòng ghi nhớ mật khẩu của user `postgres`.
2. **Tạo Database**: Khởi tạo một cơ sở dữ liệu trống có tên `evalflow`.
3. **Khởi tạo Schema & Dữ liệu mẫu**:
   Mở Command Line (hoặc PowerShell) và chạy lệnh sau để tự động tạo toàn bộ bảng và dữ liệu:
   ```bash
   psql -U postgres -d evalflow -f "backend/sql/001_init_tables_seed.sql"
   ```
   *(Hoặc bạn có thể copy nội dung file SQL này và chạy trực tiếp trong pgAdmin).*

### 2. Khởi chạy Backend

Mở Terminal tại thư mục gốc của dự án, di chuyển vào thư mục `backend` và thực hiện:

```bash
cd backend
npm install
```

**Cấu hình Môi trường:**
Sao chép file `.env.example` thành `.env` và cập nhật cấu hình cho phù hợp với máy của bạn:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=evalflow
DB_USER=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD
JWT_SECRET=your_secure_random_jwt_string_here
JWT_EXPIRES_IN=7d
```

**Khởi động Server:**
```bash
npm run dev
```
*(Nếu thành công, terminal sẽ hiển thị dòng chữ `Database connected successfully` và `Server is running on port 3000`)*.

### 3. Khởi chạy Frontend

Mở một cửa sổ Terminal mới, di chuyển vào thư mục `frontend`:

```bash
cd frontend
npm install
npm run dev
```
*(Hệ thống sẽ cung cấp cho bạn một đường link Localhost, ví dụ: `http://localhost:5173/` để truy cập vào ứng dụng).*

---

## 🔑 Tài khoản Thử nghiệm

Sau khi khởi chạy ứng dụng, bạn có thể truy cập vào **http://localhost:5173/login** để trải nghiệm với các tài khoản được cấp sẵn (Mật khẩu mặc định cho tất cả là: **`MatKhau123`**):

| Chức vụ / Vai trò | Tên đăng nhập (Email) | Chuyển hướng sau đăng nhập |
| :--- | :--- | :--- |
| 🛡 **Quản trị viên (Admin)** | `admin@evalflow.edu` | `/admin` (Trang quản trị toàn diện) |
| 🎓 **Sinh viên (Người đánh giá)** | `sinh1@evalflow.edu` | `/` (Trang danh sách chiến dịch) |
| 👨‍🏫 **Giảng viên (Được đánh giá)** | `giang1@evalflow.edu` | `/` (Trang xem kết quả/phản hồi) |

---

## 📡 Tài liệu API & Monitoring

EvalFlow cung cấp hệ thống theo dõi và tài liệu API tự động hoàn chỉnh, đáp ứng tiêu chuẩn của các hệ thống doanh nghiệp:

- **Swagger UI API Documentation**: Truy cập `http://localhost:3000/api-docs` để xem tài liệu tương tác cho toàn bộ 40+ endpoints. Bạn có thể test trực tiếp API từ đây.
- **Live Health Dashboard**: Truy cập `http://localhost:3000/api/health` để xem trạng thái thời gian thực của Server (Uptime, Ram Usage, Database Latency).
- **JSON Routes Registry**: Khám phá danh mục API phân rã theo nhóm tính năng tại `http://localhost:3000/api/routes`.

---

## 📂 Cấu trúc Dự án

Dự án được tổ chức theo cấu trúc module rõ ràng để dễ dàng mở rộng:

```text
EvalFlow/
├── backend/                  # RESTful API Server
│   ├── config/               # Cấu hình hệ thống (Database Connection)
│   ├── controllers/          # Nhận Request, trả Response (Catch errors)
│   ├── middlewares/          # Xử lý JWT Auth, Phân quyền, Uploads
│   ├── routes/               # Định tuyến API Endpoints
│   ├── services/             # Business Logic (Tương tác CSDL)
│   ├── sql/                  # Scripts Migration & Seeding
│   └── server.js             # Entry Point của Backend
│
├── frontend/                 # Client Application
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── api/              # Axios instance & API Service mappers
│   │   ├── components/       # Các React components dùng chung (UI kit)
│   │   ├── pages/            # View/Màn hình chính theo từng Route
│   │   ├── utils/            # Helper functions (Format date, Auth Utils)
│   │   └── App.jsx           # App Routing Component
│   └── vite.config.js        # Cấu hình Build & Dev Proxy
│
└── docs/                     # Tài liệu thiết kế hệ thống
    ├── database-schema.md    # Mô tả chi tiết cấu trúc Database
    └── data-flow.md          # Luồng dữ liệu của hệ thống
```

---

## 🛠 Xử lý Sự cố (Troubleshooting)

**1. Lỗi `Database connection error` hoặc `password authentication failed`**
- Nguyên nhân: Sai tài khoản/mật khẩu kết nối Database.
- Khắc phục: Kiểm tra kỹ lại các biến `DB_USER` và `DB_PASSWORD` trong file `backend/.env`.

**2. Lỗi `relation "users" does not exist`**
- Nguyên nhân: Bạn đã tạo Database nhưng quên chạy file SQL tạo bảng.
- Khắc phục: Chạy lại lệnh tạo bảng và import dữ liệu ở Bước 1.

**3. Đăng nhập báo "Thông tin đăng nhập không hợp lệ" mặc dù nhập đúng `MatKhau123`**
- Nguyên nhân: Thiếu dữ liệu mẫu.
- Khắc phục: Đảm bảo bạn đã chạy đầy đủ file `001_init_tables_seed.sql`.

**4. Khởi động Backend báo lỗi `EADDRINUSE: address already in use :::3000`**
- Nguyên nhân: Cổng 3000 đã bị chiếm dụng bởi một tiến trình khác.
- Khắc phục: Mở PowerShell và chạy `npx kill-port 3000`, sau đó khởi động lại bằng `npm run dev`.

---
<div align="center">
  <i>Được thiết kế và phát triển với ❤️ — EvalFlow Project</i>
</div>
