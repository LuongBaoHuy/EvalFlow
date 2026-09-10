-- ============================================================
-- EVALFLOW — RESET PASSWORD TO 123123
-- bcrypt hash đã được verify: bcrypt.compare("123123", hash) === PASSED
-- Cách dùng:
--  1. Mở DBeaver → kết nối EvalFlow → mở SQL Editor
--  2. Dán toàn bộ file này vào → bấm F5 (hoặc Execute SQL)
--  3. Sau khi chạy xong → đăng nhập bằng:
--        Email: admin@truong.edu.vn
--        MK   : 123123
-- ============================================================

-- [1] ĐỔI TẤT CẢ 5 TÀI KHOẢN TRONG BẢNG users THÀNH MẬT KHẨU "123123"
UPDATE users SET password_hash = '$2b$10$x8RAB/eR9t7iEQ21rG9kDeU4xFpseZJAUoNTixg/p5vBUuztQjhDu'
WHERE email IN (
    'admin@truong.edu.vn',
    'nguyenvana@truong.edu.vn',
    'tranthib@truong.edu.vn',
    'lehoangc@sv.truong.edu.vn',
    'phamd@sv.truong.edu.vn'
);

-- [2] (HOẶC) NẾU MUỐN ĐỔI RIÊNG ADMIN THÌ CHẠY RIÊNG CÂU NÀY:
-- UPDATE users SET password_hash = '$2b$10$x8RAB/eR9t7iEQ21rG9kDeU4xFpseZJAUoNTixg/p5vBUuztQjhDu'
-- WHERE email = 'admin@truong.edu.vn';

-- [3] KIỂM TRA SAU KHI CHẠY — xem password_hash đã được update chưa:
SELECT id, email, full_name, role_id, password_hash
FROM users ORDER BY id;
