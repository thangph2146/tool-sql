# Database Configuration System

Hệ thống quản lý cấu hình cho 2 database: **database_1** và **database_2**.

## Tổng quan

- **database_1** và **database_2** là các key hệ thống để quản lý cấu hình
- Tên database thực tế trong SQL Server có thể được cấu hình riêng:
  - `database_1` mặc định kết nối đến database **PSC_HRM**
  - `database_2` mặc định kết nối đến database **HRM_HUB**
- Bạn có thể thay đổi tên database thực tế bằng cách cấu hình `DATABASE_1_NAME` và `DATABASE_2_NAME` trong file `.env`
- Hệ thống sử dụng **TanStack Query** để quản lý data fetching và caching
- Components được tách nhỏ và tối ưu với **useMemo** để cải thiện UX/UI

## Cấu hình trong file `.env`

### ⚠️ Cấu hình bắt buộc cũ (Backward Compatibility)

Hệ thống vẫn hỗ trợ cấu hình cũ để đảm bảo tương thích ngược. Các biến sau đây là **bắt buộc cũ** và vẫn được sử dụng làm giá trị mặc định:

```env
# Cấu hình bắt buộc cũ (lines 1-7)
DB_SERVER=DESKTOP-F3UFVI3\SQLEXPRESS
DB_DATABASE=master
DB_USE_WINDOWS_AUTH=true
DB_USER=nextjs_user          # Nếu dùng SQL Auth
DB_PASSWORD=NextJS@123        # Nếu dùng SQL Auth
DB_PORT=1433                  # Tùy chọn
DB_INSTANCE_NAME=SQLEXPRESS   # Tùy chọn
```

**Lưu ý:**
- `DB_DATABASE` sẽ được sử dụng làm fallback cho `database_1` nếu `DATABASE_1_NAME` không được cấu hình
- Các biến này vẫn hoạt động và được ưu tiên làm giá trị mặc định cho cả 2 database

### Cấu hình mặc định (áp dụng cho cả 2 database nếu không có cấu hình riêng)

```env
# Server mặc định (từ cấu hình cũ)
DB_SERVER=DESKTOP-F3UFVI3\SQLEXPRESS
DB_PORT=1433
DB_INSTANCE_NAME=SQLEXPRESS

# Database mặc định (từ cấu hình cũ - dùng cho database_1 nếu không có DATABASE_1_NAME)
DB_DATABASE=master

# Authentication mặc định (từ cấu hình cũ)
DB_USE_WINDOWS_AUTH=true
# Hoặc SQL Server Authentication
# DB_USER=nextjs_user
# DB_PASSWORD=NextJS@123

# Timeout mặc định
DB_CONNECTION_TIMEOUT=30000
DB_REQUEST_TIMEOUT=30000
```

### Cấu hình riêng cho database_1

```env
# Server riêng cho database_1 (nếu khác server mặc định)
DATABASE_1_SERVER=DESKTOP-F3UFVI3
DATABASE_1_PORT=1433
DATABASE_1_INSTANCE_NAME=SQLEXPRESS

# Tên database thực tế (mặc định: PSC_HRM)
# database_1 là key hệ thống, tên database thực tế có thể cấu hình
DATABASE_1_NAME=PSC_HRM

# Authentication riêng cho database_1
DATABASE_1_USE_WINDOWS_AUTH=true
# Hoặc
# DATABASE_1_USER=db1_user
# DATABASE_1_PASSWORD=db1_password

# Timeout riêng cho database_1
DATABASE_1_CONNECTION_TIMEOUT=30000
DATABASE_1_REQUEST_TIMEOUT=30000

# Enable/Disable database_1
DATABASE_1_ENABLED=true
```

### Cấu hình riêng cho database_2

```env
# Server riêng cho database_2 (nếu khác server mặc định)
DATABASE_2_SERVER=DESKTOP-F3UFVI3
DATABASE_2_PORT=1433
DATABASE_2_INSTANCE_NAME=SQLEXPRESS

# Tên database thực tế (mặc định: HRM_HUB)
# database_2 là key hệ thống, tên database thực tế có thể cấu hình
DATABASE_2_NAME=HRM_HUB

# Authentication riêng cho database_2
DATABASE_2_USE_WINDOWS_AUTH=true
# Hoặc
# DATABASE_2_USER=db2_user
# DATABASE_2_PASSWORD=db2_password

# Timeout riêng cho database_2
DATABASE_2_CONNECTION_TIMEOUT=30000
DATABASE_2_REQUEST_TIMEOUT=30000

# Enable/Disable database_2
DATABASE_2_ENABLED=true
```

## Ví dụ cấu hình

### Ví dụ 1: Cả 2 database cùng server, cùng authentication

```env
DB_SERVER=DESKTOP-F3UFVI3
DB_PORT=1433
DB_USE_WINDOWS_AUTH=true

# Chỉ cần đặt tên database thực tế
DATABASE_1_NAME=PSC_HRM
DATABASE_2_NAME=HRM_HUB
```

### Ví dụ 2: Cả 2 database cùng server, khác authentication

```env
DB_SERVER=DESKTOP-F3UFVI3
DB_PORT=1433

# database_1 dùng Windows Auth
DATABASE_1_NAME=PSC_HRM
DATABASE_1_USE_WINDOWS_AUTH=true

# database_2 dùng SQL Auth
DATABASE_2_NAME=HRM_HUB
DATABASE_2_USE_WINDOWS_AUTH=false
DATABASE_2_USER=hrm_user
DATABASE_2_PASSWORD=hrm_password
```

### Ví dụ 3: 2 database khác server

```env
# database_1 server
DATABASE_1_SERVER=server1.example.com
DATABASE_1_PORT=1433
DATABASE_1_NAME=PSC_HRM
DATABASE_1_USE_WINDOWS_AUTH=true

# database_2 server
DATABASE_2_SERVER=server2.example.com
DATABASE_2_PORT=1433
DATABASE_2_NAME=HRM_HUB
DATABASE_2_USE_WINDOWS_AUTH=true
```

## Lợi ích của hệ thống config

1. **Dễ mở rộng**: Chỉ cần thêm database mới vào config system
2. **Linh hoạt**: Mỗi database có thể có cấu hình riêng hoặc dùng chung
3. **Tự động**: Hệ thống tự động load từ .env
4. **Validation**: Tự động validate cấu hình khi khởi động
5. **Enable/Disable**: Có thể tắt một database mà không cần xóa config

## API Endpoints

### Lấy cấu hình tất cả databases

```bash
GET /api/db/config
```

### Lấy cấu hình một database

```bash
GET /api/db/config?database=database_1
GET /api/db/config?database=database_2
```

## Sử dụng trong code

```typescript
import {
  getDatabaseConfig,
  getDatabaseConfigSystem,
  getEnabledDatabases,
} from '@/lib/db-config';

// Lấy config một database
const db1Config = getDatabaseConfig('database_1');
console.log(db1Config.database); // PSC_HRM (từ DATABASE_1_NAME)

// Lấy tất cả databases đã enable
const enabled = getEnabledDatabases();
```

## Lưu ý

- **DATABASE_1_NAME** và **DATABASE_2_NAME** là tên database thực tế trong SQL Server
- **database_1** và **database_2** là tên định danh trong hệ thống
- Có thể đổi tên database thực tế bằng cách thay đổi `DATABASE_1_NAME` và `DATABASE_2_NAME`
- Hệ thống tự động map giữa tên định danh và tên database thực tế

