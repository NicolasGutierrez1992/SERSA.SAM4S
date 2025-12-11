# User Role Field Fix - Verification & Testing Guide

**Date:** December 11, 2025  
**Purpose:** Step-by-step instructions to verify that the `rol` field is now properly persisted in localStorage and accessible throughout the application

---

## Quick Verification (2 minutes)

### Step 1: Clear Browser Data
```
1. Open your browser
2. Press F12 to open Developer Tools
3. Go to Application tab → Storage → LocalStorage
4. Delete entries: 'auth_token' and 'user'
5. Close DevTools
```

### Step 2: Login and Check localStorage

**Login:**
- Navigate to `http://localhost:3000/login` (or your frontend URL)
- Enter credentials:
  - CUIT: `20366299913`
  - Password: `(your admin password)`
- Click "Ingresar"

**Verify in DevTools:**
```javascript
// Open DevTools Console (F12 → Console tab)

// Check 1: Token exists
localStorage.getItem('auth_token')
// Expected output: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

// Check 2: User object exists
const user = JSON.parse(localStorage.getItem('user'))
console.log(user)

// Expected output:
{
  id: 0,
  cuit: "20366299913",
  nombre: "Admin",
  email: "nicolasgutierrez10492@gmail.com",
  rol: 1,                              // ← THIS SHOULD BE HERE NOW!
  must_change_password: false,
  last_login: "2025-12-11T13:06:28.034Z",
  id_mayorista: 1,
  limite_descargas: 0
}

// Check 3: Verify rol field specifically
console.log(`User rol: ${user.rol}`)  // Should output: "User rol: 1"
console.log(`User id: ${user.id}`)    // Should output: "User id: 0"
```

### Step 3: Verify Role-Based Access

**Test Admin Access:**
```
1. While logged in as admin, navigate to: /usuarios
2. The page should load successfully (not show 401 or 403 error)
3. You should see the users management interface
```

**Check useAuth Hook:**
```javascript
// In any component, the user object is available via useAuth()
// Open DevTools Console and run this in a page that uses useAuth:

const authContext = document.querySelector('[data-role="admin"]')
// Or check in React DevTools component tree
```

---

## Detailed Verification Steps

### 1. Authentication Flow Verification

#### 1.1 Test Login with Admin User
```bash
# Step 1: Start your development server
cd c:\Users\Nicol\OneDrive\Documentos\GitHub\SERSA.SAM4S\frontend
npm run dev

# Step 2: In another terminal, ensure backend is running
cd c:\Users\Nicol\OneDrive\Documentos\GitHub\SERSA.SAM4S\backend
npm run start
```

#### 1.2 Monitor Network Request
```
1. Open browser DevTools (F12)
2. Go to Network tab
3. Go to http://localhost:3000/login
4. Enter admin credentials
5. Click "Ingresar"
6. In Network tab, find the POST request to /api/auth/login
7. Click on it and check the Response tab
8. Verify it returns:
   {
     "access_token": "...",
     "user": {
       "id": 0,
       "rol": 1,
       ...all other fields...
     }
   }
```

#### 1.3 Verify Token Decode
```javascript
// Install jwt-decode if not available
// npm install jwt-decode

// In DevTools Console:
import('https://cdn.jsdelivr.net/npm/jwt-decode@4/+esm').then(({ default: jwtDecode }) => {
  const token = localStorage.getItem('auth_token');
  const decoded = jwtDecode(token);
  console.log('JWT Payload:', decoded);
  // Should show: { id: 0, cuit: "20366299913", rol: 1, ... }
});
```

---

### 2. localStorage Persistence Verification

#### 2.1 Test localStorage Contents
```javascript
// In DevTools Console
const user = JSON.parse(localStorage.getItem('user'));

// Verify all required fields
console.table({
  'id': user.id,
  'rol': user.rol,
  'cuit': user.cuit,
  'nombre': user.nombre,
  'email': user.email,
  'id_mayorista': user.id_mayorista,
  'limite_descargas': user.limite_descargas,
  'must_change_password': user.must_change_password,
  'last_login': user.last_login
});

// Expected output (table format):
│ (index)                │ Values                      │
├────────────────────────┼────────────────────────────┤
│ id                     │ 0                          │
│ rol                    │ 1                          │
│ cuit                   │ "20366299913"              │
│ nombre                 │ "Admin"                    │
│ email                  │ "nicolasgutierrez10492..." │
│ id_mayorista           │ 1                          │
│ limite_descargas       │ 0                          │
│ must_change_password   │ false                      │
│ last_login             │ "2025-12-11T13:06:28.0..." │
```

