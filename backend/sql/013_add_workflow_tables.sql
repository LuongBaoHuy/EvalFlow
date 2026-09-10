-- ============================================================
-- EvalFlow - Migration 013: Multi-level Approval Workflow
-- Cách chạy: psql -U postgres -d evalflow -f 013_add_workflow_tables.sql
-- ============================================================

-- 1. Thêm cột is_workflow_enabled vào bảng survey_campaigns
ALTER TABLE survey_campaigns
ADD COLUMN IF NOT EXISTS is_workflow_enabled BOOLEAN DEFAULT FALSE;

-- 2. Bảng campaign_workflows: Cấu hình các bước duyệt cho từng chiến dịch
CREATE TABLE IF NOT EXISTS campaign_workflows (
  id           SERIAL PRIMARY KEY,
  campaign_id  INT NOT NULL REFERENCES survey_campaigns(id) ON DELETE CASCADE,
  step_order   INT NOT NULL,            -- Thứ tự bước: 1 = người nộp, 2,3... = reviewer
  step_name    VARCHAR(255) NOT NULL,   -- VD: "Sinh viên tự chấm", "Giảng viên duyệt"
  reviewer_role VARCHAR(100) NOT NULL,  -- role_name từ bảng roles
  can_edit_answers BOOLEAN DEFAULT TRUE,-- Được phép sửa điểm của cấp dưới không?
  UNIQUE(campaign_id, step_order)
);

-- 3. Bảng response_reviews: Lịch sử chấm điểm theo từng cấp
CREATE TABLE IF NOT EXISTS response_reviews (
  id            SERIAL PRIMARY KEY,
  response_id   INT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  step_order    INT NOT NULL,
  reviewer_id   INT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_data JSONB NOT NULL DEFAULT '[]', -- Mảng answers đã chốt tại bước này
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED
  note          TEXT,                         -- Ghi chú của reviewer
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Indexes để tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_campaign_workflows_campaign_id
  ON campaign_workflows(campaign_id);

CREATE INDEX IF NOT EXISTS idx_response_reviews_response_id
  ON response_reviews(response_id);

CREATE INDEX IF NOT EXISTS idx_response_reviews_step_order
  ON response_reviews(response_id, step_order);

CREATE INDEX IF NOT EXISTS idx_response_reviews_status
  ON response_reviews(status);
