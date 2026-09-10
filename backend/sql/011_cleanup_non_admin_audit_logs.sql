-- Migration 011: Delete audit logs created by non-admin users or unauthenticated guests
DELETE FROM audit_logs
WHERE user_id IS NULL
   OR user_id NOT IN (
     SELECT u.id
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE LOWER(r.role_name) IN ('admin', 'quản trị viên', 'quản trị viên hệ thống')
   );
