# Setup Guide - Architecture mới

## ✅ Đã hoàn thành

### 1. **Cấu trúc Constants tổng hợp** (`lib/constants/`)
- ✅ `index.ts` - Export tập trung tất cả constants
- ✅ `api-constants.ts` - API endpoints, timeouts, HTTP status codes
- ✅ `db-constants.ts` - Database constants
- ✅ `flow-constants.ts` - Flow logging constants
- ✅ `query-constants.ts` - Query configuration (stale time, cache time, retry)
- ✅ `table-constants.ts` - Table constants

**Cách sử dụng:**
```typescript
import {
  API_ENDPOINTS,
  API_STALE_TIME,
  DEFAULT_TABLE_LIMIT,
  QUERY_STALE_TIME,
  QUERY_CACHE_TIME,
} from '@/lib/constants';
```

### 2. **API Layer với Axios** (`lib/api/`)
- ✅ `client.ts` - Axios instance với interceptors và error handling
- ✅ `query-keys.ts` - Query keys factory cho TanStack Query
- ✅ `services/database.service.ts` - Database API service với type safety
- ✅ `utils.ts` - API utilities (build query string, create API URL)
- ✅ `index.ts` - Centralized exports

**Cách sử dụng:**
```typescript
import { databaseService } from '@/lib/api/services';
import { databaseKeys } from '@/lib/api/query-keys';
import { buildQueryString } from '@/lib/api/utils';
```

### 3. **Zustand Stores** (`lib/stores/`)
- ✅ `use-database-store.ts` - Database state (selected, comparison tables)
- ✅ `use-ui-store.ts` - UI state (dialogs, loading)
- ✅ `use-table-store.ts` - Table state (filters, pagination)
- ✅ `index.ts` - Centralized exports

**Cách sử dụng:**
```typescript
import { useDatabaseStore, useUIStore, useTableStore } from '@/lib/stores';
```

### 4. **TanStack Query Hooks** (`lib/hooks/queries/`)
- ✅ `use-database-queries.ts` - Custom hooks:
  - `useDatabaseConnection` - Test connection
  - `useTables` - Get tables list
  - `useTableData` - Get table data
  - `useTableRelationships` - Get relationships
  - `useTableStats` - Get table stats
  - `useTestConnection` - Mutation
  - `useFetchTables` - Mutation
- ✅ Tích hợp với query keys factory
- ✅ Proper error handling và caching
- ✅ Automatic user config injection

**Cách sử dụng:**
```typescript
// New hooks (recommended)
import { useTables, useTableData } from '@/lib/hooks/queries';

// Legacy hooks (import directly if needed)
import { useDatabaseConnection } from '@/lib/hooks/use-database-query';
```

**Lưu ý:** Legacy hooks không được export từ `@/lib/hooks` để tránh conflicts. Import trực tiếp nếu cần.

### 5. **Utilities** (`lib/utils/`)
- ✅ `query-helpers.ts` - Query utilities (invalidate, prefetch)

**Cách sử dụng:**
```typescript
import { invalidateTableQueries, prefetchTableData } from '@/lib/utils/query-helpers';
```

## 📦 Cài đặt

### Bước 1: Cài đặt Zustand

```bash
npm install zustand
```

Hoặc thêm vào `package.json`:
```json
{
  "dependencies": {
    "zustand": "^5.0.9"
  }
}
```

Sau đó chạy:
```bash
npm install
```

### Bước 2: Verify Installation

Kiểm tra các dependencies đã được cài đặt:
- ✅ `zustand` - State management
- ✅ `@tanstack/react-query` - Server state management
- ✅ `axios` - HTTP client
- ✅ `next` - Framework

## 📁 Cấu trúc hoàn chỉnh

