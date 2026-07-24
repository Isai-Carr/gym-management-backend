# Oasis Training Center — API Documentation

**Base URL:** `http://localhost:3000/api/v1`  
**Autenticación:** Bearer Token (JWT) en el header `Authorization: Bearer <token>`  
**Formato:** JSON en todos los requests y responses  
**Versión:** 1.0.0

---

## Convenciones

| Símbolo | Significado |
|---------|-------------|
| 🔓 Público | No requiere token |
| 🔑 Auth | Requiere token (ADMIN o CLIENT) |
| 👑 Solo ADMIN | Solo accesible con token de administrador |
| 👤 Solo CLIENT | Solo accesible con token de cliente |

Todos los responses exitosos siguen esta estructura:
```json
{
  "success": true,
  "statusCode": 200,
  "data": { ... }
}
```
Los errores siguen:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Descripción del error",
  "path": "/api/v1/ruta",
  "method": "POST",
  "timestamp": "2026-06-12T18:00:00.000Z"
}
```

---

## 1. HEALTH

### `GET /health` 🔓 Público

Verifica que el servidor esté activo. Útil para saber si el backend está corriendo antes de hacer cualquier llamada.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-12T18:00:00.000Z"
}
```

---

## 2. AUTH

### `POST /auth/login` 🔓 Público

Inicia sesión. Devuelve los tokens de acceso. El frontend debe guardar `accessToken` (corta duración, 1 día) y `refreshToken` (7 días).

Si `mustChangePassword` es `true`, el usuario debe ser redirigido a la pantalla de cambio de contraseña antes de continuar.

**Body:**
```json
{
  "email": "admin@oasisgym.com",
  "password": "Admin1234!"
}
```

**Response:**
```json
{
  "data": {
    "message": "Login successful",
    "mustChangePassword": false,
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "email": "admin@oasisgym.com",
      "role": "ADMIN",
      "isActive": true,
      "mustChangePassword": false,
      "avatar": null,
      "client": null
    }
  }
}
```

> **Nota:** Si `role` es `CLIENT`, el objeto `user.client` contendrá `id`, `firstName`, `lastName`, `phone`, `address`, `birthDate`, `avatarUrl`.

---

### `POST /auth/refresh` 🔓 Público

Renueva el `accessToken` cuando expira, usando el `refreshToken`. El frontend debe llamar esto automáticamente al recibir un error 401.

**Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response:**
```json
{
  "data": {
    "accessToken": "eyJhbGci..."
  }
}
```

---

### `POST /auth/logout` 🔑 Auth

Invalida el `refreshToken` del dispositivo actual.

**Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response:**
```json
{
  "data": { "message": "Logout successful" }
}
```

---

### `GET /auth/profile` 🔑 Auth

Devuelve el perfil completo del usuario autenticado, incluyendo su membresía activa si es CLIENT.

**Headers:** `Authorization: Bearer <token>`

**Response (ADMIN):**
```json
{
  "data": {
    "id": "uuid",
    "email": "admin@oasisgym.com",
    "role": "ADMIN",
    "isActive": true,
    "mustChangePassword": false,
    "avatar": null,
    "client": null
  }
}
```

**Response (CLIENT):**
```json
{
  "data": {
    "id": "uuid",
    "email": "cliente@email.com",
    "role": "CLIENT",
    "mustChangePassword": false,
    "avatar": null,
    "client": {
      "id": "uuid",
      "firstName": "Eduardo",
      "lastName": "Camarena",
      "phone": "4495406895",
      "address": "Calle Universidad 101, Aguascalientes",
      "birthDate": "2004-06-12T00:00:00.000Z",
      "avatarUrl": null,
      "memberships": [
        {
          "id": "uuid",
          "status": "ACTIVE",
          "startDate": "2026-06-12T00:00:00.000Z",
          "endDate": "2026-07-12T00:00:00.000Z",
          "plan": {
            "name": "Ilimitado",
            "price": 1200,
            "duration": 30
          }
        }
      ]
    }
  }
}
```

---

### `POST /auth/change-password` 🔑 Auth

Cambia la contraseña del usuario autenticado. **Obligatorio** en el primer login cuando `mustChangePassword: true`.

**Body:**
```json
{
  "currentPassword": "contraseñaActual",
  "newPassword": "nuevaContraseña123!"
}
```

**Response:**
```json
{
  "data": { "message": "Password changed successfully" }
}
```

---

### `POST /auth/register-admin` 👑 Solo ADMIN

Crea un nuevo administrador. La contraseña se genera automáticamente (7 dígitos) y se envía al email indicado. El admin nuevo recibirá un correo con sus credenciales y deberá cambiar la contraseña en su primer login.

**Body:**
```json
{
  "firstName": "Carlos",
  "lastName": "López",
  "email": "carlos@oasisgym.com",
  "phone": "4491234567"
}
```

**Response:**
```json
{
  "data": {
    "message": "Admin registered successfully",
    "user": {
      "id": "uuid",
      "email": "carlos@oasisgym.com",
      "role": "ADMIN",
      "mustChangePassword": true
    }
  }
}
```

