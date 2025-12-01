# Migration Guide

## Từ Legacy Hooks sang New Hooks

### Tổng quan

Hệ thống đã được refactor với architecture mới sử dụng:
- ✅ **Zustand** cho state management
- ✅ **TanStack Query** cho server state
- ✅ **Axios** với centralized API services
- ✅ **Constants** tập trung

### Legacy Hooks vs New Hooks

| Legacy Hook | New Hook | Status |
|------------|----------|--------|
| `useDatabaseConnection` | `useDatabaseConnection` | ✅ Available |
| `useDatabaseTables` | `useTables` | ✅ Available |
| `useTableData` | `useTableData` | ✅ Available |
| `useTableRelationships` | `useTableRelationships` | ✅ Available |
| `useTableStats` | `useTableStats` | ✅ Available |
| `useTestConnection` | `useTestConnection` | ✅ Available |
| `useFetchTables` | `useFetchTables` | ✅ Available |

### Import Paths

#### Legacy Hooks (vẫn hoạt động)
```typescript
// Import trực tiếp từ file
import { 
  useDatabaseConnection,
  useDatabaseTables,
  useTableData 
} from '@/lib/hooks/use-database-query';
```

#### New Hooks (Recommended)
```typescript
// Import từ queries
import { 
  useDatabaseConnection,
  useTables,
  useTableData 
} from '@/lib/hooks/queries';

// Hoặc từ index (re-exported)
import { 
  useDatabaseConnection,
  useTables,
  useTableData 
} from '@/lib/hooks';
```

## Migration Examples

### Example 1: Database Connection

**Before (Legacy):**
```typescript
import { useDatabaseConnection } from '@/lib/hooks/use-database-query';

function MyComponent() {
  const { data, isLoading } = useDatabaseConnection('database_1');
}
```

**After (New):**
```typescript
import { useDatabaseConnection } from '@/lib/hooks/queries';

function MyComponent() {
  const { data, isLoading } = useDatabaseConnection('database_1');
  // Same API, better implementation
}
```

### Example 2: Tables List

**Before (Legacy):**
```typescript
import { useDatabaseTables } from '@/lib/hooks/use-database-query';

function MyComponent() {
  const { data, isLoading } = useDatabaseTables('database_1', {
    page: 0,
    limit: 50,
  });
}
```

**After (New):**
```typescript
import { useTables } from '@/lib/hooks/queries';
import { DEFAULT_TABLE_LIST_LIMIT } from '@/lib/constants';

function MyComponent() {
  const { data, isLoading } = useTables('database_1', {
    page: 0,
    limit: DEFAULT_TABLE_LIST_LIMIT,
    includeStats: true,
  });
}
```

### Example 3: Using Stores

**Before:**
```typescript
const [selectedDatabase, setSelectedDatabase] = useState(null);
const [comparisonTables, setComparisonTables] = useState({ left: null, right: null });
```

**After:**
```typescript
import { useDatabaseStore } from '@/lib/stores';

const { 
  selectedDatabase, 
  setSelectedDatabase,
  comparisonTables,
  setComparisonTable 
} = useDatabaseStore();
```

### Example 4: API Calls

**Before:**
```typescript
import axiosClient from '@/lib/axios-client';

const response = await axiosClient.get('/api/db/tables?database=database_1&limit=50');
```

**After:**
```typescript
import { databaseService } from '@/lib/api/services';
import { DEFAULT_TABLE_LIST_LIMIT } from '@/lib/constants';

const response = await databaseService.getTables('database_1', {
  page: 0,
  limit: DEFAULT_TABLE_LIST_LIMIT,
  includeStats: true,
});
```

### Example 5: Query Invalidation

**Before:**
```typescript
queryClient.invalidateQueries({ queryKey: ['tables', 'database_1'] });
```

**After:**
```typescript
import { databaseKeys } from '@/lib/api/query-keys';
import { invalidateTableQueries } from '@/lib/utils/query-helpers';

// Option 1: Using helper (recommended)
invalidateTableQueries(queryClient, 'database_1');

// Option 2: Using query keys factory
queryClient.invalidateQueries({
  queryKey: databaseKeys.tables.list('database_1'),
});
```

## Step-by-Step Migration

### Step 1: Update Imports

1. Thay đổi import paths từ legacy hooks sang new hooks
2. Update hook names nếu có thay đổi (ví dụ: `useDatabaseTables` → `useTables`)
3. Import constants từ centralized exports

### Step 2: Update API Calls

1. Thay thế axios calls trực tiếp bằng API services
2. Sử dụng constants thay vì magic numbers
3. Update error handling nếu cần

### Step 3: Migrate State Management

1. Thay `useState` cho global state bằng Zustand stores
2. Giữ `useState` cho component-local state
3. Update components để sử dụng stores

### Step 4: Update Query Keys

1. Thay hardcoded query keys bằng query keys factory
2. Sử dụng query helpers cho invalidation
3. Update prefetching logic nếu có

### Step 5: Testing

1. Test từng component sau khi migrate
2. Verify caching hoạt động đúng
3. Check error handling
4. Verify loading states

## Common Issues & Solutions

### Issue 1: Hook not found

**Error:**
```
Module './use-database-query' has already exported a member named 'useDatabaseConnection'
```

**Solution:**
Import trực tiếp từ file hoặc sử dụng new hooks:
```typescript
// ✅ OK
import { useDatabaseConnection } from '@/lib/hooks/use-database-query';

// ✅ Better
import { useDatabaseConnection } from '@/lib/hooks/queries';
```

### Issue 2: Type errors

**Error:**
```
Type error: Module '"./use-database-query"' declares 'ServerInfo' locally, but it is not exported.
```

**Solution:**
Chỉ export types đã được export. Sử dụng types từ API services:
```typescript
import type { TableInfo, TablesResponse } from '@/lib/api/services';
```

### Issue 3: Constants not found

**Error:**
```
Cannot find module '@/lib/constants/table-constants'
```

**Solution:**
Import từ centralized exports:
```typescript
import { DEFAULT_TABLE_LIMIT } from '@/lib/constants';
```

## Checklist

- [ ] Update all imports to use new hooks
- [ ] Replace axios calls with API services
- [ ] Migrate global state to Zustand stores
- [ ] Update query keys to use factory
- [ ] Replace magic numbers with constants
- [ ] Test all components
- [ ] Update error handling
- [ ] Verify caching works correctly
- [ ] Check loading states
- [ ] Remove unused legacy code

## Resources

- [SETUP.md](./SETUP.md) - Setup guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture overview
- [TanStack Query Migration Guide](https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5)

