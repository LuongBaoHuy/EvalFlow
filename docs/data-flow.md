# Kỹ thuật Luồng Dữ liệu: Lưu Form Khảo sát (Database Transaction & Optimistic Locking)

Tài liệu này mô tả chi tiết luồng xử lý dữ liệu của chức năng **Lưu / Cập nhật Form Khảo sát** trong hệ thống **EvalFlow**, áp dụng cơ chế bảo vệ tính toàn vẹn **PostgreSQL Database Transactions** (`BEGIN ... COMMIT ... ROLLBACK`) và quản lý đồng thời **Optimistic Locking** (`version INT`).

---

## 1. Biểu đồ Tuần tự (Mermaid Sequence Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor AdminA as Admin A (Frontend UI)
    actor AdminB as Admin B (Song song)
    participant API as Express API Server
    participant Service as Surveys/Campaigns Service
    participant DB as PostgreSQL Database
    participant Modal as Conflict Warning Modal (409)

    Note over AdminA, DB: Bước 1: Admin A tải dữ liệu Form hiện tại (Giữ version = 2)
    AdminA->>API: GET /api/surveys/1
    API->>DB: SELECT id, title, description, version FROM surveys WHERE id = 1
    DB-->>API: Trả về record { id: 1, title: 'Mẫu A', version: 2 }
    API-->>AdminA: HTTP 200 OK (Data + version: 2)

    Note over AdminB, DB: Xung đột: Admin B lưu trước làm version tăng lên 3
    AdminB->>API: PUT /api/surveys/1 { title: 'Mẫu A - Sửa bởi Admin B', version: 2 }
    API->>DB: UPDATE surveys SET version = version + 1 WHERE id = 1 AND version = 2
    DB-->>API: Affected rows = 1 (Thành công, version mới = 3)

    Note over AdminA, DB: Bước 2: Admin A hoàn tất chỉnh sửa và bấm "Lưu Form Khảo sát"
    AdminA->>API: PUT /api/surveys/1 { title: 'Mẫu A - Sửa bởi Admin A', version: 2 }
    API->>Service: updateSurvey(id=1, payload, reqVersion=2)
    
    Note over Service, DB: Bước 3: Khởi tạo Database Transaction
    Service->>DB: pool.connect() -> client.query('BEGIN')
    DB-->>Service: Transaction STARTED

    Note over Service, DB: Bước 4: Thực thi Optimistic Locking Update Query
    Service->>DB: UPDATE surveys SET title = $1, version = version + 1 WHERE id = 1 AND version = 2
    
    alt Trường hợp 1: Thành công (rowCount === 1)
        DB-->>Service: rowCount = 1 (Version trùng khớp)
        Service->>DB: client.query('COMMIT')
        DB-->>Service: Transaction COMMITTED
        Service->>DB: client.release()
        Service-->>API: Trả về Survey mới (version = 3)
        API-->>AdminA: HTTP 200 OK { success: true, data: { version: 3 } }
        AdminA->>AdminA: Tắt modal / Chuyển hướng trang thành công
    else Trường hợp 2: Xung đột dữ liệu (rowCount === 0) - Admin B đã lưu trước
        DB-->>Service: rowCount = 0 (Không tìm thấy record khớp version = 2)
        Service->>DB: client.query('ROLLBACK')
        DB-->>Service: Transaction ROLLED BACK
        Service->>DB: client.release()
        Service-->>API: Throw ConflictError (StatusCode = 409)
        API-->>AdminA: HTTP 409 Conflict { message: 'Dữ liệu đã bị thay đổi bởi Quản trị viên khác...' }
        AdminA->>Modal: Mở ConflictWarningModal (Màu Đỏ/Cam ⚠️)
        Modal-->>AdminA: Hiển thị tùy chọn "Sao chép nội dung vừa gõ" & "Tải lại trang (F5)"
        Note over AdminA, Modal: Dữ liệu đang gõ của Admin A được bảo vệ 100%, KHÔNG bị đóng hay xóa!
    end
```

---

## 2. Giải thích Chi tiết Luồng Xử lý

### A. Giai đoạn 1: Đọc & Khởi tạo State
1. Khi Admin A mở trang chỉnh sửa Form Khảo sát, Frontend gửi request `GET /api/surveys/:id`.
2. Backend trả về Object dữ liệu kèm thuộc tính `version` (Ví dụ: `version = 2`).
3. Frontend lưu trữ giá trị `version` này vào state ẩn trong ứng dụng.

### B. Giai đoạn 2: Khởi tạo Transaction trên Backend
1. Admin A chỉnh sửa tiêu đề/câu hỏi và bấm **Lưu**.
2. Frontend gửi request `PUT /api/surveys/:id` kèm theo body chứa `version: 2`.
3. Backend lấy một Client connection từ Postgres Pool và gọi lệnh `BEGIN` để mở một Transaction nguyên tố.

### C. Giai đoạn 3: Kiểm tra Optimistic Locking
Backend thực thi câu lệnh SQL với điều kiện ràng buộc `version`:
```sql
UPDATE surveys
SET title = $1,
    description = $2,
    theme_config = $3::jsonb,
    version = version + 1
WHERE id = $4 AND version = $5
RETURNING id, version;
```

- **Kịch bản A (rowCount = 1)**: Số bản ghi bị ảnh hưởng là 1. Dữ liệu chưa bị ai sửa đổi. Backend gọi `COMMIT`, giải phóng Client và trả về `HTTP 200 OK`.
- **Kịch bản B (rowCount = 0)**: Bản ghi đã bị Admin B lưu trước đó khiến `version` trong CSDL tăng lên `3`. Điều kiện `WHERE version = 2` bị thất bại. Backend lập tức:
  1. Gọi `ROLLBACK` để hủy bỏ mọi thay đổi pending.
  2. Giải phóng kết nối `client.release()`.
  3. Throw `ConflictError` và gửi về Client response `HTTP 409 Conflict`.

### D. Giai đoạn 4: Xử lý Trải nghiệm Người dùng trên Frontend (UX)
1. Frontend nhận mã lỗi `HTTP 409 Conflict`.
2. Bật Component `<ConflictWarningModal />` giao diện màu Đỏ/Cam.
3. **Giữ nguyên toàn bộ nội dung Admin A vừa gõ trong Form**, cho phép bấm nút **Sao chép nội dung** hoặc **F5 Tải lại trang** để nhận bản cập nhật mới nhất mà không sợ bị mất trắng công sức.