```
lib/
├── api/                          # API Layer
│   ├── client.ts                 # Axios instance với interceptors
│   ├── query-keys.ts             # Query keys factory
│   ├── services/                 # API services
│   │   ├── database.service.ts   # Database API service
│   │   └── index.ts
│   ├── utils.ts                  # API utilities
│   └── index.ts                  # Centralized exports
│
├── constants/                    # Constants tổng hợp
│   ├── api-constants.ts          # API endpoints, timeouts
│   ├── db-constants.ts          # Database constants
│   ├── flow-constants.ts         # Flow logging constants
│   ├── query-constants.ts       # Query config constants
│   ├── table-constants.ts        # Table constants
│   └── index.ts                  # Centralized exports
│
├── stores/                       # Zustand Stores
│   ├── use-database-store.ts     # Database state
│   ├── use-ui-store.ts           # UI state
│   ├── use-table-store.ts        # Table state
│   └── index.ts                  # Centralized exports
│
├── hooks/                        # Custom Hooks
│   ├── queries/                  # TanStack Query hooks
│   │   ├── use-database-queries.ts
│   │   └── index.ts
│   └── index.ts                  # All hooks exports
│
└── utils/                        # Utilities
    └── query-helpers.ts          # Query utilities
```

## 🔄 Migration Steps

### Bước 1: Import từ cấu trúc mới

**Trước:**
```typescript
import axiosClient from '@/lib/axios-client';
import { DEFAULT_TABLE_LIMIT } from '@/lib/constants/table-constants';
```

**Sau:**
```typescript
import { databaseService } from '@/lib/api/services';
import { DEFAULT_TABLE_LIMIT } from '@/lib/constants';
```

### Bước 2: Thay thế axios calls

**Trước:**
```typescript
const response = await axiosClient.get('/api/db/tables?database=database_1');
```

**Sau:**
```typescript
const response = await databaseService.getTables('database_1', {
  page: 0,
  limit: 50,
  includeStats: true,
});
```

### Bước 3: Sử dụng Query Hooks

**Trước:**
```typescript
const { data } = useQuery({
  queryKey: ['tables', databaseName],
  queryFn: () => axiosClient.get('/api/db/tables').then(r => r.data),
});
```

**Sau:**
```typescript
import { useTables } from '@/lib/hooks/queries';

const { data, isLoading, error } = useTables(databaseName, {
  page: 0,
  limit: 50,
  includeStats: true,
});
```

### Bước 4: Sử dụng Zustand Stores

**Trước:**
```typescript
const [selectedDatabase, setSelectedDatabase] = useState(null);
const [comparisonTables, setComparisonTables] = useState({ left: null, right: null });
```

**Sau:**
```typescript
import { useDatabaseStore, useTableStore } from '@/lib/stores';

const { selectedDatabase, setSelectedDatabase, comparisonTables } = useDatabaseStore();
const { tableFilters, setTableFilters } = useTableStore();
```

### Bước 5: Sử dụng Query Keys Factory

**Trước:**
```typescript
queryClient.invalidateQueries({ queryKey: ['tables', 'database_1'] });
```

**Sau:**
```typescript
import { databaseKeys } from '@/lib/api/query-keys';
import { invalidateTableQueries } from '@/lib/utils/query-helpers';

// Option 1: Sử dụng helper
invalidateTableQueries(queryClient, 'database_1');

// Option 2: Sử dụng query keys factory
queryClient.invalidateQueries({
  queryKey: databaseKeys.tables.list('database_1'),
});
```

## 💡 Quick Start Examples

### Example 1: Component với Query Hook và Store

```typescript
'use client';

import { useTables } from '@/lib/hooks/queries';
import { useDatabaseStore } from '@/lib/stores';
import { DEFAULT_TABLE_LIST_LIMIT } from '@/lib/constants';
import type { DatabaseName } from '@/lib/db-config';

export function DatabaseCard({ databaseName }: { databaseName: DatabaseName }) {
  const { selectedDatabase, setSelectedDatabase } = useDatabaseStore();
  
  const { data: tables, isLoading } = useTables(databaseName, {
    page: 0,
    limit: DEFAULT_TABLE_LIST_LIMIT,
    includeStats: true,
  });
  
  return (
    <div>
      <h2>{databaseName}</h2>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <p>Tables: {tables?.data?.tables?.length || 0}</p>
      )}
      <button onClick={() => setSelectedDatabase(databaseName)}>
        Select
      </button>
    </div>
  );
}
```

