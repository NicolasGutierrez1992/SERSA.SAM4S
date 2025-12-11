# Quick Start - Testing the ROL Field Fix

**⏱️ Total Time: ~10 minutes**

---

## Step 1️⃣: Prepare Environment (2 min)

### Terminal 1 - Backend
```powershell
cd "c:\Users\Nicol\OneDrive\Documentos\GitHub\SERSA.SAM4S\backend"
npm run start
```

**Expected Output:**
```
[Nest] ...
Starting Nest application...
[AppInitializerService] Argentina timezone: America/Argentina/Buenos_Aires
Listening on port 3001
```

### Terminal 2 - Frontend
```powershell
cd "c:\Users\Nicol\OneDrive\Documentos\GitHub\SERSA.SAM4S\frontend"
npm run dev
```

**Expected Output:**
```
- local:        http://localhost:3000
- ready in 1234ms
```

---

## Step 2️⃣: Clear Browser Data (1 min)

1. Open browser to `http://localhost:3000`
2. Press `F12` to open DevTools
3. Go to **Application** tab → **Storage** → **LocalStorage**
4. Click on `http://localhost:3000` and delete all entries
5. Close DevTools

---

## Step 3️⃣: Login (1 min)

On the login page:
- **CUIT:** `20366299913`
- **Password:** (your admin password)
- Click **"Ingresar"**

Wait for redirect to dashboard.

---

## Step 4️⃣: Verify User Object (2 min)

Open DevTools Console (`F12` → **Console** tab) and run:

```javascript
// Check 1: User object exists
const user = JSON.parse(localStorage.getItem('user'));
console.log('User object:', user);
```

**Expected Output:**
```javascript
User object: {
  id: 0,
  cuit: "20366299913",
  nombre: "Admin",
  email: "nicolasgutierrez10492@gmail.com",
  rol: 1,                              // ✅ THIS MUST BE HERE
  must_change_password: false,
  last_login: "2025-12-11T13:06:28.034Z",
  id_mayorista: 1,
  limite_descargas: 0
}
```

Continue in console:

```javascript
// Check 2: Verify rol specifically
console.log('✅ User rol:', user.rol);  // Should output: 1
console.log('✅ User id:', user.id);     // Should output: 0
```

**✅ If you see `rol: 1`, the fix is working!**

---

## Step 5️⃣: Test Role-Based Access (1 min)

Navigate to: `http://localhost:3000/usuarios`

**Expected:** Page loads successfully showing user management interface

**If you get an error:** Check DevTools Console for 401 or 403 errors

---

## Step 6️⃣: Test Page Reload Persistence (1 min)

While still on `/usuarios`:

1. Press `F5` to reload
2. Page should still be accessible
3. Check console again:
```javascript
console.log('After reload - rol:', JSON.parse(localStorage.getItem('user')).rol);
// Should still output: 1
```

---

## Step 7️⃣: Test Logout (1 min)

1. Click **Logout** button (in header/sidebar)
2. Should redirect to `/login`
3. Check console:
```javascript
console.log('Token:', localStorage.getItem('auth_token'));    // null
console.log('User:', localStorage.getItem('user'));           // null
```

**✅ Both should be null**

---

## ✅ Success Criteria

| Check | Expected | Your Result |
|-------|----------|-------------|
| User object exists | ✅ | ___ |
| User has `rol` field | `1` | ___ |
| User has `id` field | `0` | ___ |
| `/usuarios` accessible | ✅ | ___ |
| Page reload persists auth | ✅ | ___ |
| Logout clears data | Both null | ___ |

---

## 🔧 Troubleshooting Quick Fixes

### ❌ User object missing `rol` field?
```bash
# 1. Clear ALL browser data
# DevTools → Application → Clear site data (all)

# 2. Rebuild frontend
npm run build

# 3. Restart both servers
npm run dev    # frontend
npm run start  # backend (in separate terminal)

# 4. Login again and check
```

### ❌ 401 Unauthorized when accessing protected endpoints?
```bash
# 1. Check backend is running (should see "Listening on port 3001")

# 2. Restart backend with build
cd backend
npm run build
npm run start

# 3. Check JWT strategy allows id=0
grep "payload.id === undefined" src/auth/strategies/jwt.strategy.ts
# Should find the line
```