---

### `POST /auth/forgot-password` 🔓 Público

Solicita un link de recuperación de contraseña al email indicado. El link tiene vigencia de 1 hora.

**Body:**
```json
{
  "email": "cliente@email.com"
}
```

**Response:**
```json
{
  "data": { "message": "If the email exists, a reset link has been sent" }
}
```

---

### `POST /auth/reset-password` 🔓 Público

Establece una nueva contraseña usando el token del email de recuperación.

**Body:**
```json
{
  "token": "abc123tokenDelEmail",
  "password": "nuevaContraseña123!"
}
```

**Response:**
```json
{
  "data": { "message": "Password reset successful" }
}
```

---

## 3. CLIENTS

### `POST /clients/register` 👑 Solo ADMIN

**Endpoint principal del formulario de registro de 4 páginas.**

Crea al cliente, asigna su membresía y registra el pago en una sola llamada atómica. Si algo falla, nada queda guardado. Envía el email de bienvenida con contraseña automática al cliente.

**Body:**
```json
{
  "firstName": "Eduardo",
  "lastName": "Camarena",
  "email": "eduardo@email.com",
  "phone": "4495406895",

  "planId": "uuid-del-plan-seleccionado",
  "startDate": "2026-06-12",
  "activityId": null,

  "months": 3,
  "discount": 100,
  "paymentMethod": "CASH",
  "transactionId": null,
  "notes": "Estudiante UTR"
}
```

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `firstName` | ✅ | Nombre |
| `lastName` | ✅ | Apellido |
| `email` | ✅ | Email único |
| `phone` | ❌ | Teléfono |
| `planId` | ✅ | ID del plan elegido en página 2 |
| `startDate` | ❌ | Fecha inicio (default: hoy) |
| `activityId` | ❌ | Actividad específica opcional |
| `months` | ❌ | Cantidad de meses a cobrar (default: 1). El precio se calcula como `plan.price × months` |
| `discount` | ❌ | Ajuste manual (default: 0). Positivo = descuento (se resta), negativo = incremento (se suma) |
| `paymentMethod` | ✅ | `CASH` \| `TRANSFER` \| `TERMINAL` |
| `transactionId` | ❌ | ID de operación (para transferencias) |
| `notes` | ❌ | Notas adicionales |

> **Nota:** `amount` ya no se envía — el monto final lo calcula el servidor (`plan.price × months - discount`) para que el precio base, el ajuste y el precio final nunca queden inconsistentes entre sí.

**Response:**
```json
{
  "data": {
    "message": "Client registered successfully",
    "user": {
      "id": "uuid",
      "email": "eduardo@email.com",
      "role": "CLIENT",
      "mustChangePassword": true,
      "client": {
        "id": "uuid-client",
        "firstName": "Eduardo",
        "lastName": "Camarena",
        "phone": "4495406895"
      }
    },
    "membership": {
      "id": "uuid-membership",
      "status": "ACTIVE",
      "startDate": "2026-06-12T00:00:00.000Z",
      "endDate": "2026-09-12T00:00:00.000Z",
      "months": 3,
      "plan": { "name": "Ilimitado", "price": 700, "duration": 30 }
    },
    "payment": {
      "id": "uuid-payment",
      "amount": 2000,
      "baseAmount": 2100,
      "discount": 100,
      "months": 3,
      "paymentMethod": "CASH",
      "status": "APPROVED",
      "paidAt": "2026-06-12T18:00:00.000Z"
    }
  }
}
```

---

### `POST /clients` 👑 Solo ADMIN

Crea un cliente sin membresía ni pago. Útil cuando el cliente se registra pero el pago o plan se asigna después.

**Body:**
```json
{
  "firstName": "María",
  "lastName": "García",
  "email": "maria@email.com",
  "phone": "4499876543"
}
```

**Response:**
```json
{
  "data": {
    "message": "Client created successfully",
    "user": {
      "id": "uuid",
      "email": "maria@email.com",
      "role": "CLIENT",
      "mustChangePassword": true,
      "client": {
        "id": "uuid-client",
        "firstName": "María",
        "lastName": "García",
        "phone": "4499876543"
      }
    }
  }
}
```

---

### `GET /clients` 👑 Solo ADMIN

Lista todos los clientes con paginación y búsqueda por nombre.

**Query params:**
| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `page` | number | 1 | Página |
| `limit` | number | 10 | Resultados por página |
| `search` | string | - | Busca por nombre o apellido |
| `sortBy` | string | `createdAt` | Campo de orden |
| `order` | `asc`\|`desc` | `desc` | Dirección |

**Ejemplo:** `GET /clients?page=1&limit=10&search=Eduardo`