### Example 2: Sử dụng Mutations

```typescript
'use client';

import { useTestConnection } from '@/lib/hooks/queries';
import { useUIStore } from '@/lib/stores';
import type { DatabaseName } from '@/lib/db-config';

export function TestConnectionButton({ databaseName }: { databaseName: DatabaseName }) {
  const { setLoading } = useUIStore();
  const testConnection = useTestConnection();
  
  const handleTest = async () => {
    setLoading(true, 'Testing connection...');
    try {
      await testConnection.mutateAsync({ databaseName });
    } catch (error) {
      console.error('Connection test failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <button onClick={handleTest} disabled={testConnection.isPending}>
      {testConnection.isPending ? 'Testing...' : 'Test Connection'}
    </button>
  );
}
```

## ✅ Lợi ích

1. **Code Clean**: Tách biệt concerns, dễ đọc và maintain
2. **Type Safety**: TypeScript types cho tất cả API calls
3. **Consistency**: Query keys và constants centralized
4. **Scalability**: Dễ dàng thêm services và stores mới
5. **Performance**: Proper caching với TanStack Query
6. **Developer Experience**: DevTools cho Zustand và React Query

## 🚀 Next Steps

1. ✅ Constants đã được tập trung
2. ✅ API services đã được tạo
3. ✅ Query hooks mới đã sẵn sàng
4. ✅ Zustand stores đã được setup
5. ✅ Query helpers đã được tạo
6. ✅ Build thành công, không có lỗi
7. ⏳ Migrate components dần dần từ legacy hooks sang new hooks
8. ⏳ Remove old hooks khi không còn sử dụng
9. ⏳ Thêm error boundaries và loading states

## ⚠️ Migration Notes

### Legacy Hooks
Các hooks cũ (`use-database-query.ts`) vẫn có thể sử dụng nhưng cần import trực tiếp:
```typescript
// ✅ OK - Import trực tiếp
import { useDatabaseConnection } from '@/lib/hooks/use-database-query';

// ❌ Không hoạt động - Không export từ index để tránh conflicts
import { useDatabaseConnection } from '@/lib/hooks';
```

### New Hooks (Recommended)
Sử dụng hooks mới từ `@/lib/hooks/queries`:
```typescript
// ✅ Recommended
import { useDatabaseConnection, useTables } from '@/lib/hooks/queries';
// hoặc
import { useDatabaseConnection, useTables } from '@/lib/hooks';
```

## 📚 Tài liệu tham khảo

- 📖 [ARCHITECTURE.md](./ARCHITECTURE.md) - Chi tiết về architecture và best practices
- 📖 [MIGRATION.md](./MIGRATION.md) - Hướng dẫn migration từ legacy hooks sang new hooks
- 💻 Xem code examples trong các components hiện có
- 💻 Xem `lib/hooks/queries/use-database-queries.ts` để hiểu cách tạo hooks mới

## ✅ Verification

Sau khi setup, verify bằng cách:

1. **Check build:**
```bash
npm run build
```

2. **Check lint:**
```bash
npm run lint
```

3. **Test imports:**
```typescript
// Constants
import { API_ENDPOINTS, DEFAULT_TABLE_LIMIT } from '@/lib/constants';

// API Services
import { databaseService } from '@/lib/api/services';

// Query Hooks
import { useTables } from '@/lib/hooks/queries';

// Stores
import { useDatabaseStore } from '@/lib/stores';
```

Tất cả imports phải hoạt động không có lỗi!
