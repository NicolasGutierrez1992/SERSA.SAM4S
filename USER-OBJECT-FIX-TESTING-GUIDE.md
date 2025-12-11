# Testing Guide - User Object Fix Verification

**Date:** December 11, 2025

---

## Quick Test: Login Flow

### 1. Clear Browser Data
Open DevTools (F12) → Application → Storage → Clear All
- This ensures no cached user data

### 2. Login with Admin Credentials
Navigate to `http://localhost:3000/login`
- CUIT: `20366299913`
- Password: (your admin password)

### 3. Check localStorage Immediately After Login
Open DevTools → Application → localStorage → select http://localhost:3000

**Expected to see:**
```
auth_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
user: {
  "id": 0,
  "cuit": "20366299913",
  "nombre": "Admin",
  "email": "...",
  "rol": 1,
  "must_change_password": false,
  "last_login": "2024-12-11T...",
  "id_mayorista": 1,
  "limite_descargas": 0
}
```

**Critical:** The `rol: 1` must be present!

### 4. Navigate to /usuarios
If admin, you should see the users list.
If redirect happens, check:
1. Is `rol: 1` in localStorage?
2. Check console for RolesGuard logs

### 5. Page Refresh Test
Press F5 to refresh the page.
- User should remain logged in
- localStorage should still contain the user object
- `/usuarios` should still be accessible

### 6. Logout Test
Click logout button.
- localStorage should be empty
- Should redirect to /login
- Check: both `auth_token` and `user` should be deleted from localStorage

---

## Detailed API Testing

### Test 1: Login Endpoint
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "cuit": "20366299913",
    "password": "your_password"
  }'
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 0,
    "cuit": "20366299913",
    "nombre": "Admin",
    "email": "admin@sersa.com",
    "rol": 1,
    "must_change_password": false,
    "last_login": "2024-12-11T10:30:00Z",
    "id_mayorista": 1,
    "limite_descargas": 0
  }
}
```

**Verification Checklist:**
- [ ] `access_token` is present
- [ ] `user.rol` is `1` (for admin)
- [ ] `user.id_mayorista` is present
- [ ] `user.limite_descargas` is present
- [ ] `user.must_change_password` is boolean
- [ ] `user.last_login` is a valid timestamp

### Test 2: Protected Endpoint - /usuarios (Requires Admin)
```bash
curl -X GET http://localhost:3001/api/users \
  -H "Authorization: Bearer <your_token>"
```

**Expected:** Returns list of users (200 OK)
**If fails with 401:** Token issue
**If fails with 403:** Role validation issue

---

## Debugging Steps If Something Fails

### Symptom: Admin can login but `/usuarios` returns 403
1. Check localStorage - is `rol: 1` present?
2. Check browser console - any errors?
3. Check backend console - look for RolesGuard logs
4. Verify JWT token in DevTools:
   ```javascript
   // Paste in console:
   localStorage.getItem('user')
   ```

### Symptom: After refresh, user is logged out
1. Check if localStorage still has `auth_token` and `user`
2. Check if `AuthContext` properly initializes on mount
3. Check browser console for localStorage parsing errors

### Symptom: User logout doesn't clear localStorage
1. Check browser console for errors in logout function
2. Manually clear localStorage:
   ```javascript
   // Paste in console:
   localStorage.clear()
   ```

---

## Expected Behavior by User Role

### Admin (rol = 1, id = 0)
- ✅ Can login
- ✅ Can access /dashboard
- ✅ Can access /usuarios
- ✅ Can access /auditoria
- ✅ Can download certificates
- ✅ Can manage other users

### Mayorista (rol = 2)
- ✅ Can login
- ✅ Can access /dashboard
- ❌ Cannot access /usuarios
- ✅ Can download certificates
- ✅ Can see own download history

### Distribuidor (rol = 3)
- ✅ Can login
- ✅ Can access /dashboard
- ❌ Cannot access /usuarios
- ✅ Can download certificates
- ✅ Can see own download history

---

## Console Commands for Quick Testing

Open DevTools console and paste these:

### Check User Object
```javascript
const user = JSON.parse(localStorage.getItem('user'));
console.log('User:', user);
console.log('Has rol?', user?.rol);
console.log('rol value:', user?.rol);
```

### Check Token
```javascript
const token = localStorage.getItem('auth_token');
console.log('Token exists?', !!token);
console.log('Token length:', token?.length);
```

### Decode Token (if using jwt-decode library)
```javascript
// First install jwt-decode or use online decoder
// https://jwt.io/
const token = localStorage.getItem('auth_token');
console.log('Full token:', token);
```

### Test AuthContext
```javascript
// In a page that uses useAuth()
// Add this to the page temporarily:
const { user, isAuthenticated } = useAuth();
console.log('AuthContext user:', user);
console.log('isAuthenticated:', isAuthenticated);
```

---

## Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| User not in localStorage | AuthContext not saving on login | Verify login() method saves user |
| rol is undefined | Type mismatch in response | Check LoginResponse interface |
| 403 on /usuarios | RolesGuard failing | Check if `rol: 1` in payload |
| User logged out after refresh | User not restored from localStorage | Check AuthContext useEffect |
| Cannot parse user from localStorage | JSON parsing error | Clear localStorage and login again |

---

## Timezone Verification (Bonus)

Since timezone work was completed, also verify:

### Check Timestamp Fields
In localStorage, check:
```javascript
const user = JSON.parse(localStorage.getItem('user'));
console.log('last_login:', user.last_login);
// Should be in Argentina timezone (UTC-3)
```

### Check Audit Logs
```bash
curl -X GET "http://localhost:3001/api/auditoria?fecha_desde=2024-12-11&fecha_hasta=2024-12-11" \
  -H "Authorization: Bearer <token>"
```

Expected: Dates are in Argentina timezone (UTC-3)

---

## Final Checklist

Before concluding testing, verify ALL of these:

- [ ] Admin user can login
- [ ] `rol: 1` appears in localStorage
- [ ] `id_mayorista: 1` appears in localStorage
- [ ] Admin can access /usuarios endpoint
- [ ] Page refresh maintains login status
- [ ] Logout clears both token and user from localStorage
- [ ] Other users can login and access their respective pages
- [ ] No console errors during login flow
- [ ] No console errors during page navigation
- [ ] RolesGuard allows admin access to protected routes

---

## If All Tests Pass ✅

The user object fix is complete and working correctly. The system is ready for:
1. Full integration testing
2. User acceptance testing (UAT)
3. Production deployment

The admin user with `id = 0` can now properly authenticate and use all admin features throughout the application.