**Response:**
```json
{
  "data": {
    "data": [
      {
        "id": "uuid-client",
        "firstName": "Eduardo",
        "lastName": "Camarena",
        "phone": "4495406895",
        "address": null,
        "birthDate": null,
        "avatarUrl": null,
        "createdAt": "2026-06-12T00:00:00.000Z",
        "user": {
          "email": "eduardo@email.com",
          "role": "CLIENT",
          "isActive": true
        }
      }
    ],
    "meta": {
      "total": 7,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

### `GET /clients/:id` 👑 Solo ADMIN

Detalle completo de un cliente incluyendo sus membresías.

**Response:**
```json
{
  "data": {
    "id": "uuid-client",
    "firstName": "Eduardo",
    "lastName": "Camarena",
    "phone": "4495406895",
    "address": "Ciudad Universitaria, Aguascalientes",
    "birthDate": "2004-06-12T00:00:00.000Z",
    "avatarUrl": null,
    "user": {
      "email": "eduardo@email.com",
      "role": "CLIENT",
      "isActive": true,
      "createdAt": "2026-06-12T00:00:00.000Z"
    },
    "memberships": [
      {
        "id": "uuid",
        "status": "ACTIVE",
        "startDate": "2026-06-12T00:00:00.000Z",
        "endDate": "2026-07-12T00:00:00.000Z",
        "plan": { "name": "Ilimitado", "price": 1200 }
      }
    ]
  }
}
```

---

### `PATCH /clients/:id` 👑 Solo ADMIN

Actualiza datos del cliente (teléfono, notas, etc.).

**Body:**
```json
{
  "phone": "4491112233"
}
```

---

### `DELETE /clients/:id` 👑 Solo ADMIN

Desactiva al cliente (soft delete — no se borra de la base de datos, solo se marca como inactivo). El cliente ya no podrá hacer login.

**Response:**
```json
{
  "data": { "message": "Client deactivated successfully" }
}
```

---

### `GET /clients/:id/payments` 👑 Solo ADMIN

Historial de pagos de un cliente específico.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "amount": 1200,
      "paymentMethod": "CASH",
      "status": "APPROVED",
      "paidAt": "2026-06-12T00:00:00.000Z",
      "membership": {
        "plan": { "name": "Ilimitado" }
      }
    }
  ]
}
```

---

### `GET /clients/:id/attendance` 👑 Solo ADMIN

Historial de asistencias de un cliente.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "checkIn": "2026-06-12T09:00:00.000Z",
      "activity": { "name": "CrossFit" }
    }
  ]
}
```

---

## 4. ACTIVITIES

### `POST /activities` 👑 Solo ADMIN

Crea una nueva actividad disponible en el gimnasio.

**Body:**
```json
{
  "name": "CrossFit",
  "description": "Entrenamiento funcional de alta intensidad"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "CrossFit",
    "description": "Entrenamiento funcional de alta intensidad",
    "isActive": true,
    "createdAt": "2026-06-12T00:00:00.000Z"
  }
}
```

---

### `GET /activities` 🔑 Auth

Lista todas las actividades activas. Visible para ADMIN y CLIENT.

**Response:**
```json
{
  "data": [
    { "id": "uuid", "name": "CrossFit", "description": "...", "isActive": true },
    { "id": "uuid", "name": "Yoga", "description": "...", "isActive": true }
  ]
}
```

---

### `GET /activities/:id` 🔑 Auth

Detalle de una actividad.

---

### `PATCH /activities/:id` 👑 Solo ADMIN

Actualiza una actividad.

**Body:**
```json
{
  "description": "Nueva descripción",
  "isActive": false
}
```

---

### `DELETE /activities/:id` 👑 Solo ADMIN

Elimina una actividad.

---

## 5. MEMBERSHIPS

### `POST /memberships/plans` 👑 Solo ADMIN

Crea un nuevo plan de membresía.

**Body:**
```json
{
  "name": "Mensual",
  "description": "Acceso ilimitado por 30 días",
  "price": 1200,
  "duration": 30
}
```

> `duration` es en **días**.

---

### `GET /memberships/plans` 🔑 Auth

Lista todos los planes. CLIENT lo usa para la selección en la pantalla de membresías.

**Query params:** `?active=true` para ver solo los planes activos.

**Response:**
```json
{
  "data": [
    { "id": "uuid", "name": "Ilimitado", "price": 1200, "duration": 30, "isActive": true },
    { "id": "uuid", "name": "Bonos", "price": 600, "duration": 90, "isActive": true }
  ]
}
```

---

### `PATCH /memberships/plans/:id` 👑 Solo ADMIN

Actualiza precio, nombre o descripción de un plan.

**Body:**
```json
{
  "price": 1300,
  "description": "Nueva descripción"
}
```

---

### `DELETE /memberships/plans/:id` 👑 Solo ADMIN

Elimina un plan. **Falla si hay membresías activas usando ese plan.**

---

### `POST /memberships` 👑 Solo ADMIN

Asigna manualmente una membresía a un cliente existente (sin pago).

**Body:**
```json
{
  "clientId": "uuid-del-cliente",
  "planId": "uuid-del-plan",
  "startDate": "2026-06-12T00:00:00.000Z",
  "endDate": "2026-07-12T00:00:00.000Z",
  "activityId": null
}
```

---

### `GET /memberships` 👑 Solo ADMIN

Lista todas las membresías. Filtrable por status.

**Query params:** `?status=ACTIVE` | `EXPIRED` | `SUSPENDED` | `CANCELLED`

---

### `GET /memberships/active` 👑 Solo ADMIN

Todas las membresías activas (no vencidas).

---

### `GET /memberships/expired` 👑 Solo ADMIN

Membresías vencidas.

---

### `GET /memberships/my` 👤 Solo CLIENT

Devuelve la membresía activa del cliente autenticado.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "status": "ACTIVE",
    "startDate": "2026-06-12T00:00:00.000Z",
    "endDate": "2026-07-12T00:00:00.000Z",
    "plan": {
      "name": "Ilimitado",
      "price": 1200,
      "duration": 30,
      "description": "Acceso ilimitado"
    },
    "activity": null
  }
}
```

