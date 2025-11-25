# Cấu hình Windows Authentication cho SQL Server

## Server: `DESKTOP-F3UFVI3\SQLEXPRESS`

## File `.env` cần có:

```env
# Windows Authentication
DB_SERVER=DESKTOP-F3UFVI3\SQLEXPRESS
DB_DATABASE=master
DB_USE_WINDOWS_AUTH=true

# QUAN TRỌNG: Không được có DB_USER và DB_PASSWORD trong file .env
# Nếu có DB_USER=sa hoặc DB_PASSWORD=..., hệ thống sẽ dùng SQL Server Authentication
# XÓA hoặc COMMENT các dòng DB_USER và DB_PASSWORD để dùng Windows Authentication
```

## Kiểm tra cấu hình:

1. **Đảm bảo file `.env` tồn tại** trong thư mục gốc của project
2. **Kiểm tra giá trị**:
   - `DB_SERVER=DESKTOP-F3UFVI3\SQLEXPRESS` (có dấu `\` trước SQLEXPRESS)
   - `DB_USE_WINDOWS_AUTH=true` hoặc không có `DB_USER`
3. **QUAN TRỌNG**: **XÓA hoặc COMMENT** các dòng `DB_USER` và `DB_PASSWORD` trong file `.env`
   - Nếu có `DB_USER=sa` → Hệ thống sẽ dùng SQL Server Authentication
   - Để dùng Windows Authentication, phải XÓA hoặc COMMENT dòng `DB_USER`

## ⚠️ Vấn đề thường gặp:

**Nếu log hiển thị:**
```
🔍 DEBUG [DB_CONFIG] Sử dụng SQL Server Authentication
Data: { user: 'sa' }
```

**→ Có `DB_USER` trong file `.env`. Cần XÓA hoặc COMMENT dòng đó.**

**Sau khi sửa, restart server:**
```bash
# Dừng server (Ctrl+C) và chạy lại
pnpm dev
```

## Kiểm tra quyền truy cập:

1. Mở **SQL Server Management Studio (SSMS)**
2. Kết nối với:
   - **Server name**: `DESKTOP-F3UFVI3\SQLEXPRESS`
   - **Authentication**: Windows Authentication
3. Nếu SSMS kết nối được → Ứng dụng cũng sẽ kết nối được

## Khắc phục lỗi timeout:

### Bước 1: Kiểm tra services

Chạy script PowerShell:

```powershell
.\scripts\check-sql-connection.ps1
```

### Bước 2: Khởi động SQL Server Browser (QUAN TRỌNG)

```powershell
# Với quyền Administrator
.\scripts\fix-sql-browser.ps1
```

### Bước 3: Enable TCP/IP và set port (KHÔNG CẦN SQL Server Configuration Manager)

Chạy script PowerShell với quyền Administrator:

```powershell
.\scripts\enable-tcpip-registry.ps1
```

Script này sẽ:
- Enable TCP/IP protocol
- Set static port = 1433 (hoặc port bạn chỉ định)
- Restart SQL Server và SQL Browser services

**Sau khi chạy script, thêm vào file `.env`:**
```env
DB_SERVER=DESKTOP-F3UFVI3
DB_PORT=1433
DB_INSTANCE_NAME=SQLEXPRESS
DB_DATABASE=master
DB_USE_WINDOWS_AUTH=true
```

### Hoặc kiểm tra thủ công:

1. **SQL Server Browser service**:
   ```powershell
   Start-Service SQLBrowser
   ```

2. **SQL Server service**:
   ```powershell
   Get-Service | Where-Object {$_.Name -like "*SQL*"}
   ```

## Log sẽ hiển thị:

Khi cấu hình đúng, log sẽ hiển thị:
```
🔍 DEBUG [DB_CONFIG] Sử dụng Windows Authentication
Data: { currentUser: 'YourWindowsUsername' }
```

Nếu thấy "SQL Server Authentication" → Kiểm tra lại file `.env`, đảm bảo không có `DB_USER`.

