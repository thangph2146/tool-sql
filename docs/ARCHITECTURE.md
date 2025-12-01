# Architecture Overview

## Cấu trúc hệ thống tối ưu với Zustand, TanStack Query, Next.js và Axios

### 🏗️ Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────┐
│                    Components Layer                      │
│  (React Components sử dụng hooks và stores)             │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Hooks Layer                           │
│  - Query Hooks (TanStack Query)                         │
│  - Custom Hooks (Business Logic)                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    State Management                      │
│  - Zustand Stores (Global State)                        │
│  - TanStack Query Cache (Server State)                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    API Layer                            │
│  - API Services (Business Logic)                        │
│  - Axios Client (HTTP Client)                           │
│  - Query Keys Factory (Cache Keys)                       │
│  - API Utilities (Helpers)                              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Constants Layer                      │
│  - API Constants (Endpoints, Config)                    │
│  - Query Constants (Cache, Retry)                       │
│  - Business Constants (DB, Table, Flow)                 │
└─────────────────────────────────────────────────────────┘
```

## 📁 Cấu trúc thư mục chi tiết

```
lib/
├── api/                          # API Layer
│   ├── client.ts                 # Axios instance với interceptors
│   ├── query-keys.ts             # Query keys factory
│   ├── services/                 # API services
│   │   ├── database.service.ts   # Database API service
│   │   └── index.ts
│   ├── utils.ts                  # API utilities (query string builder)
│   └── index.ts                  # Centralized exports
│
├── constants/                     # Constants tổng hợp
│   ├── api-constants.ts          # API endpoints, timeouts, HTTP status
│   ├── db-constants.ts           # Database constants
│   ├── flow-constants.ts          # Flow logging constants
│   ├── query-constants.ts        # Query config (stale time, cache, retry)
│   ├── table-constants.ts        # Table constants
│   └── index.ts                  # Centralized exports
│
├── stores/                       # Zustand Stores
│   ├── use-database-store.ts     # Database state (selected, comparison)
│   ├── use-ui-store.ts           # UI state (dialogs, loading)
│   ├── use-table-store.ts        # Table state (filters, pagination)
│   └── index.ts                  # Centralized exports
│
├── hooks/                        # Custom Hooks
│   ├── queries/                  # TanStack Query hooks
│   │   ├── use-database-queries.ts
│   │   └── index.ts
│   └── index.ts                  # All hooks exports
│
└── utils/                        # Utilities
    └── query-helpers.ts          # Query utilities (invalidate, prefetch)
```

## 🔑 Core Concepts

### 1. Constants (Single Source of Truth)

Tất cả constants được tập trung trong `lib/constants/`:

```typescript
import {
  // API Constants
  API_ENDPOINTS,
  API_STALE_TIME,
  API_TIMEOUT,
  HTTP_STATUS,
  
  // Query Constants
  QUERY_STALE_TIME,
  QUERY_CACHE_TIME,
  QUERY_RETRY,
  
  // Business Constants
  DEFAULT_TABLE_LIMIT,
  DEFAULT_TABLE_PAGE,
  TABLE_LIMIT_OPTIONS,
} from '@/lib/constants';
```

**Lợi ích:**
- ✅ Dễ maintain và update
- ✅ Tránh magic numbers
- ✅ Type-safe với TypeScript
- ✅ Consistent across codebase
- ✅ Single source of truth

### 2. API Services (Business Logic Layer)

API services đóng gói tất cả API calls:

```typescript
import { databaseService } from '@/lib/api/services';
import { API_ENDPOINTS, DEFAULT_TABLE_LIMIT } from '@/lib/constants';

// Thay vì:
const response = await axios.get('/api/db/tables?database=database_1&limit=50');

// Sử dụng:
const response = await databaseService.getTables('database_1', {
  page: 0,
  limit: DEFAULT_TABLE_LIMIT,
  includeStats: true,
});
```

**Lợi ích:**
- ✅ Type-safe API calls
- ✅ Centralized error handling
- ✅ Easy to mock for testing
- ✅ Consistent API interface
- ✅ Automatic user config injection

### 3. Query Keys Factory (Cache Management)

Query keys factory đảm bảo consistency:

```typescript
import { databaseKeys } from '@/lib/api/query-keys';

