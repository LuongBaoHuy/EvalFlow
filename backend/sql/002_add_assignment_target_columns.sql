-- ============================================================
-- Migration 002:
--   1. Bổ sung cột description và is_anonymous vào survey_campaigns
--   2. Thêm cột target_user_id và context_reference vào survey_assignments
--      để hỗ trợ luồng "Đánh giá Giảng viên" theo phân công chi tiết từ file Excel
-- ============================================================

-- === Bảng SURVEY_CAMPAIGNS ===
-- Thêm cột description (Text)
ALTER TABLE survey_campaigns
ADD COLUMN IF NOT EXISTS description TEXT;

-- Thêm cột is_anonymous
ALTER TABLE survey_campaigns
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;

-- Thêm cột target_user_id (nullable, FK -> users.id)
ALTER TABLE survey_assignments
ADD COLUMN IF NOT EXISTS target_user_id INT;

-- Thêm Foreign Key constraint cho target_user_id
ALTER TABLE survey_assignments
DROP CONSTRAINT IF EXISTS survey_assignments_target_user_id_fkey;

ALTER TABLE survey_assignments
ADD CONSTRAINT survey_assignments_target_user_id_fkey
FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Thêm cột context_reference (nullable, VARCHAR 255)
ALTER TABLE survey_assignments
ADD COLUMN IF NOT EXISTS context_reference VARCHAR(255);

-- Tạo index để tối ưu truy vấn theo target_user_id
CREATE INDEX IF NOT EXISTS idx_survey_assignments_target_user_id
ON survey_assignments (target_user_id);

-- Tạo index để tối ưu truy vấn theo context_reference
CREATE INDEX IF NOT EXISTS idx_survey_assignments_context_reference
ON survey_assignments (context_reference);

-- ============================================================
-- Mô tả:
-- target_user_id: ID của Giảng viên (hoặc người bị đánh giá)
-- context_reference: Tên Môn học (hoặc ngữ cảnh đánh giá)
-- Một Sinh viên (user_id) có thể có nhiều assignment trong cùng
-- 1 chiến dịch (mỗi assignment = đánh giá 1 môn của 1 GV)
-- ============================================================