#### 2.2 Test Page Reload Persistence
```javascript
// Step 1: Login as admin
// Step 2: Open DevTools Console and note down the user.rol value
console.log('Before reload - rol:', JSON.parse(localStorage.getItem('user')).rol);

// Step 3: Press F5 to reload the page
// Step 4: Check the user is still available
console.log('After reload - rol:', JSON.parse(localStorage.getItem('user')).rol);

// Expected: Both should output: "rol: 1"
```

---

### 3. Role-Based Access Control Verification

#### 3.1 Test RolesGuard with Admin
```
1. Login as admin (id=0, rol=1)
2. Navigate to http://localhost:3000/usuarios
3. Should load successfully ✅
4. You should see user management interface
```

#### 3.2 Test useAuth Hook Returns rol
```javascript
// In DevTools Console (on any page after login):
// This requires access to React DevTools or the component context

// Alternative: Check if you can see the user in network requests
// The Authorization header should have a valid JWT with id=0
const token = localStorage.getItem('auth_token');
console.log('Token exists:', !!token);
console.log('Token length:', token.length);  // Should be > 100

// Decode and verify:
// (Use jwt-decode as shown in section 1.3)
```

---

### 4. Logout Verification

#### 4.1 Test Logout Clears Everything
```javascript
// Before logout
console.log('Before logout:');
console.log('  Token:', !!localStorage.getItem('auth_token'));
console.log('  User:', !!localStorage.getItem('user'));

// Step 1: Click Logout button in app
// OR manually clear in DevTools

// Step 2: After logout, check console again
console.log('After logout:');
console.log('  Token:', localStorage.getItem('auth_token'));  // Should be null
console.log('  User:', localStorage.getItem('user'));          // Should be null

// Expected output:
// Before logout:
//   Token: true
//   User: true
// After logout:
//   Token: null
//   User: null
```

#### 4.2 Test Redirect After Logout
```
1. Login as admin
2. Click Logout
3. Should redirect to /login
4. localStorage should be empty
5. Trying to access /usuarios should redirect to /login
```

---

### 5. Type Safety Verification

#### 5.1 Check TypeScript Types Match Backend
```typescript
// frontend/src/types/index.ts
// Should include:
export interface User {
  id: number;           // ✅ Allows 0
  cuit: string;
  nombre: string;
  email: string;
  rol: number;          // ✅ Must be present
  must_change_password: boolean;
  last_login: Date;
  id_mayorista: number;
  limite_descargas: number;
}

// frontend/src/lib/api.ts LoginResponse
export interface LoginResponse {
  access_token: string;
  user: {
    id: number;
    cuit: string;
    nombre: string;
    email: string;
    rol: number;        // ✅ Must be present
    must_change_password: boolean;
    last_login: Date;
    id_mayorista: number;
    limite_descargas: number;
  };
}
```

#### 5.2 Compile and Verify No Type Errors
```bash
cd c:\Users\Nicol\OneDrive\Documentos\GitHub\SERSA.SAM4S\frontend
npm run build

# Expected output (end of build):
# ✅ Compiled successfully
# ✅ No TypeScript errors
```

---

### 6. Backend Verification

#### 6.1 Check Backend Returns rol Field
```bash
# Test the login endpoint directly
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "cuit": "20366299913",
    "password": "your-password"
  }'

# Expected response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 0,
    "cuit": "20366299913",
    "nombre": "Admin",
    "email": "nicolasgutierrez10492@gmail.com",
    "rol": 1,                           // ✅ MUST BE PRESENT
    "must_change_password": false,
    "last_login": "2025-12-11T13:06:28.034Z",
    "id_mayorista": 1,
    "limite_descargas": 0
  }
}
```