> Devuelve `null` si el cliente no tiene membresía activa vigente.

---

### `GET /memberships/client/:clientId` 👑 Solo ADMIN

Historial de todas las membresías de un cliente.

---

### `GET /memberships/:id` 👑 Solo ADMIN

Detalle de una membresía específica.

---

### `PATCH /memberships/:id/suspend` 👑 Solo ADMIN

Suspende una membresía activa.

**Response:**
```json
{
  "data": { "id": "uuid", "status": "SUSPENDED" }
}
```

---

### `PATCH /memberships/:id/renew` 👑 Solo ADMIN

Reactiva y renueva una membresía. Si se envía `paymentMethod`, además registra el cobro de la renovación de forma atómica (mismo caso de uso que el mostrador de recepción: cliente existente que paga por más tiempo, a veces con promoción o cambio de plan).

**Body (todo opcional):**
```json
{
  "planId": "uuid-del-plan",
  "months": 1,
  "discount": 0,
  "startDate": "2026-07-15",
  "paymentMethod": "CASH",
  "transactionId": null,
  "notes": "Renovación en recepción"
}
```

| Campo | Descripción |
|-------|-------------|
| `planId` | Cambiar de plan al renovar. Default: el plan actual |
| `months` | Cantidad de meses a renovar. Default: 1. Precio sugerido = `plan.price × months` |
| `discount` | Ajuste manual. Positivo = descuento (se resta), negativo = incremento (se suma) |
| `startDate` | Fecha de inicio. Default: hoy o el vencimiento actual, lo que sea más tarde |
| `paymentMethod` | `CASH` \| `TERMINAL`. Si se omite, la membresía se extiende **sin cobro** (renovación de cortesía) y no se crea ningún `Payment`. `TRANSFER` no se acepta aquí — usar `POST /payments/transfer` para ese método |
| `transactionId` / `notes` | Opcionales, solo aplican si se envía `paymentMethod` |

> Si no se envía nada en el body, se comporta como antes: renueva 1 mes usando la duración del plan actual, sin cobro.

---

## 6. PAYMENTS

### `POST /clients/register` (ver sección Clients)

Para registrar pago junto con el cliente, usar `POST /clients/register`.

---

### `POST /payments` 👑 Solo ADMIN

Registra un pago manualmente para una membresía existente. Requiere especificar el método de pago.

**Body:**
```json
{
  "membershipId": "uuid-membresía",
  "amount": 1200,
  "paymentMethod": "CASH",
  "transactionId": null,
  "notes": "Pago en recepción"
}
```

> `paymentMethod`: `CASH` | `TRANSFER` | `TERMINAL`

---

### `POST /payments/cash` 👑 Solo ADMIN

Registra un pago en efectivo. No requiere especificar `paymentMethod` (se asigna automáticamente). Estado final: `APPROVED`.

**Body:**
```json
{
  "membershipId": "uuid-membresía",
  "amount": 1200,
  "notes": "Pago en caja"
}
```

---

### `POST /payments/terminal` 👑 Solo ADMIN

Registra un pago con terminal bancaria. Estado final: `APPROVED`.

**Body:**
```json
{
  "membershipId": "uuid-membresía",
  "amount": 1200,
  "transactionId": "TXN-00123"
}
```

---

### `POST /payments/transfer` 🔑 Auth

El cliente sube el comprobante de transferencia. Estado inicial: `PENDING` (requiere aprobación del admin). Se sube como `multipart/form-data`.

**Form fields:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `membershipId` | string | ID de la membresía |
| `amount` | number | Monto de la transferencia. Requerido si no se envía `months` |
| `months` | number (opcional) | Cantidad de meses que cubre este pago (renovación). Si se envía, el monto se calcula como `plan.price × months` ajustado por `discount`, **y la membresía se extiende automáticamente al aprobar el pago** (no al subir el comprobante) |
| `discount` | number (opcional) | Ajuste manual sobre el precio calculado. Solo aplica si se envía `months` |
| `notes` | string (opcional) | Observaciones |
| `voucher` | archivo | Imagen o PDF del comprobante (max 5MB) |

---

### `PATCH /payments/approve/:id` 👑 Solo ADMIN

Aprueba un pago en estado `PENDING`. Solo aplica a transferencias. Envía email de confirmación al cliente. Si el pago tenía `months` (transferencia de renovación), la membresía se extiende en este momento.

