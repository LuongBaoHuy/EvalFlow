# SƠ ĐỒ CƠ SỞ DỮ LIỆU DỰ ÁN KHẢO SÁT
Hệ quản trị CSDL: PostgreSQL.

## 1. MERMAID DIAGRAM (Quan hệ tổng quan)
```mermaid
erDiagram
    ROLES ||--o{ USERS : "có"
    USERS ||--o{ NOTIFICATIONS : "nhận"
    USERS ||--o{ SURVEYS : "tạo"
    SURVEYS ||--o{ SURVEY_CAMPAIGNS : "triển khai thành"
    SURVEY_CAMPAIGNS ||--o{ SURVEY_ASSIGNMENTS : "giao việc qua"
    USERS ||--o{ SURVEY_ASSIGNMENTS : "nhận nhiệm vụ từ"
    SURVEYS ||--|{ QUESTIONS : "chứa"
    SURVEY_CAMPAIGNS ||--o{ RESPONSES : "thu thập"
    USERS ||--o{ RESPONSES : "là người đánh giá"
    USERS ||--o{ RESPONSES : "là người bị đánh giá"
    RESPONSES ||--|{ ANSWERS : "bao gồm"
    QUESTIONS ||--o{ ANSWERS : "được trả lời bằng"

## 2. CSDL (Database Schema)

-- 1. Bảng ROLES: Danh mục vai trò
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

-- 2. Bảng USERS: Người dùng trong hệ thống
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    role_id INT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);

-- 3. Bảng NOTIFICATIONS: Quản lý thông báo cho người dùng
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    action_link VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Bảng SURVEYS: Lưu thông tin Form khảo sát và Giao diện
CREATE TABLE surveys (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    theme_config JSONB DEFAULT '{}', -- Lưu cấu hình màu sắc, font chữ
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Bảng SURVEY_CAMPAIGNS: Các đợt triển khai khảo sát
CREATE TABLE survey_campaigns (
    id SERIAL PRIMARY KEY,
    survey_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);

-- 6. Bảng SURVEY_ASSIGNMENTS: Giao bài khảo sát cho người dùng
CREATE TABLE survey_assignments (
    id SERIAL PRIMARY KEY,
    campaign_id INT NOT NULL,
    user_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending', -- Pending, Completed, Overdue
    FOREIGN KEY (campaign_id) REFERENCES survey_campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Bảng QUESTIONS: Danh sách câu hỏi của Form
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    survey_id INT NOT NULL,
    question_text TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- text, radio, checkbox, slider, rating
    is_required BOOLEAN DEFAULT TRUE,
    order_index INT NOT NULL,
    options JSONB DEFAULT '{}', -- Lưu cài đặt riêng (min/max, danh sách lựa chọn)
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);

-- 8. Bảng RESPONSES: Lượt nộp bài (Ai đánh giá ai)
CREATE TABLE responses (
    id SERIAL PRIMARY KEY,
    campaign_id INT NOT NULL,
    evaluator_id INT,          -- Người đi đánh giá (có thể NULL nếu khảo sát ẩn danh)
    target_user_id INT,        -- Người bị đánh giá (có thể NULL nếu đánh giá chung)
    context_reference VARCHAR(255), -- Ngữ cảnh (VD: Lớp CNTT_K1)
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES survey_campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 9. Bảng ANSWERS: Chi tiết câu trả lời
CREATE TABLE answers (
    id SERIAL PRIMARY KEY,
    response_id INT NOT NULL,
    question_id INT NOT NULL,
    answer_value JSONB NOT NULL, -- Lưu giá trị trả lời (text, mảng, số...)
    FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);