#### 6.2 Verify JWT Strategy Allows id = 0
```bash
# Test accessing a protected endpoint with admin token
# Get token from login first, then:

curl -X GET http://localhost:3001/api/users \
  -H "Authorization: Bearer <your-token-here>"

# Expected: Should work with id=0 ✅
# If it returns 401 Unauthorized, the JWT validation is still rejecting id=0
```

---

## Automated Verification Script

### Create Testing Script
Create a file: `c:\Users\Nicol\OneDrive\Documentos\GitHub\SERSA.SAM4S\verify-rol-field.js`

```javascript
#!/usr/bin/env node

const readline = require('readline');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     SERSA User ROL Field Verification Script               ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Test 1: Check TypeScript compilation
console.log('Test 1: TypeScript Compilation');
console.log('-------------------------------');
const { execSync } = require('child_process');

try {
  execSync('npm run build --silent', { 
    cwd: 'c:\\Users\\Nicol\\OneDrive\\Documentos\\GitHub\\SERSA.SAM4S\\frontend',
    stdio: 'pipe'
  });
  console.log('✅ Frontend compiles successfully\n');
} catch (error) {
  console.log('❌ Frontend compilation failed\n');
  process.exit(1);
}

// Test 2: Check backend compilation
try {
  execSync('npm run build --silent', { 
    cwd: 'c:\\Users\\Nicol\\OneDrive\\Documentos\\GitHub\\SERSA.SAM4S\\backend',
    stdio: 'pipe'
  });
  console.log('✅ Backend compiles successfully\n');
} catch (error) {
  console.log('❌ Backend compilation failed\n');
  process.exit(1);
}

// Test 3: Check file modifications
console.log('Test 2: File Modifications');
console.log('--------------------------');

const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'frontend/src/types/index.ts',
  'frontend/src/lib/api.ts',
  'frontend/src/services/api.ts',
  'frontend/src/contexts/AuthContext.tsx',
  'backend/src/auth/strategies/jwt.strategy.ts',
  'backend/src/auth/auth.service.ts'
];

let allGood = true;

filesToCheck.forEach(file => {
  const fullPath = path.join('c:\\Users\\Nicol\\OneDrive\\Documentos\\GitHub\\SERSA.SAM4S', file);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - NOT FOUND`);
    allGood = false;
  }
});

if (!allGood) {
  console.log('\n❌ Some files are missing');
  process.exit(1);
}

console.log('\n✅ All required files exist\n');

// Test 4: Check for critical code patterns
console.log('Test 3: Code Pattern Verification');
console.log('---------------------------------');

const jwtStrategyPath = 'c:\\Users\\Nicol\\OneDrive\\Documentos\\GitHub\\SERSA.SAM4S\\backend\\src\\auth\\strategies\\jwt.strategy.ts';
const jwtContent = fs.readFileSync(jwtStrategyPath, 'utf8');

if (jwtContent.includes('payload.id === undefined')) {
  console.log('✅ JWT strategy allows id = 0');
} else if (jwtContent.includes('!payload.id')) {
  console.log('❌ JWT strategy still rejects id = 0');
  allGood = false;
} else {
  console.log('⚠️  JWT strategy validation pattern not found');
}

const authServicePath = 'c:\\Users\\Nicol\\OneDrive\\Documentos\\GitHub\\SERSA.SAM4S\\backend\\src\\auth\\auth.service.ts';
const authContent = fs.readFileSync(authServicePath, 'utf8');

if (authContent.includes('rol: user.id_rol')) {
  console.log('✅ Backend returns rol field in LoginResponse');
} else {
  console.log('⚠️  Backend rol field return not verified');
}

const typesPath = 'c:\\Users\\Nicol\\OneDrive\\Documentos\\GitHub\\SERSA.SAM4S\\frontend\\src\\types\\index.ts';
const typesContent = fs.readFileSync(typesPath, 'utf8');

if (typesContent.includes('rol: number') && typesContent.includes('interface User')) {
  console.log('✅ Frontend User interface includes rol field');
} else {
  console.log('❌ Frontend User interface missing rol field');
  allGood = false;
}

const apiTypesPath = 'c:\\Users\\Nicol\\OneDrive\\Documentos\\GitHub\\SERSA.SAM4S\\frontend\\src\\lib\\api.ts';
const apiTypesContent = fs.readFileSync(apiTypesPath, 'utf8');