**Nota:** El pago debe estar en estado `PENDING`.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "status": "APPROVED",
    "paidAt": "2026-06-12T18:00:00.000Z"
  }
}
```

---

### `PATCH /payments/reject/:id` 👑 Solo ADMIN

Rechaza un pago en estado `PENDING`. Envía email de rechazo al cliente. Si este era el único pago aprobable de la membresía (p. ej. el pago fundador), la membresía se suspende. Si la membresía ya tenía otro pago `APPROVED` (p. ej. se rechaza una transferencia de *renovación* sobre una membresía ya vigente), la membresía **no** se suspende — el cliente conserva el tiempo que ya había pagado.

**Body (opcional):**
```json
{
  "reason": "El monto no coincide con el plan"
}
```

---

### `GET /payments` 👑 Solo ADMIN

Lista todos los pagos. Filtrable por status.

**Query params:** `?status=PENDING` | `APPROVED` | `REJECTED` | `REFUNDED`

---

### `GET /payments/pending` 👑 Solo ADMIN

Pagos pendientes de aprobación (transferencias sin revisar).

---

### `GET /payments/:id` 👑 Solo ADMIN

Detalle de un pago.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "amount": 1200,
    "paymentMethod": "TRANSFER",
    "status": "PENDING",
    "voucherUrl": "/storage/payments/abc.jpg",
    "transactionId": null,
    "paidAt": null,
    "membership": {
      "plan": { "name": "Ilimitado" },
      "client": { "firstName": "Eduardo", "lastName": "Camarena" }
    }
  }
}
```

---

### `PATCH /payments/:id/status` 👑 Solo ADMIN

Cambia el estado de un pago manualmente.

**Body:**
```json
{
  "status": "APPROVED",
  "transactionId": "TXN-456",
  "notes": "Verificado manualmente"
}
```

---

## 7. ATTENDANCE

### `POST /attendance/check-in` 🔑 Auth

Registra la entrada al gimnasio.

- **ADMIN:** puede registrar la asistencia de cualquier cliente enviando `clientId`.
- **CLIENT:** el `clientId` se toma automáticamente del token (aunque se envíe otro valor, es ignorado).

**Body:**
```json
{
  "clientId": "uuid-del-cliente",
  "activityId": "uuid-actividad-opcional",
  "checkIn": "2026-06-12T09:00:00.000Z"
}
```

> `activityId` y `checkIn` son opcionales. Si no se envía `checkIn`, se usa la hora actual.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "clientId": "uuid-cliente",
    "checkIn": "2026-06-12T09:00:00.000Z",
    "activity": null
  }
}
```

---

### `GET /attendance` 👑 Solo ADMIN

Lista todas las asistencias registradas.

---

### `GET /attendance/client/:id` 👑 Solo ADMIN

Historial de asistencias de un cliente específico.

---

## 8. CLASSES

### `POST /classes` 👑 Solo ADMIN

Crea una clase con horario y cupo.

**Body:**
```json
{
  "name": "CrossFit Matutino",
  "description": "Clase de alta intensidad",
  "capacity": 20,
  "startTime": "2026-06-13T09:00:00.000Z",
  "endTime": "2026-06-13T10:00:00.000Z"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "CrossFit Matutino",
    "capacity": 20,
    "startTime": "2026-06-13T09:00:00.000Z",
    "endTime": "2026-06-13T10:00:00.000Z",
    "isActive": true
  }
}
```

---

### `GET /classes` 🔑 Auth

Lista todas las clases (activas e inactivas).

---

### `GET /classes/schedule` 🔑 Auth

Horario de clases activas. El CLIENT usa este endpoint para ver qué clases puede reservar.

**Response:**
```json
{
  "data": {
    "classes": [
      {
        "id": "uuid",
        "name": "CrossFit Matutino",
        "capacity": 20,
        "startTime": "2026-06-13T09:00:00.000Z",
        "endTime": "2026-06-13T10:00:00.000Z",
        "reservationsCount": 5,
        "availableSpots": 15
      }
    ]
  }
}
```

---

### `GET /classes/:id` 🔑 Auth

Detalle de una clase.

---

### `PATCH /classes/:id` 👑 Solo ADMIN

Actualiza datos de una clase (nombre, cupo, horario, estado).

**Body:**
```json
{
  "capacity": 25,
  "isActive": true
}
```

---

### `DELETE /classes/:id` 👑 Solo ADMIN

Elimina una clase. **Falla si la clase tiene reservas activas.** Se deben cancelar primero.

**Error si tiene reservas:**
```json
{
  "statusCode": 400,
  "message": "Cannot delete class: it has 3 active reservation(s). Cancel them first."
}
```

---

## 9. RESERVATIONS

### `POST /reservations` 🔑 Auth

Reserva un lugar en una clase.

- **CLIENT:** el `clientId` se asigna automáticamente del token (el campo enviado es ignorado).
- **ADMIN:** puede crear reservas para cualquier cliente.

**Body:**
```json
{
  "clientId": "cualquier-valor",
  "classId": "uuid-de-la-clase"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "clientId": "uuid-cliente-real",
    "classId": "uuid-clase",
    "createdAt": "2026-06-12T18:00:00.000Z"
  }
}
```

> Si el cliente ya tiene reserva en esa clase, devuelve error 409.

---

### `GET /reservations` 👑 Solo ADMIN

Lista todas las reservas.

---

### `GET /reservations/client/:id` 👑 Solo ADMIN

Reservas de un cliente específico.

---

### `DELETE /reservations/:id` 🔑 Auth

Cancela una reserva. El cliente solo puede cancelar las suyas.

---

## 10. PERSONAL RECORDS

### `POST /personal-records` 🔑 Auth

Registra un récord personal de ejercicio.

**Body:**
```json
{
  "exercise": "Sentadilla",
  "weight": 120,
  "unit": "KG",
  "notes": "Nuevo récord personal"
}
```

> `unit`: `KG` | `LB`

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "exercise": "Sentadilla",
    "weight": 120,
    "unit": "KG",
    "recordedAt": "2026-06-12T18:00:00.000Z",
    "notes": "Nuevo récord personal"
  }
}
```

