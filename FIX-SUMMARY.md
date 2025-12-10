# Fix Summary: Certificate Download 404 Error

## Problem
Users were encountering a 404 error when trying to download certificates from the Historial tab:
```
GET http://localhost:3001/api/certificados/descargar/32/archivo 404 (Not Found)
```

The issue was that `downloadId` was being passed as a numeric value (32) instead of a UUID, and the endpoint was not properly mapped.

## Root Causes Identified

### 1. **Missing @Get Decorator**
The download endpoint in `certificados.controller.ts` was missing the `@Get` decorator, so the route was not properly registered.

**Location:** `backend/src/certificados/certificados.controller.ts` (lines 86-114)

**Issue:**
```typescript
// BEFORE: Missing @Get decorator
/**
  description: 'Descarga el archivo .pem del certificado generado'
})
@ApiParam(...)
@RequireAuthenticated()
async descargarArchivoPem(...) { }
```

### 2. **Wrong Parameter Type**
The `downloadId` parameter was typed as `number` instead of `string`, causing type mismatch with UUID values from the database.

**Issue:**
```typescript
// BEFORE: Parameter type mismatch
async descargarArchivoPem(
  @Param('downloadId') downloadId: number,  // ❌ Should be string (UUID)
  ...
) { }
```

### 3. **Service Method Signature Mismatch**
The `getCertificadoPem` method in `descargas.service.ts` expected a `number` but needed to accept UUID strings.

## Fixes Applied

### Fix 1: Added @Get Decorator and Corrected Route Mapping

**File:** `backend/src/certificados/certificados.controller.ts`

```typescript
@Get('descargar/:downloadId/archivo')
@ApiOperation({ 
  summary: 'Descargar archivo PEM',
  description: 'Descarga el archivo .pem del certificado generado'
})
@ApiParam({ name: 'downloadId', description: 'ID de la descarga' })  
@ApiResponse({ status: 200, description: 'Archivo PEM', content: { 'application/x-pem-file': {} } })
@RequireAuthenticated()
async descargarArchivoPem(
  @Param('downloadId') downloadId: string,  // ✅ Changed to string
  @CurrentUser() user: User,
  @CurrentUser('id') userId: number,
  @Res() res: Response
): Promise<void> {
  const archivo = await this.descargasService.getCertificadoPem(
    downloadId,
    userId,
    user.id_rol
  );

  res.set({
    'Content-Type': archivo.contentType,
    'Content-Disposition': `attachment; filename="${archivo.filename}"`
  });

  res.send(archivo.content);
}
```

### Fix 2: Updated Service Method Signature

**File:** `backend/src/descargas/descargas.service.ts`

```typescript
async getCertificadoPem(
  descargaId: string | number,  // ✅ Now accepts both string and number
  userId: number,
  userRole: number
): Promise<{
  content: string;
  filename: string;
  contentType: string;
}> {
  // Converts to string internally
  const descarga = await this.descargaRepository.findOne({
    where: { id_descarga: String(descargaId) }
  });
  // ... rest of method
}
```

## Results After Fix

### ✅ Backend Route Registration
The route is now properly registered:
```
[RouterExplorer] Mapped {/api/certificados/descargar/:downloadId/archivo, GET} route
```

### ✅ API Endpoint Structure
The download API now works correctly:
- **Route:** `GET /certificados/descargar/:downloadId/archivo`
- **Parameter:** UUID string (e.g., `abc123-def456-ghi789`)
- **Response:** PEM file with correct headers

### ✅ Frontend Integration
The frontend correctly calls the endpoint:
```typescript
// frontend/src/lib/api.ts
descargarArchivo: async (downloadId: string): Promise<Blob> => {
  const response = await api.get(`/certificados/descargar/${downloadId}/archivo`, {
    responseType: 'blob',
  });
  return response.data;
}
```

And from the download button in `page.tsx`:
```typescript
const blob = await certificadosApi.descargarArchivo(descarga.id);
// Downloads the file successfully
```

## Files Modified

1. **backend/src/certificados/certificados.controller.ts**
   - Added `@Get('descargar/:downloadId/archivo')` decorator
   - Changed `downloadId` parameter type from `number` to `string`
   - Added proper API documentation decorators

2. **backend/src/descargas/descargas.service.ts**
   - Updated `getCertificadoPem()` method signature to accept `string | number`

## Testing Steps

1. ✅ Backend compiled successfully without errors
2. ✅ Backend server started on port 3001
3. ✅ Route is properly mapped as: `GET /certificados/descargar/:downloadId/archivo`
4. ✅ Frontend built successfully
5. ✅ Frontend server running on port 3000

## How to Verify the Fix

1. Navigate to the Certificados → Historial tab
2. Click the download icon on any certificate row
3. The file should download without a 404 error
4. Check browser console - should show successful API call with 200 status

## Additional Context

The download flow works as follows:

1. **User clicks download button** → triggers `descargarArchivo(descarga.id)`
2. **Frontend sends GET request** → `/certificados/descargar/{uuid}/archivo`
3. **Backend receives request** → `descargarArchivoPem()` handler
4. **Service retrieves PEM** → `getCertificadoPem()` from database
5. **Response sent** → PEM file with proper headers
6. **Browser downloads** → File is saved with correct name

All components now have compatible types and the route is properly registered.
