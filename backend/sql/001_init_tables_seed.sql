-- ============================================================
-- EvalFlow - Database Init Script
-- Chạy file này sau khi đã tạo CSDL evalflow trong PostgreSQL
-- Cách chạy: psql -U postgres -d evalflow -f 001_init_tables_seed.sql
-- ============================================================

-- 1. Bảng ROLES: Danh mục vai trò
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

-- 2. Bảng USERS: Người dùng trong hệ thống
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    role_id INT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    department VARCHAR(255),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);

-- 3. Bảng NOTIFICATIONS: Quản lý thông báo cho người dùng
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    action_link VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Bảng SURVEYS: Lưu thông tin Form khảo sát và Giao diện
CREATE TABLE IF NOT EXISTS surveys (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    theme_config JSONB DEFAULT '{}',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Bảng SURVEY_CAMPAIGNS: Các đợt triển khai khảo sát
CREATE TABLE IF NOT EXISTS survey_campaigns (
    id SERIAL PRIMARY KEY,
    survey_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);

-- 6. Bảng SURVEY_ASSIGNMENTS: Giao bài khảo sát cho người dùng
CREATE TABLE IF NOT EXISTS survey_assignments (
    id SERIAL PRIMARY KEY,
    campaign_id INT NOT NULL,
    user_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    target_user_id INT,          -- ID của Giảng viên (người bị đánh giá)
    context_reference VARCHAR(255), -- Ngữ cảnh: Tên Môn học
    FOREIGN KEY (campaign_id) REFERENCES survey_campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_survey_assignments_target_user_id
ON survey_assignments (target_user_id);

CREATE INDEX IF NOT EXISTS idx_survey_assignments_context_reference
ON survey_assignments (context_reference);

-- 7. Bảng QUESTIONS: Danh sách câu hỏi của Form
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    survey_id INT NOT NULL,
    question_text TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    order_index INT NOT NULL,
    options JSONB DEFAULT '{}',
    FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
);

-- 8. Bảng RESPONSES: Lượt nộp bài (Ai đánh giá ai)
CREATE TABLE IF NOT EXISTS responses (
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

-- 9. Bảng ANSWERS: Chi tiết câu trả lời
CREATE TABLE IF NOT EXISTS answers (
    id SERIAL PRIMARY KEY,
    response_id INT NOT NULL,
    question_id INT NOT NULL,
    answer_value JSONB NOT NULL,
    FOREIGN KEY (response_id) REFERENCES responses(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- ============================================================
-- DỮ LIỆU MẪU (SEED DATA)
-- Mật khẩu cho tất cả tài khoản bên dưới: MatKhau123
-- (password_hash được băm bằng bcrypt cost=10, đã xác minh hoạt động)
-- ============================================================

INSERT INTO roles (role_name) VALUES
    ('Admin'),
    ('Sinh viên'),
    ('Giảng viên'),
    ('Nhân sự'),
    ('Trưởng khoa')
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO users (role_id, full_name, email, password_hash, department) VALUES
    (1, 'Quản trị viên',       'admin@evalflow.edu',  '$2b$10$o473wGYc.FP.G41ueQC9S.5EuIK5IMDNgUbE6W1Ym0mViv7cvBpjK', 'Phòng CNTT'),
    (2, 'Nguyễn Văn Sinh',     'sinh1@evalflow.edu',  '$2b$10$o473wGYc.FP.G41ueQC9S.5EuIK5IMDNgUbE6W1Ym0mViv7cvBpjK', 'Công nghệ thông tin K17'),
    (2, 'Lê Thị Mỹ Linh',      'sinh2@evalflow.edu',  '$2b$10$o473wGYc.FP.G41ueQC9S.5EuIK5IMDNgUbE6W1Ym0mViv7cvBpjK', 'Công nghệ thông tin K17'),
    (2, 'Phạm Văn Đạt',        'sinh3@evalflow.edu',  '$2b$10$o473wGYc.FP.G41ueQC9S.5EuIK5IMDNgUbE6W1Ym0mViv7cvBpjK', 'Kinh tế K17'),
    (2, 'Ngô Thị Kim Ngân',    'sinh4@evalflow.edu',  '$2b$10$o473wGYc.FP.G41ueQC9S.5EuIK5IMDNgUbE6W1Ym0mViv7cvBpjK', 'Kinh tế K17'),
    (3, 'Trần Thị Giảng',      'giang1@evalflow.edu', '$2b$10$o473wGYc.FP.G41ueQC9S.5EuIK5IMDNgUbE6W1Ym0mViv7cvBpjK', 'Khoa CNTT'),
    (3, 'Nguyễn Hoàng Nam',    'giang2@evalflow.edu', '$2b$10$o473wGYc.FP.G41ueQC9S.5EuIK5IMDNgUbE6W1Ym0mViv7cvBpjK', 'Khoa CNTT'),
    (3, 'Phan Thị Thu Hà',     'giang3@evalflow.edu', '$2b$10$o473wGYc.FP.G41ueQC9S.5EuIK5IMDNgUbE6W1Ym0mViv7cvBpjK', 'Khoa Kinh tế'),
    (4, 'Lê Quang Nhân',       'nhansu1@evalflow.edu','$2b$10$o473wGYc.FP.G41ueQC9S.5EuIK5IMDNgUbE6W1Ym0mViv7cvBpjK', 'Phòng Nhân sự'),
    (5, 'Đỗ Minh Khoa',        'truongkhoa1@evalflow.edu','$2b$10$o473wGYc.FP.G41ueQC9S.5EuIK5IMDNgUbE6W1Ym0mViv7cvBpjK', 'Trưởng Khoa CNTT')
ON CONFLICT (email) DO NOTHING;