---

### `GET /personal-records/my` 🔑 Auth

Todos los récords del usuario autenticado, ordenados por fecha.

---

### `GET /personal-records/my/best` 🔑 Auth

El mejor récord por cada ejercicio (el peso más alto registrado).

**Response:**
```json
{
  "data": [
    { "exercise": "Sentadilla", "weight": 120, "unit": "KG", "recordedAt": "2026-06-12T..." },
    { "exercise": "Peso Muerto", "weight": 140, "unit": "KG", "recordedAt": "2026-06-01T..." }
  ]
}
```

---

### `GET /personal-records/admin` 👑 Solo ADMIN

Todos los récords de todos los clientes.

---

### `GET /personal-records/client/:clientId` 👑 Solo ADMIN

Récords de un cliente específico.

---

### `GET /personal-records/:id` 🔑 Auth

Detalle de un récord.

---

### `PATCH /personal-records/:id` 🔑 Auth

Actualiza un récord (peso, notas, etc.).

**Body:**
```json
{
  "weight": 125,
  "notes": "Con cinturón"
}
```

---

### `DELETE /personal-records/:id` 🔑 Auth

Elimina un récord personal.

---

## 11. INVENTORY

> Todos los endpoints de inventario son exclusivos del ADMIN.

### `POST /inventory` 👑 Solo ADMIN

Agrega un artículo al inventario.

**Body:**
```json
{
  "name": "Barra Olímpica",
  "type": "EQUIPMENT",
  "category": "Pesas",
  "description": "Barra de 20kg estándar",
  "quantity": 10,
  "minStock": 2,
  "price": 3500,
  "status": "AVAILABLE",
  "purchaseDate": "2026-01-15",
  "maintenanceRequired": false,
  "notes": "Proveedor: GymPro"
}
```

| `type` | Descripción |
|--------|-------------|
| `EQUIPMENT` | Equipo (máquinas, barras, etc.) |
| `PRODUCT` | Producto de venta (suplementos, ropa, etc.) |

| `status` | Descripción |
|----------|-------------|
| `AVAILABLE` | Disponible |
| `IN_MAINTENANCE` | En mantenimiento |
| `DAMAGED` | Dañado |
| `RETIRED` | Retirado |

---

### `GET /inventory` 👑 Solo ADMIN

Lista todo el inventario. Filtrable por tipo y estado.

**Query params:** `?type=EQUIPMENT&status=AVAILABLE`

---

### `GET /inventory/maintenance` 👑 Solo ADMIN

Artículos en estado `IN_MAINTENANCE`.

---

### `GET /inventory/:id` 👑 Solo ADMIN

Detalle de un artículo.

---

### `PATCH /inventory/:id` 👑 Solo ADMIN

Actualiza un artículo del inventario.

**Body:**
```json
{
  "quantity": 8,
  "status": "IN_MAINTENANCE",
  "maintenanceRequired": true,
  "notes": "Revisión programada"
}
```

---

### `DELETE /inventory/:id` 👑 Solo ADMIN

Elimina un artículo del inventario.

---

### `POST /inventory/upload-image` 👑 Solo ADMIN

Sube una imagen para un artículo. Usar `multipart/form-data`.

**Form fields:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `itemId` | string | ID del artículo |
| `image` | archivo | JPG, PNG o WEBP (max 5MB) |

---

### `PATCH /inventory/update-image/:id` 👑 Solo ADMIN

Reemplaza la imagen de un artículo. `multipart/form-data`.

---

### `DELETE /inventory/delete-image/:id` 👑 Solo ADMIN

Elimina la imagen de un artículo.

---

## 12. REPORTS

> Todos los reportes son exclusivos del ADMIN. No requieren body.

### `GET /reports/dashboard` 👑 Solo ADMIN

Resumen general del gimnasio: clientes activos, membresías, ingresos del mes, asistencias de hoy.

**Response:**
```json
{
  "data": {
    "totalActiveClients": 45,
    "totalActiveMemberships": 38,
    "monthlyRevenue": 48000,
    "todayAttendance": 12,
    "pendingPayments": 3,
    "expiringMemberships": 5
  }
}
```