// Consistent query keys
const key = databaseKeys.tables.list('database_1');
// ['databases', 'tables', 'list', 'database_1']

// Hierarchical structure
databaseKeys.all                    // ['databases']
databaseKeys.tables.all()           // ['databases', 'tables']
databaseKeys.tables.list('db1')     // ['databases', 'tables', 'list', 'db1']
```

**Lợi ích:**
- ✅ Consistent cache keys
- ✅ Easy invalidation (hierarchical)
- ✅ Type-safe keys
- ✅ Hierarchical structure
- ✅ Prevents key collisions

### 4. TanStack Query Hooks (Server State)

Custom hooks cho server state:

```typescript
import { useTables, useTableData } from '@/lib/hooks/queries';
import { DEFAULT_TABLE_LIMIT } from '@/lib/constants';

function MyComponent() {
  const { data, isLoading, error } = useTables('database_1', {
    page: 0,
    limit: DEFAULT_TABLE_LIMIT,
    includeStats: true,
  });
  
  // Automatic:
  // - Caching
  // - Background refetching
  // - Error handling
  // - Loading states
  // - Retry logic
}
```

**Lợi ích:**
- ✅ Automatic caching
- ✅ Background refetching
- ✅ Error handling
- ✅ Loading states
- ✅ Optimistic updates
- ✅ Automatic user config handling

### 5. Zustand Stores (Client State)

Zustand stores cho global client state:

```typescript
import { useDatabaseStore, useTableStore, useUIStore } from '@/lib/stores';

function MyComponent() {
  // Database state
  const { selectedDatabase, setSelectedDatabase, comparisonTables } = useDatabaseStore();
  
  // Table state
  const { tableFilters, setTableFilters, tablePagination } = useTableStore();
  
  // UI state
  const { isLoading, setLoading, isConfigDialogOpen, setConfigDialogOpen } = useUIStore();
}
```

**Lợi ích:**
- ✅ Simple API
- ✅ No boilerplate
- ✅ DevTools support
- ✅ TypeScript support
- ✅ Small bundle size
- ✅ No Context Provider needed

## 🎯 Best Practices

### 1. Luôn sử dụng Constants

❌ **Bad:**
```typescript
const response = await axios.get('/api/db/tables?limit=50');
const staleTime = 30000; // Magic number
```

✅ **Good:**
```typescript
import { API_ENDPOINTS, DEFAULT_TABLE_LIMIT, API_STALE_TIME } from '@/lib/constants';
const response = await databaseService.getTables('database_1', {
  limit: DEFAULT_TABLE_LIMIT,
});
```

### 2. Sử dụng API Services

❌ **Bad:**
```typescript
const { data } = useQuery({
  queryKey: ['tables'],
  queryFn: () => axios.get('/api/db/tables').then(r => r.data),
});
```

✅ **Good:**
```typescript
import { useTables } from '@/lib/hooks/queries';
const { data } = useTables('database_1');
```

### 3. Sử dụng Query Keys Factory

❌ **Bad:**
```typescript
queryClient.invalidateQueries({ queryKey: ['tables', 'database_1'] });
```

✅ **Good:**
```typescript
import { databaseKeys } from '@/lib/api/query-keys';
import { invalidateTableQueries } from '@/lib/utils/query-helpers';

// Option 1: Sử dụng helper (recommended)
invalidateTableQueries(queryClient, 'database_1');

// Option 2: Sử dụng query keys factory
queryClient.invalidateQueries({
  queryKey: databaseKeys.tables.list('database_1'),
});
```

### 4. Tách biệt Server State và Client State

❌ **Bad:**
```typescript
// Server state trong client state store
const [tables, setTables] = useState([]);
const [isLoading, setIsLoading] = useState(false);
```

✅ **Good:**
```typescript
// Server state với TanStack Query
const { data: tables, isLoading } = useTables('database_1');

// Client state với Zustand
const { selectedDatabase } = useDatabaseStore();
const { isLoading: uiLoading } = useUIStore();
```

### 5. Sử dụng TypeScript Types

✅ **Good:**
```typescript
import type { DatabaseName } from '@/lib/db-config';
import type { TableInfo, TablesResponse } from '@/lib/api/services';