if (apiTypesContent.includes('must_change_password: boolean') && apiTypesContent.includes('limite_descargas: number')) {
  console.log('✅ Frontend LoginResponse interface is correct');
} else {
  console.log('⚠️  Frontend LoginResponse interface may need updating');
}

console.log('\n' + '═'.repeat(60));
if (allGood) {
  console.log('✅ ALL VERIFICATION CHECKS PASSED');
  console.log('═'.repeat(60));
  console.log('\nNext steps:');
  console.log('1. Start the frontend: npm run dev (in frontend directory)');
  console.log('2. Start the backend: npm run start (in backend directory)');
  console.log('3. Login with admin credentials');
  console.log('4. Check DevTools localStorage for "user" with "rol" field');
  console.log('5. Navigate to /usuarios to verify role-based access');
} else {
  console.log('❌ SOME VERIFICATION CHECKS FAILED');
  console.log('═'.repeat(60));
  process.exit(1);
}
```

### Run Verification Script
```bash
cd c:\Users\Nicol\OneDrive\Documentos\GitHub\SERSA.SAM4S
node verify-rol-field.js
```

---

## Common Issues & Troubleshooting

### Issue 1: User object exists but rol is missing
**Symptom:** localStorage contains user but `user.rol` is `undefined`

**Solution:**
```javascript
// Check browser cache - clear it
// 1. F12 → Application → Clear site data
// 2. Logout and login again
// 3. Check DevTools Console:
const user = JSON.parse(localStorage.getItem('user'));
console.log(user);  // Should now have rol field
```

### Issue 2: JWT validation still rejecting id = 0
**Symptom:** Login works but returns 401 Unauthorized

**Solution:**
```bash
# 1. Verify backend code change
cd backend
grep -n "payload.id === undefined" src/auth/strategies/jwt.strategy.ts

# Expected: Should find the line with === undefined (not just !payload.id)

# 2. Rebuild backend
npm run build

# 3. Restart backend
npm run start
```

### Issue 3: User not persisting after page reload
**Symptom:** User is null after refreshing page

**Solution:**
```javascript
// Check localStorage has user data
localStorage.getItem('user')  // Should NOT be null

// If null, check AuthContext is properly initialized
// In app layout, ensure AuthProvider wraps everything

// Clear and re-login
localStorage.clear()
// Login again and reload page
```

### Issue 4: /usuarios endpoint returns 403
**Symptom:** Even with admin user, /usuarios returns "Forbidden"

**Solution:**
```javascript
// Check user.rol value
const user = JSON.parse(localStorage.getItem('user'));
console.log('User rol:', user.rol);  // Should be 1 for admin

// Check if RolesGuard is checking correct field
// Backend should check: user.rol === 1 or user.id_rol === 1
```

---

## Expected Timeline

| Step | Action | Expected Time | Status |
|------|--------|----------------|--------|
| 1 | Clear browser data | 1 min | ✅ |
| 2 | Login as admin | 1 min | ✅ |
| 3 | Check localStorage | 1 min | ✅ |
| 4 | Verify rol field exists | 1 min | ✅ |
| 5 | Test /usuarios access | 1 min | ✅ |
| 6 | Test page reload | 1 min | ✅ |
| 7 | Test logout | 1 min | ✅ |
| **Total** | | **7 min** | ✅ |

---

## Sign-off Checklist

When all tests pass, mark as complete:

- [ ] Browser data cleared
- [ ] Admin login successful
- [ ] localStorage contains user with rol field
- [ ] user.rol === 1 for admin
- [ ] /usuarios endpoint accessible
- [ ] Page reload maintains authentication
- [ ] Logout clears all data
- [ ] Frontend compiles without errors
- [ ] Backend compiles without errors
- [ ] JWT validation allows id = 0
- [ ] All type definitions match

---

## Support

If you encounter any issues:

1. Check the file: `USER-ROL-FIELD-FIX.md` for detailed technical info
2. Review error logs in DevTools Console
3. Check backend logs for JWT validation errors
4. Verify database has admin user with `id_usuario = 0` and `id_rol = 1`