---

### `GET /reports/monthly-income` 👑 Solo ADMIN

Ingresos del mes actual.

---

### `GET /reports/revenue` 👑 Solo ADMIN

Ingresos totales históricos.

---

### `GET /reports/active-memberships` 👑 Solo ADMIN

Lista de membresías activas con detalle del cliente y plan.

---

### `GET /reports/expired-memberships` 👑 Solo ADMIN

Membresías que ya vencieron.

---

### `GET /reports/expiring-memberships` 👑 Solo ADMIN

Membresías que vencen en los próximos 7 días. Útil para contactar clientes.

---

### `GET /reports/attendance` 👑 Solo ADMIN

Reporte de asistencias con totales por día/cliente.

---

### `GET /reports/active-clients` 👑 Solo ADMIN

Clientes con cuenta activa.

---

### `GET /reports/inactive-clients` 👑 Solo ADMIN

Clientes desactivados.

---

### `GET /reports/payments` 👑 Solo ADMIN

Reporte completo de pagos.

---

### `GET /reports/pending-payments` 👑 Solo ADMIN

Pagos pendientes de aprobación.

---

### `GET /reports/users-by-activity` 👑 Solo ADMIN

Cuántos usuarios hay por actividad.

---

### `GET /reports/equipment-maintenance` 👑 Solo ADMIN

Equipos en mantenimiento o con mantenimiento requerido.

---

### `GET /reports/low-stock` 👑 Solo ADMIN

Artículos de inventario cuya cantidad está por debajo del mínimo configurado.

---

## 13. NOTIFICATIONS

### `POST /notifications` 👑 Solo ADMIN

Crea una notificación para un usuario específico dentro de la app.

**Body:**
```json
{
  "userId": "uuid-del-usuario",
  "title": "Tu membresía vence pronto",
  "message": "Tu membresía Ilimitado vence el 12 de julio. Renueva para seguir entrenando."
}
```

---

### `POST /notifications/send-expiration-warning` 👑 Solo ADMIN

Envía notificaciones y emails automáticamente a todos los clientes cuya membresía vence en los próximos 7 días.

**Body:** ninguno.

---

### `GET /notifications` 👑 Solo ADMIN

Lista todas las notificaciones del sistema.

---

### `GET /notifications/my` 🔑 Auth

Notificaciones del usuario autenticado.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Bienvenido",
      "message": "Tu cuenta ha sido creada.",
      "isRead": false,
      "createdAt": "2026-06-12T18:00:00.000Z"
    }
  ]
}
```

---

### `PATCH /notifications/:id/read` 🔑 Auth

Marca una notificación específica como leída.

**Response:**
```json
{
  "data": { "id": "uuid", "isRead": true }
}
```

---

### `PATCH /notifications/read-all/me` 🔑 Auth

Marca todas las notificaciones del usuario autenticado como leídas.

---

## 14. USERS

### `GET /users` 👑 Solo ADMIN

Lista todos los usuarios del sistema con paginación.

**Query params:** `?page=1&limit=10`

**Response:**
```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "email": "cliente@email.com",
        "role": "CLIENT",
        "isActive": true,
        "mustChangePassword": false,
        "avatar": null,
        "createdAt": "2026-06-12T00:00:00.000Z",
        "client": {
          "id": "uuid",
          "firstName": "Eduardo",
          "lastName": "Camarena",
          "phone": "4495406895"
        }
      }
    ],
    "meta": { "total": 9, "page": 1, "limit": 10, "totalPages": 1 }
  }
}
```

---

### `GET /users/profile` 🔑 Auth

Perfil del usuario autenticado (datos del cliente si aplica).

**Response:** ver `GET /auth/profile` (misma estructura).

---

### `PATCH /users/profile` 🔑 Auth

Actualiza los datos personales del perfil (solo funciona para usuarios con perfil CLIENT).

**Body:**
```json
{
  "firstName": "Eduardo",
  "lastName": "Camarena",
  "phone": "4495406895",
  "address": "Av. Héroe de Nacozari 301, Aguascalientes",
  "birthDate": "2004-06-12"
}
```

> Todos los campos son opcionales. Solo enviar los que se quieran actualizar.

**Response:**
```json
{
  "data": {
    "id": "uuid-client",
    "firstName": "Eduardo",
    "lastName": "Camarena",
    "phone": "4495406895",
    "address": "Av. Héroe de Nacozari 301, Aguascalientes",
    "birthDate": "2004-06-12T00:00:00.000Z",
    "avatarUrl": null,
    "updatedAt": "2026-06-12T18:00:00.000Z"
  }
}
```

---

### `POST /users/upload-profile-image` 🔑 Auth

Sube o reemplaza la foto de perfil del usuario autenticado. Usar `multipart/form-data`.

**Form fields:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `avatar` | archivo | JPG, PNG o WEBP (max 5MB) |

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "email": "cliente@email.com",
    "avatar": "/storage/profiles/abc123.jpg"
  }
}
```

---

### `GET /users/:id` 👑 Solo ADMIN

Detalle de un usuario por su ID de usuario (no el clientId).