function MyComponent({ databaseName }: { databaseName: DatabaseName }) {
  const { data } = useTables<TablesResponse>(databaseName);
  // Type-safe!
}
```

### 6. Sử dụng Query Helpers

✅ **Good:**
```typescript
import { 
  invalidateTableQueries,
  prefetchTableData 
} from '@/lib/utils/query-helpers';

// Invalidate
invalidateTableQueries(queryClient, 'database_1');

// Prefetch
await prefetchTableData(queryClient, 'database_1', 'dbo', 'Users', {
  limit: 100,
  offset: 0,
});
```

## 📊 State Management Strategy

### Server State → TanStack Query
- ✅ API data (tables, table data, relationships)
- ✅ Automatic caching
- ✅ Background sync
- ✅ Error handling
- ✅ Loading states
- ✅ Retry logic

**Khi nào sử dụng:**
- Data từ server
- Cần caching
- Cần background sync
- Cần error handling tự động

### Client State → Zustand
- ✅ UI state (modals, dialogs, loading)
- ✅ User preferences
- ✅ Selected items
- ✅ Form state (local, chưa submit)
- ✅ Comparison tables
- ✅ Table filters và pagination

**Khi nào sử dụng:**
- State cần share giữa nhiều components
- State không cần persist
- State đơn giản, không phức tạp

### Component State → useState
- ✅ Temporary UI state
- ✅ Form inputs (before submit)
- ✅ Local calculations
- ✅ Component-specific state

**Khi nào sử dụng:**
- State chỉ dùng trong 1 component
- State không cần share
- State tạm thời

## 🚀 Performance Optimizations

### 1. Query Caching
TanStack Query tự động cache queries:
```typescript
// Config trong query-constants.ts
QUERY_STALE_TIME.MEDIUM  // 30 seconds
QUERY_CACHE_TIME.MEDIUM  // 30 minutes
```

### 2. Selective Refetching
Chỉ refetch khi cần:
```typescript
const { data } = useTables('database_1', {
  enabled: !!databaseName, // Chỉ fetch khi có databaseName
});
```

### 3. Optimistic Updates
Immediate UI updates:
```typescript
const mutation = useTestConnection();
mutation.mutate({ databaseName }, {
  onSuccess: () => {
    // Invalidate queries để refetch
    queryClient.invalidateQueries({
      queryKey: databaseKeys.connections.detail(databaseName),
    });
  },
});
```

### 4. Prefetching
Prefetch data khi cần:
```typescript
import { prefetchTableData } from '@/lib/utils/query-helpers';

// Prefetch khi hover hoặc click
const handleTableClick = async () => {
  await prefetchTableData(queryClient, 'database_1', 'dbo', 'Users');
};
```

### 5. Query Deduplication
TanStack Query tự động deduplicate cùng query:
```typescript
// Nếu 2 components cùng gọi useTables('database_1')
// Chỉ có 1 request được gửi
```

## 🔄 Migration Path

### Phase 1: ✅ Completed
1. ✅ Constants đã được tập trung
2. ✅ API services đã được tạo
3. ✅ Query hooks mới đã sẵn sàng
4. ✅ Zustand stores đã được setup
5. ✅ Query helpers đã được tạo
6. ✅ Build thành công, không có lỗi TypeScript
7. ✅ Legacy hooks được tách biệt để tránh conflicts

### Phase 2: ⏳ In Progress
1. ⏳ Migrate components dần dần từ legacy hooks sang new hooks
2. ⏳ Update existing components để sử dụng stores
3. ⏳ Refactor components để sử dụng constants từ centralized exports

### Phase 3: 📋 Planned
1. 📋 Remove old hooks khi không còn sử dụng
2. 📋 Add error boundaries
3. 📋 Add loading states components
4. 📋 Add unit tests
5. 📋 Add E2E tests

## ⚠️ Important Notes

### Legacy Hooks Compatibility
Để tránh conflicts với hooks mới, legacy hooks (`use-database-query.ts`) không được export từ `@/lib/hooks/index.ts`. 

**Cách sử dụng legacy hooks:**
```typescript
// Import trực tiếp từ file
import { useDatabaseConnection } from '@/lib/hooks/use-database-query';
```

**Cách sử dụng new hooks (recommended):**
```typescript
// Import từ queries hoặc từ index
import { useDatabaseConnection, useTables } from '@/lib/hooks/queries';
// hoặc
import { useDatabaseConnection, useTables } from '@/lib/hooks';
```

## 📚 Code Examples

### Example 1: Complete Component

```typescript
'use client';

