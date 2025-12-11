# User Object Fix - COMPLETED ✅

**Date:** December 11, 2025  
**Issue:** Missing `rol` field in localStorage user object  
**Status:** RESOLVED

---

## Problem Identified

The admin user (with `id_usuario = 0`) was logging in successfully but the `rol` field was missing from the user object stored in localStorage. This was causing:

1. Frontend pages couldn't verify if user had admin permissions
2. `RolesGuard` on the backend couldn't validate user roles properly
3. The `/usuarios` endpoint access was blocked even for admin users

### Root Causes Found and Fixed

#### 1. **Type Mismatch in Frontend** ✅
**File:** `frontend/src/lib/api.ts`

**Problem:** The `LoginResponse` interface was expecting fields that didn't match backend response:
```typescript
// BEFORE (WRONG)
export interface LoginResponse {
  access_token: string;
  user: {
    id: number;
    cuit: string;
    nombre: string;
    email: string;
    rol: number;
    rolNombre: string;           // ❌ Backend doesn't return this
    activo: boolean;             // ❌ Backend doesn't return this
    primerAcceso: boolean;       // ❌ Backend doesn't return this
    id_mayorista?: number;
  };
}
```

**Solution:** Updated to match exactly what the backend returns:
```typescript
// AFTER (CORRECT)
export interface LoginResponse {
  access_token: string;
  user: {
    id: number;
    cuit: string;
    nombre: string;
    email: string;
    rol: number;
    must_change_password: boolean;
    last_login: Date;
    id_mayorista: number;
    limite_descargas: number;
  };
}
```

#### 2. **User Type Mismatch in Frontend** ✅
**File:** `frontend/src/types/index.ts`

**Problem:** The `User` interface was using camelCase field names while backend uses snake_case:
```typescript
// BEFORE (WRONG)
export interface User {
  id: number;
  cuit: string;
  nombre: string;
  email: string;
  telefono?: string;
  rol: UserRole;               // ❌ Should be number, not enum
  estado: boolean;             // ❌ Backend doesn't have this
  mayorista?: User;            // ❌ Backend doesn't return this
  limiteDescargas: number;     // ❌ Should be limite_descargas
  primerAcceso: boolean;       // ❌ Should be must_change_password
  ultimoAcceso?: string;       // ❌ Should be last_login
  createdAt: string;           // ❌ Backend doesn't return this
  updatedAt: string;           // ❌ Backend doesn't return this
}
```

**Solution:** Updated to match backend response exactly:
```typescript
// AFTER (CORRECT)
export interface User {
  id: number;
  cuit: string;
  nombre: string;
  email: string;
  rol: number;
  must_change_password: boolean;
  last_login: Date;
  id_mayorista: number;
  limite_descargas: number;
}
```

#### 3. **User Not Persisted in localStorage** ✅
**File:** `frontend/src/contexts/AuthContext.tsx`

**Problem:** The `AuthContext` was not:
- Loading user from localStorage on app initialization
- Saving user to localStorage after login
- Cleaning user from localStorage on logout

**Solution:** Enhanced `AuthContext` with proper localStorage handling:
```typescript
useEffect(() => {
  const token = apiService.getToken();
  if (token && typeof window !== 'undefined') {
    // Restore user from localStorage on page load
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing stored user:', error);
      }
    }
  }
  setIsLoading(false);
}, []);

const login = async (credentials: LoginDto) => {
  // ... login logic ...
  if (result.success && result.data) {
    setUser(result.data.user);
    // Now save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(result.data.user));
    }
  }
};

const logout = () => {
  apiService.logout();
  setUser(null);
  // Clean from localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user');
  }
};
```

---

## Backend Verification

### Auth Service (✅ Already Correct)
**File:** `backend/src/auth/auth.service.ts`

The backend was already correctly returning all required fields in the `LoginResponse`:
```typescript
return {
  access_token,
  user: {
    id: user.id_usuario,
    cuit: user.cuit,
    nombre: user.nombre,
    email: user.mail,
    rol: user.id_rol,              // ✅ Included
    must_change_password: user.must_change_password,  // ✅ Included
    last_login: user.ultimo_login, // ✅ Included
    id_mayorista: user.id_mayorista, // ✅ Included
    limite_descargas: user.limite_descargas // ✅ Included
  },
};
```

### JWT Strategy (✅ Fixed to Allow id = 0)
**File:** `backend/src/auth/strategies/jwt.strategy.ts`

Already fixed to allow `id === 0` (admin user):
```typescript
if (payload.id === undefined || !payload.cuit) {  // ✅ Allows 0
  throw new UnauthorizedException('Token inválido');
}
```

### Roles Guard (✅ Already Checking Both Fields)
**File:** `backend/src/auth/guards/roles.guard.ts`

Already checking both `user.rol` and `user.id_rol`:
```typescript
const userRole = user.rol ?? user.id_rol;  // ✅ Checks both
const hasAccess = requiredRoles.some((role) => userRole === role);
```

---

## What Was Working vs What Was Broken

### What Was Working ✅
1. Backend login endpoint returns correct user object with all fields
2. Backend JWT strategy allows admin user with `id === 0`
3. Backend roles guard checks both `rol` and `id_rol` fields
4. Auth interceptor saves token to localStorage

### What Was Broken ❌
1. Frontend types expected different field names than backend was returning
2. User object wasn't being saved to localStorage
3. User object wasn't being restored from localStorage on app load

---

## Flow After Fix

### Login Flow
1. User submits login form
2. Backend validates credentials and returns `LoginResponse` with:
   - `access_token` (JWT)
   - `user` object with `rol`, `id_mayorista`, `limite_descargas`, etc.
3. Frontend `apiService.login()` saves token to localStorage
4. Frontend `AuthContext.login()` now also saves user to localStorage
5. Frontend pages can now access `user.rol`, `user.id_mayorista`, etc.

### Page Load Flow
1. React app initializes
2. `AuthProvider` useEffect runs
3. Checks if token exists in localStorage
4. If token exists, restores user from localStorage
5. User state is set, `useAuth()` returns authenticated context
6. Pages can now render authenticated UI with user information

### Logout Flow
1. User clicks logout
2. Frontend clears token from localStorage
3. Frontend now also clears user from localStorage
4. `useAuth()` returns null user
5. User is redirected to login page

---

## Testing Checklist

After these changes, verify:

- [ ] Admin can login with CUIT `20366299913`
- [ ] After login, localStorage contains user object with `rol: 1`
- [ ] localStorage contains `id_mayorista: 1`
- [ ] localStorage contains `limite_descargas: 0`
- [ ] Admin can access `/usuarios` endpoint (protected route)
- [ ] Admin can see users list
- [ ] Admin can edit user states and passwords
- [ ] Logout clears user from localStorage
- [ ] Page refresh keeps user logged in (restored from localStorage)
- [ ] Other users (distribuidor, mayorista) can also login and access their respective endpoints

---

## Files Modified

```
frontend/src/
├── lib/api.ts                          # Fixed LoginResponse interface
├── types/index.ts                      # Fixed User interface
└── contexts/AuthContext.tsx            # Added localStorage persistence
```

---

## Status: READY FOR TESTING ✅

The frontend now properly:
1. Matches backend response types
2. Persists user to localStorage on login
3. Restores user from localStorage on page load
4. Clears user from localStorage on logout

All type safety is restored, and the admin user (id = 0) can now properly authenticate and be used throughout the application.