### ❌ `/usuarios` returns 403 Forbidden?
```javascript
// Check the actual rol value
const user = JSON.parse(localStorage.getItem('user'));
console.log('Actual rol value:', user.rol, 'Type:', typeof user.rol);
// Must be: 1 (number), not "1" (string)
```

### ❌ Page reload loses authentication?
```javascript
// Check localStorage is being used
console.log('Token in storage:', !!localStorage.getItem('auth_token'));
console.log('User in storage:', !!localStorage.getItem('user'));

// Clear and re-login
localStorage.clear();
// Then login again
```

---

## 📋 Command Reference

### Start Everything (2 terminals)

**Terminal 1:**
```powershell
cd "c:\Users\Nicol\OneDrive\Documentos\GitHub\SERSA.SAM4S\backend"
npm run start
```

**Terminal 2:**
```powershell
cd "c:\Users\Nicol\OneDrive\Documentos\GitHub\SERSA.SAM4S\frontend"
npm run dev
```

### Rebuild After Changes
```powershell
# Frontend
cd frontend
npm run build
npm run dev

# Backend
cd backend
npm run build
npm run start
```

### Quick Compilation Check
```powershell
# Check if everything compiles
cd frontend && npm run build

cd ..\backend && npm run build
```

---

## 🎯 Expected Flow

```
User Login
    ↓
Backend validates credentials
    ↓
Backend returns { access_token, user: { id: 0, rol: 1, ... } }
    ↓
Frontend saves token to localStorage
    ↓
Frontend saves user to localStorage ← THIS IS THE KEY FIX
    ↓
Frontend redirects to dashboard
    ↓
useAuth() provides user from localStorage
    ↓
Components access user.rol for role-based rendering
    ↓
RolesGuard checks user.rol for protected routes
    ↓
✅ Admin can access /usuarios and other admin features
```

---

## 🎓 What Changed

### Backend
```typescript
// jwt.strategy.ts - NOW ALLOWS id = 0
if (payload.id === undefined) {  // ← Changed from !payload.id
  throw new UnauthorizedException();
}
```

### Frontend
```typescript
// AuthContext.tsx - NOW SAVES USER
if (result.success && result.data) {
  setUser(result.data.user);
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(result.data.user));  // ← Added
  }
}
```

---

## 📞 If Something Goes Wrong

1. **Check the logs**
   - Backend console should show no errors
   - Frontend console (F12) should show API responses

2. **Clear everything**
   ```bash
   # Clear browser storage
   # DevTools → Application → Clear site data
   
   # Clear frontend cache
   rm -r frontend/.next
   
   # Rebuild
   cd frontend && npm run build
   ```

3. **Verify files were changed**
   ```bash
   # Check JWT strategy
   grep -n "payload.id === undefined" backend/src/auth/strategies/jwt.strategy.ts
   
   # Check frontend types
   grep -n "rol: number" frontend/src/types/index.ts
   ```

4. **Check database**
   - Admin user should exist with: `id_usuario = 0, id_rol = 1`
   - Run: `SELECT * FROM usuarios WHERE id_usuario = 0;`

---

## ✨ Success Indicators

When everything is working, you should see:

1. **In localStorage:**
   ```javascript
   // Both of these should have values
   localStorage.getItem('auth_token')    // eyJhbGciOi...
   localStorage.getItem('user')          // {"id":0,"rol":1,...}
   ```

2. **In DevTools Application tab:**
   - `auth_token` entry in LocalStorage
   - `user` entry in LocalStorage with all fields including `rol`

3. **In Network tab:**
   - POST `/auth/login` returns 200 with user object including `rol`
   - Subsequent requests include `Authorization: Bearer ...` header

4. **In App:**
   - Dashboard loads
   - `/usuarios` loads without 403 error
   - Logout button works
   - Page reload maintains login state

---

## 🎉 You're Done!

Once all checks pass, the fix is working correctly. The next steps are:

1. ✅ Run the full integration tests
2. ✅ Test certificate download flow
3. ✅ Verify timezone displays in all views
4. ✅ Prepare for production deployment

---

**Need more details?** Check these docs:
- `USER-ROL-FIELD-FIX.md` - Technical explanation
- `VERIFICATION-ROL-FIELD-GUIDE.md` - Detailed testing steps
- `FINAL-IMPLEMENTATION-STATUS.md` - Complete overview

