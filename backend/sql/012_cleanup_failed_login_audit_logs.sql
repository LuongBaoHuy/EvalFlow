-- Migration 012: Delete all audit_logs records where action = 'LOGIN' and status is 'FAILED'
DELETE FROM audit_logs
WHERE action = 'LOGIN'
  AND (
    details->>'status' = 'FAILED'
    OR user_id IS NULL
  );
