# Context Directory

## Purpose
React Context providers for global state management: authentication, store data, and toast notifications.

## Structure
```
context/
├── AuthContext.tsx    # Supabase authentication state
├── StoreContext.tsx   # Global store data (services, vouchers)
└── ToastContext.tsx   # Toast notification system
```

## Providers

### AuthContext (`AuthContext.tsx`)
```tsx
import { useAuth } from "@/context/AuthContext";

const { user, isAuthenticated, isLoading, login, logout } = useAuth();
```

| Export | Type | Description |
|--------|------|-------------|
| `user` | `User \| null` | Current user with id, email, name, role |
| `isAuthenticated` | `boolean` | True if logged in |
| `isLoading` | `boolean` | True during auth check |
| `login(email, password)` | `Promise<LoginResult>` | Login with Supabase |
| `logout()` | `Promise<void>` | Sign out and redirect |

**User Roles**: `SUPER_ADMIN`, `MANAGER`, `STAFF`, `ADMIN`

### StoreContext (`StoreContext.tsx`)
```tsx
import { useStore } from "@/context/StoreContext";

const { services, vouchers, isLoading, fetchServices } = useStore();
```

| Export | Type | Description |
|--------|------|-------------|
| `services` | `Service[]` | All spa services |
| `vouchers` | `Voucher[]` | User's vouchers |
| `isLoading` | `boolean` | Data loading state |
| `fetchServices()` | `Promise<void>` | Refresh services |
| `fetchVouchers()` | `Promise<void>` | Refresh vouchers |

### ToastContext (`ToastContext.tsx`)
```tsx
import { useToast } from "@/context/ToastContext";

const { toast, showToast } = useToast();
showToast("Success!", "success");
showToast("Error occurred", "error");
```

| Export | Type | Description |
|--------|------|-------------|
| `toast` | `Toast \| null` | Current toast |
| `showToast(message, type)` | `void` | Display toast |

**Toast Types**: `success`, `error`, `warning`, `info`

## Usage in Layout

Providers are wrapped in `app/layout.tsx`:
```tsx
<AuthProvider>
  <StoreProvider>
    <ToastProvider>
      {children}
    </ToastProvider>
  </StoreProvider>
</AuthProvider>
```

## Patterns

### Protected Routes
```tsx
"use client";
import { useAuth } from "@/context/AuthContext";
import { redirect } from "next/navigation";

export default function ProtectedPage() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) return <Loading />;
  if (!isAuthenticated) redirect("/admin/login");
  
  return <Content />;
}
```

### Role-Based Access
```tsx
const { user } = useAuth();

if (user?.role !== "SUPER_ADMIN") {
  return <Unauthorized />;
}
```

## JIT Index
```bash
# Find context usage
rg -n "useAuth|useStore|useToast" app/ components/

# Find provider definition
rg -n "createContext|Provider" context/

# Find role check
rg -n "user\.role" app/
```

## Common Gotchas
- All context hooks require `"use client"` directive
- `isLoading` should be checked before accessing `user`
- StoreContext fetches services on mount - don't duplicate in pages
- Toast auto-dismisses after 3 seconds
