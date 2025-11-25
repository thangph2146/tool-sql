This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Cấu hình Database

### Kết nối SQL Server

Dự án này đã được cấu hình để kết nối đến SQL Server Express tại `DESKTOP-F3UFVI3\SQLEXPRESS`.

#### Bước 1: Tạo file `.env`

Tạo file `.env` trong thư mục gốc với nội dung sau:

```env
# Windows Authentication (khuyến nghị cho local development)
DB_SERVER=DESKTOP-F3UFVI3\SQLEXPRESS
DB_DATABASE=master
DB_USE_WINDOWS_AUTH=true

# Tùy chọn cấu hình nâng cao (không bắt buộc)
# Lưu ý: Với SQL Express có instance name (SQLEXPRESS), không cần chỉ định port
# Port chỉ dùng khi kết nối đến default instance (không có instance name)
# DB_PORT=1433
# DB_INSTANCE_NAME=SQLEXPRESS
# DB_CONNECTION_TIMEOUT=30000
# DB_REQUEST_TIMEOUT=30000

# Tự động test kết nối định kỳ (giây)
# Mặc định: 60 giây. Set 0 để tắt auto test
# DB_AUTO_TEST_INTERVAL=60

# Hoặc SQL Server Authentication
# DB_SERVER=DESKTOP-F3UFVI3\SQLEXPRESS
# DB_DATABASE=master
# DB_USER=sa
# DB_PASSWORD=your_password
# DB_USE_WINDOWS_AUTH=false
```

**Lưu ý quan trọng:**
- Với SQL Server Express (có instance name như `\SQLEXPRESS`), không cần chỉ định port
- SQL Express tự động sử dụng dynamic port và SQL Browser service sẽ quản lý
- Chỉ dùng `DB_PORT` khi kết nối đến default instance (server name không có `\`)

**Về Windows Authentication:**
- Windows Authentication sử dụng tài khoản Windows hiện tại để xác thực
- Không cần cung cấp username/password trong file `.env`
- Đảm bảo tài khoản Windows của bạn có quyền truy cập SQL Server
- Kiểm tra quyền: Mở SQL Server Management Studio và thử kết nối bằng Windows Authentication
- Nếu SSMS kết nối được, ứng dụng cũng sẽ kết nối được

#### Bước 2: Sử dụng kết nối database

Import và sử dụng các hàm từ `lib/db.ts`:

```typescript
import { query, testConnection } from '@/lib/db';

// Test kết nối
const isConnected = await testConnection();

// Thực thi query
const result = await query('SELECT * FROM YourTable');
```

#### Bước 3: Kiểm tra kết nối SQL Server

Nếu gặp lỗi timeout, chạy script PowerShell để kiểm tra:

```powershell
# Chạy với quyền Administrator
.\scripts\check-sql-connection.ps1
```

Script sẽ kiểm tra:
- SQL Server service có đang chạy
- SQL Server Browser service (quan trọng cho named instance)
- TCP/IP Protocol
- Windows Firewall rules
- Kết nối mạng

#### Bước 4: Test kết nối từ ứng dụng

Chạy development server và truy cập:
- Web UI: `http://localhost:3000` - Xem trạng thái kết nối trực quan
- API endpoint: `http://localhost:3000/api/db/test` - Test kết nối qua API

**Tự động test kết nối:**
- Ứng dụng tự động test kết nối khi server khởi động
- Test định kỳ mỗi 60 giây (có thể cấu hình qua `DB_AUTO_TEST_INTERVAL`)
- UI component tự động test mỗi 30 giây để cập nhật trạng thái real-time
- Tất cả kết quả test được log vào console với logger

## Troubleshooting

### Lỗi Timeout (ETIMEOUT)

**Nguyên nhân phổ biến:**

1. **SQL Server Browser không chạy** (quan trọng nhất với named instance):
   ```powershell
   # Kiểm tra
   Get-Service SQLBrowser
   
   # Khởi động
   Start-Service SQLBrowser
   ```

2. **SQL Server service không chạy**:
   ```powershell
   # Kiểm tra
   Get-Service | Where-Object {$_.Name -like "*SQL*"}
   
   # Khởi động
   Start-Service "MSSQL$SQLEXPRESS"
   ```

3. **TCP/IP Protocol chưa được enable**:
   - Mở SQL Server Configuration Manager
   - SQL Server Network Configuration > Protocols for SQLEXPRESS
   - Right-click TCP/IP > Enable
   - Restart SQL Server service

4. **Firewall chặn kết nối**:
   - Kiểm tra Windows Firewall
   - Cho phép SQL Server và SQL Browser qua firewall

5. **SQL Server Authentication Mode**:
   - Nếu dùng SQL Server Authentication, đảm bảo đã enable "SQL Server and Windows Authentication mode"
   - Mở SSMS > Server Properties > Security

### Kiểm tra nhanh

```powershell
# 1. Kiểm tra services
Get-Service | Where-Object {$_.Name -like "*SQL*"}

# 2. Khởi động SQL Browser (nếu chưa chạy)
Start-Service SQLBrowser

# 3. Test kết nối từ SSMS
# Server: DESKTOP-F3UFVI3\SQLEXPRESS
# Authentication: Windows Authentication hoặc SQL Server Authentication
```

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