---

### `PATCH /users/:id` 👑 Solo ADMIN

Cambia el rol o estado activo de un usuario.

**Body:**
```json
{
  "isActive": false
}
```

o

```json
{
  "role": "ADMIN"
}
```

---

## 15. UPLOADS (Archivos estáticos)

Los archivos subidos son accesibles directamente desde el servidor:

| Tipo | URL de acceso |
|------|---------------|
| Foto de perfil | `http://localhost:3000/storage/profiles/<filename>` |
| Voucher de pago | `http://localhost:3000/storage/payments/<filename>` |
| Imagen de inventario | `http://localhost:3000/storage/inventory/<filename>` |

---

## Flujos principales del frontend

### Flujo 1 — Admin registra un cliente nuevo (formulario 4 páginas)

```
Página 1: Recopilar firstName, lastName, email, phone
Página 2: GET /memberships/plans → mostrar planes → usuario selecciona uno (guardar planId)
Página 3: Definir months (opcional, default 1), discount (opcional), paymentMethod, transactionId (si aplica)
Página 4: POST /clients/register con todo el body → mostrar confirmación
```

### Flujo 2 — Login de cualquier usuario

```
POST /auth/login
  ├─ Guardar accessToken y refreshToken en localStorage/secure storage
  ├─ Si mustChangePassword === true → redirigir a pantalla de cambio de contraseña
  │    └─ POST /auth/change-password → redirigir al dashboard
  └─ Si role === "ADMIN" → dashboard de admin
     Si role === "CLIENT" → dashboard de cliente
```

### Flujo 3 — Renovar token automáticamente (interceptor HTTP)

```
Al recibir respuesta 401:
  └─ POST /auth/refresh con { refreshToken }
       ├─ Si OK → reintentar la petición original con el nuevo accessToken
       └─ Si falla (401/403) → logout y redirigir al login
```

### Flujo 4 — Cliente completa su perfil

```
GET /users/profile → mostrar datos actuales
PATCH /users/profile → guardar dirección, fecha de nacimiento, teléfono
POST /users/upload-profile-image → subir foto (multipart/form-data)
```

### Flujo 5 — Cliente ve su membresía y reserva una clase

```
GET /memberships/my → mostrar membresía activa y fecha de vencimiento
GET /classes/schedule → mostrar horario con lugares disponibles
POST /reservations { classId } → confirmar reserva
GET /notifications/my → ver notificaciones pendientes
```

### Flujo 6 — Cliente paga por transferencia

```
POST /payments/transfer (multipart: membershipId, amount, voucher)
  → status: PENDING → esperar aprobación del admin
  → Admin ve en GET /payments/pending
  → Admin aprueba: PATCH /payments/approve/:id
  → Cliente recibe email de confirmación
```

### Flujo 7 — Admin revisa el dashboard

```
GET /reports/dashboard → resumen general
GET /reports/expiring-memberships → clientes por renovar
GET /payments/pending → transferencias sin aprobar
GET /reports/low-stock → inventario bajo
```

---

## Valores de enums

### `PaymentMethod`
| Valor | Descripción |
|-------|-------------|
| `CASH` | Efectivo |
| `TRANSFER` | Transferencia bancaria |
| `TERMINAL` | Terminal/tarjeta |

### `PaymentStatus`
| Valor | Descripción |
|-------|-------------|
| `PENDING` | Pendiente de aprobación |
| `APPROVED` | Aprobado |
| `REJECTED` | Rechazado |
| `REFUNDED` | Reembolsado |

### `MembershipStatus`
| Valor | Descripción |
|-------|-------------|
| `ACTIVE` | Activa y vigente |
| `EXPIRED` | Vencida |
| `SUSPENDED` | Suspendida por admin |
| `CANCELLED` | Cancelada |

### `InventoryType`
| Valor | Descripción |
|-------|-------------|
| `EQUIPMENT` | Equipamiento |
| `PRODUCT` | Producto |

### `InventoryStatus`
| Valor | Descripción |
|-------|-------------|
| `AVAILABLE` | Disponible |
| `IN_MAINTENANCE` | En mantenimiento |
| `DAMAGED` | Dañado |
| `RETIRED` | Retirado |

### `WeightUnit`
| Valor | Descripción |
|-------|-------------|
| `KG` | Kilogramos |
| `LB` | Libras |

### `Role`
| Valor | Descripción |
|-------|-------------|
| `ADMIN` | Administrador |
| `CLIENT` | Cliente |

---

## Códigos de respuesta HTTP

| Código | Significado |
|--------|-------------|
| `200` | OK — operación exitosa (GET, PATCH, DELETE) |
| `201` | Created — recurso creado (POST) |
| `400` | Bad Request — datos inválidos o regla de negocio |
| `401` | Unauthorized — token inválido, expirado o ausente |
| `403` | Forbidden — no tiene permiso para ese recurso |
| `404` | Not Found — recurso no encontrado |
| `409` | Conflict — duplicado (email repetido, reserva duplicada) |
| `429` | Too Many Requests — límite de intentos superado (login) |
| `500` | Server Error — error interno |