import { useTables, useTestConnection } from '@/lib/hooks/queries';
import { useDatabaseStore, useUIStore } from '@/lib/stores';
import { DEFAULT_TABLE_LIST_LIMIT } from '@/lib/constants';
import type { DatabaseName } from '@/lib/db-config';

export function DatabaseCard({ databaseName }: { databaseName: DatabaseName }) {
  // Stores
  const { selectedDatabase, setSelectedDatabase } = useDatabaseStore();
  const { isLoading: uiLoading, setLoading } = useUIStore();
  
  // Queries
  const { data: tables, isLoading: tablesLoading } = useTables(databaseName, {
    page: 0,
    limit: DEFAULT_TABLE_LIST_LIMIT,
    includeStats: true,
  });
  
  const testConnection = useTestConnection();
  
  const handleTest = async () => {
    setLoading(true, 'Testing connection...');
    try {
      await testConnection.mutateAsync({ databaseName });
    } finally {
      setLoading(false);
    }
  };
  
  const isLoading = tablesLoading || uiLoading;
  
  return (
    <div>
      <h2>{databaseName}</h2>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <p>Tables: {tables?.data?.tables?.length || 0}</p>
      )}
      <button onClick={handleTest} disabled={testConnection.isPending}>
        Test Connection
      </button>
      <button onClick={() => setSelectedDatabase(databaseName)}>
        {selectedDatabase === databaseName ? 'Selected' : 'Select'}
      </button>
    </div>
  );
}
```

### Example 2: Using Query Helpers

```typescript
'use client';

import { useQueryClient } from '@tanstack/react-query';
import { invalidateTableQueries, prefetchTableData } from '@/lib/utils/query-helpers';
import type { DatabaseName } from '@/lib/db-config';

export function TableActions({ 
  databaseName, 
  schema, 
  table 
}: { 
  databaseName: DatabaseName;
  schema: string;
  table: string;
}) {
  const queryClient = useQueryClient();
  
  const handleRefresh = () => {
    invalidateTableQueries(queryClient, databaseName, schema, table);
  };
  
  const handlePrefetch = async () => {
    await prefetchTableData(queryClient, databaseName, schema, table, {
      limit: 100,
      offset: 0,
    });
  };
  
  return (
    <div>
      <button onClick={handleRefresh}>Refresh</button>
      <button onClick={handlePrefetch}>Prefetch</button>
    </div>
  );
}
```

## 📚 Resources

### Documentation
- 📖 [SETUP.md](./SETUP.md) - Setup guide và quick start
- 📖 [MIGRATION.md](./MIGRATION.md) - Migration guide từ legacy hooks

### External Resources
- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Zustand Docs](https://zustand-demo.pmnd.rs/)
- [Axios Docs](https://axios-http.com/)
- [Next.js Docs](https://nextjs.org/docs)

## ✅ Verification Checklist

Sau khi setup architecture mới, verify:

- [ ] `npm run lint` - No errors
- [ ] `npm run build` - Build successful
- [ ] All imports work correctly
- [ ] Constants accessible from `@/lib/constants`
- [ ] API services work correctly
- [ ] Query hooks work correctly
- [ ] Zustand stores work correctly
- [ ] No TypeScript errors

## 🎓 Learning Path

1. **Bắt đầu với Constants**: Hiểu cách sử dụng constants
2. **API Services**: Học cách gọi API qua services
3. **Query Hooks**: Sử dụng hooks để fetch data
4. **Zustand Stores**: Quản lý global state
5. **Query Helpers**: Utilities để invalidate và prefetch
