# Oasis Training Center — API Documentation

**Base URL:** `http://localhost:3000/api/v1`
**Autenticación:** Bearer Token (JWT) en el header `Authorization: Bearer <token>`
**Formato:** JSON en todos los requests y responses (excepto donde se indica `multipart/form-data`)
**Versión:** 1.1.0 — revisada y verificada contra el código fuente el 2026-07-24

---

## Cómo leer este documento

Cada endpoint tiene, en este orden:

1. **Método + ruta + nivel de acceso** (ver símbolos abajo).
2. **Cómo se usa** — en qué pantalla/flujo del frontend se llama, cuándo, y qué se espera de ese contexto. Léelo antes de integrar el endpoint.
3. **Body / Query params** — el contrato real, extraído del DTO del backend (no de memoria ni de suposiciones).
4. **Response** — forma real de la respuesta exitosa.

Este documento fue re-verificado línea por línea contra los controllers y DTOs del backend (no es solo texto libre) para evitar el tipo de desfase que causó el bug de `amount` en `POST /clients/register` (ese campo fue reemplazado por `months`/`discount` y este documento ya no lo menciona en ningún endpoint donde no aplique).

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

> **Nota importante sobre validación:** el backend usa `whitelist: true` + `forbidNonWhitelisted: true`. Esto significa que **cualquier campo que envíes y no esté declarado en el DTO del endpoint hace que la petición entera falle con 400** (`"property X should not exist"`). No envíes campos "por si acaso" — envía exactamente lo que cada sección de este documento indica.

> **Nota sobre `mustChangePassword`:** si el usuario autenticado tiene `mustChangePassword: true`, **todos** los endpoints protegidos (excepto `logout` y `change-password`) devuelven `403 Forbidden` hasta que complete `POST /auth/change-password`. El frontend debe interceptar esto y forzar la redirección a esa pantalla antes de dejar navegar a cualquier otro lado.

---

## 1. HEALTH

### `GET /health` 🔓 Público

**Cómo se usa:** llámalo al arrancar la app (splash screen) o antes de reintentar una operación tras un error de red, para distinguir "el backend está caído" de "mi request falló". No requiere token, así que puedes usarlo incluso antes del login.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-12T18:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "database": "ok",
    "api": "ok"
  }
}
```
> Si la base de datos no responde, `status` es `"degraded"` y `services.database` es `"error"` — sigue siendo un 200, así que revisa el campo `status`, no el código HTTP.

---

## 2. AUTH

### `POST /auth/register` 🔓 Público

**Cómo se usa:** este es el **auto-registro público** — un visitante crea su propia cuenta de CLIENT desde una pantalla de "Crear cuenta" (sin admin de por medio, sin membresía asignada, y **eligiendo su propia contraseña**). Es un flujo distinto de `POST /clients/register` (ese lo usa un ADMIN desde el panel, genera la contraseña automáticamente y sí asigna membresía + pago). Si tu app solo tiene el panel de administración, probablemente no necesites este endpoint; si tienes una pantalla pública de registro para clientes, es este.

**Body:**
```json
{
  "email": "nuevo@email.com",
  "password": "MiPassword123",
  "firstName": "Ana",
  "lastName": "Ruiz",
  "phone": "4491112233"
}
```
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `email` | ✅ | Debe ser único |
| `password` | ✅ | Mínimo 6 caracteres |
| `firstName` | ✅ | |
| `lastName` | ✅ | |
| `phone` | ❌ | |

> A diferencia del registro hecho por un admin, aquí `mustChangePassword` queda en `false` (el usuario ya eligió su contraseña) y no se crea ninguna membresía.

---

### `POST /auth/login` 🔓 Público

**Cómo se usa:** pantalla de login, para ambos roles (ADMIN y CLIENT) — el mismo endpoint sirve para los dos, el `role` de la respuesta decide a qué dashboard redirigir. Tiene rate limiting: **máximo 5 intentos por minuto** por IP; al superarlo el backend responde `429`, así que el frontend debe mostrar un mensaje de "demasiados intentos, espera un momento" en vez de reintentar automáticamente.

Guarda `accessToken` (corta duración, 1 día) y `refreshToken` (7 días). Si `mustChangePassword` es `true`, redirige a la pantalla de cambio de contraseña antes de continuar.

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
> Si `role` es `CLIENT`, `user.client` contendrá `id`, `firstName`, `lastName`, `phone`, `address`, `birthDate`, `avatarUrl`.

---

### `POST /auth/refresh` 🔓 Público

**Cómo se usa:** no lo llames manualmente desde una pantalla — se dispara desde tu interceptor HTTP global cuando cualquier request devuelve `401`. Ver **Flujo 3** más abajo para el patrón completo.

**Body:**
```json
{ "refreshToken": "eyJhbGci..." }
```

**Response:**
```json
{ "data": { "accessToken": "eyJhbGci..." } }
```

---

### `POST /auth/logout` 🔑 Auth

**Cómo se usa:** botón "Cerrar sesión". Invalida el `refreshToken` de este dispositivo en el servidor — igual debes borrar los tokens del storage local del cliente, el backend no lo hace por ti.

**Body:**
```json
{ "refreshToken": "eyJhbGci..." }
```

**Response:**
```json
{ "data": { "message": "Logout successful" } }
```

---

### `GET /auth/profile` 🔑 Auth

**Cómo se usa:** alternativa a `GET /users/profile` (misma información, mismo shape) — usa cualquiera de las dos de forma consistente en tu app, no ambas. Útil para "quién soy" al montar el layout autenticado o al refrescar la página.

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
          "plan": { "name": "Ilimitado", "price": 1200, "duration": 30 }
        }
      ]
    }
  }
}
```

---

### `POST /auth/change-password` 🔑 Auth

**Cómo se usa:** dos casos — (1) pantalla obligatoria de "cambia tu contraseña temporal" cuando `mustChangePassword === true` (tras el primer login de un usuario creado por un admin), y (2) pantalla normal de "cambiar contraseña" desde configuración de cuenta. En ambos casos se pide la contraseña actual.

**Body:**
```json
{
  "currentPassword": "contraseñaActual",
  "newPassword": "nuevaContraseña123!"
}
```
> `newPassword` requiere mínimo 8 caracteres.

**Response:**
```json
{ "data": { "message": "Password changed successfully" } }
```

---

### `POST /auth/register-admin` 👑 Solo ADMIN

**Cómo se usa:** pantalla de "Agregar administrador" dentro de configuración del panel — solo accesible para un ADMIN ya logueado. La contraseña se genera automáticamente y se manda por email; no hay campo de contraseña en el formulario del frontend.

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
    "user": { "id": "uuid", "email": "carlos@oasisgym.com", "role": "ADMIN", "mustChangePassword": true }
  }
}
```

---

### `POST /auth/forgot-password` 🔓 Público

**Cómo se usa:** link "¿Olvidaste tu contraseña?" en el login. Por seguridad, el backend responde igual exista o no el email — **no uses esta respuesta para decirle al usuario si su correo está registrado**, solo muestra "si el correo existe, te llegará un link".

**Body:**
```json
{ "email": "cliente@email.com" }
```

**Response:**
```json
{ "data": { "message": "If the email exists, a reset link has been sent" } }
```

---

### `POST /auth/reset-password` 🔓 Público

**Cómo se usa:** pantalla a la que llega el usuario desde el link del email de recuperación (`token` va en la URL, tú lo extraes y lo mandas en el body junto con la nueva contraseña). El link vence en 1 hora.

**Body:**
```json
{
  "token": "abc123tokenDelEmail",
  "password": "nuevaContraseña123!"
}
```
> `password` requiere mínimo 8 caracteres, al menos una mayúscula y un número.

**Response:**
```json
{ "data": { "message": "Password reset successful" } }
```

---

## 3. CLIENTS

> Todo el controller es 👑 Solo ADMIN **excepto** `GET /clients/me/stats`, que también permite CLIENT.

### `POST /clients/register` 👑 Solo ADMIN

**Cómo se usa:** endpoint principal del formulario de alta de cliente de 4 páginas en el panel de admin (datos personales → membresía → pago → confirmación). Crea al cliente, asigna su membresía y registra el pago **en una sola llamada atómica**: si algo falla, nada queda guardado — no hay estados intermedios que limpiar en el frontend. Al terminar, se envía automáticamente el email de bienvenida con contraseña temporal al cliente.

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

> **`amount` NO se envía.** El monto final lo calcula el servidor (`plan.price × months - discount`) para que precio base, ajuste y precio final nunca queden inconsistentes. Enviar `amount` produce `400 "property amount should not exist"`.

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
      "client": { "id": "uuid-client", "firstName": "Eduardo", "lastName": "Camarena", "phone": "4495406895" }
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

**Cómo se usa:** para cuando el admin quiere dar de alta a un cliente **sin** cobrarle ni asignarle plan todavía (p. ej. lo va a inscribir después, en el mostrador). No pidas `planId` ni datos de pago en este formulario — si los necesitas, usa `POST /clients/register`.

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
      "client": { "id": "uuid-client", "firstName": "María", "lastName": "García", "phone": "4499876543" }
    }
  }
}
```

---

### `GET /clients` 👑 Solo ADMIN

**Cómo se usa:** tabla/listado principal de clientes en el panel de admin, con paginación y buscador por nombre. Usa `search` para el input de búsqueda con debounce; no filtres en el cliente, deja que el backend pagine.

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
        "user": { "email": "eduardo@email.com", "role": "CLIENT", "isActive": true }
      }
    ],
    "meta": { "total": 7, "page": 1, "limit": 10, "totalPages": 1 }
  }
}
```

---

### `GET /clients/me/stats` 🔑 Auth (CLIENT o ADMIN)

**Cómo se usa:** tarjetas de resumen en el dashboard del cliente ("clases este mes", "PRs este mes", "racha actual"). El `clientId` se resuelve del propio token — no hay que pasarlo. Pensado para renderizarse junto a `GET /memberships/my`.

**Response:**
```json
{
  "data": {
    "classesThisMonth": 8,
    "prsThisMonth": 2,
    "currentStreak": 5
  }
}
```
> `currentStreak` son días consecutivos con al menos un check-in.

---

### `GET /clients/:id` 👑 Solo ADMIN

**Cómo se usa:** pantalla de detalle/perfil de un cliente desde el panel de admin, incluye su historial de membresías.

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
    "user": { "email": "eduardo@email.com", "role": "CLIENT", "isActive": true, "createdAt": "2026-06-12T00:00:00.000Z" },
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

**Cómo se usa:** edición rápida de datos básicos del cliente desde el panel de admin (no confundir con `PATCH /users/profile`, que es autoservicio del propio usuario). Solo acepta `firstName`, `lastName`, `phone` — para dirección/fecha de nacimiento usa el flujo del cliente (`PATCH /users/profile`).

**Body:**
```json
{ "phone": "4491112233" }
```

---

### `DELETE /clients/:id` 👑 Solo ADMIN

**Cómo se usa:** botón "Desactivar cliente". Es soft delete — no borra el registro, solo lo marca inactivo y bloquea su login. Úsalo para el flujo de baja normal; no hay endpoint de borrado físico.

**Response:**
```json
{ "data": { "message": "Client deactivated successfully" } }
```

---

### `GET /clients/:id/payments` 👑 Solo ADMIN

**Cómo se usa:** tab "Historial de pagos" dentro del detalle de un cliente.

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
      "membership": { "plan": { "name": "Ilimitado" } }
    }
  ]
}
```

---

### `GET /clients/:id/attendance` 👑 Solo ADMIN

**Cómo se usa:** tab "Asistencias" dentro del detalle de un cliente.

**Response:**
```json
{
  "data": [
    { "id": "uuid", "checkIn": "2026-06-12T09:00:00.000Z", "activity": { "name": "CrossFit" } }
  ]
}
```

---

## 4. ACTIVITIES

> Lectura (`GET`) requiere solo estar autenticado (ADMIN o CLIENT); escritura es 👑 Solo ADMIN.

### `POST /activities` 👑 Solo ADMIN

**Cómo se usa:** pantalla de administración de actividades del gimnasio (CrossFit, Yoga, etc.), independiente de las clases con horario — una actividad es la "categoría", una clase (`/classes`) es una sesión concreta con fecha/hora y cupo que puede pertenecer a una actividad.

**Body:**
```json
{ "name": "CrossFit", "description": "Entrenamiento funcional de alta intensidad" }
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

**Cómo se usa:** selector de actividad en formularios (registro de cliente, check-in, reservas). Pasa `?active=true` para no mostrar actividades desactivadas en selects de creación.

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

**Cómo se usa:** detalle de una actividad puntual, normalmente al entrar desde el listado.

---

### `PATCH /activities/:id` 👑 Solo ADMIN

**Body:**
```json
{ "description": "Nueva descripción", "isActive": false }
```

---

### `DELETE /activities/:id` 👑 Solo ADMIN

**Cómo se usa:** borrado físico (no soft delete). Antes de exponer un botón directo, confirma con el usuario — a diferencia de clientes/membresías, aquí no hay "reactivar".

---

## 5. MEMBERSHIPS

### `POST /memberships/plans` 👑 Solo ADMIN

**Cómo se usa:** pantalla de administración de planes/precios (catálogo). `duration` es en **días**, no en meses — un plan "Mensual" típico usa `duration: 30`.

**Body:**
```json
{ "name": "Mensual", "description": "Acceso ilimitado por 30 días", "price": 1200, "duration": 30 }
```

---

### `GET /memberships/plans` 🔑 Auth (ADMIN o CLIENT)

**Cómo se usa:** selector de plan en el formulario de registro/renovación (admin) y pantalla de "elige tu plan" (cliente). Usa `?active=true` para no mostrar planes descontinuados a un cliente comprando.

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

**Body:**
```json
{ "price": 1300, "description": "Nueva descripción" }
```

---

### `DELETE /memberships/plans/:id` 👑 Solo ADMIN

**Cómo se usa:** botón "Eliminar plan" en el catálogo. **Falla con 400 si hay membresías activas usando ese plan** — muestra ese error tal cual al admin en vez de un mensaje genérico, para que sepa que debe migrar o esperar a que esas membresías venzan.

---

### `POST /memberships` 👑 Solo ADMIN

**Cómo se usa:** asignación manual de membresía a un cliente **ya existente**, sin registrar pago (p. ej. cortesía, migración de datos). Para el caso normal de "cliente nuevo paga su primer plan" usa `POST /clients/register`; para "cliente existente renueva/paga" usa `PATCH /memberships/:id/renew`. Este endpoint requiere que **tú** calcules `endDate` en el frontend — no lo deriva el servidor.

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

**Cómo se usa:** listado general de membresías con filtro por estado (tabs "Activas" / "Vencidas" / "Suspendidas" / "Canceladas" en el panel).

**Query params:** `?status=ACTIVE` | `EXPIRED` | `SUSPENDED` | `CANCELLED`

---

### `GET /memberships/active` 👑 Solo ADMIN

**Cómo se usa:** atajo equivalente a `GET /memberships?status=ACTIVE`, pero ya filtrado por vigencia real de fecha (no solo el campo `status`). Prefiere este endpoint si necesitas la lista realmente vigente hoy.

---

### `GET /memberships/expired` 👑 Solo ADMIN

---

### `GET /memberships/my` 👤 Solo CLIENT

**Cómo se usa:** pantalla principal del cliente ("Mi membresía") — muestra plan, fecha de vencimiento y estado. Devuelve `null` en `data` si no tiene membresía activa; el frontend debe mostrar un estado vacío tipo "aún no tienes una membresía activa" en ese caso, no tratarlo como error.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "status": "ACTIVE",
    "startDate": "2026-06-12T00:00:00.000Z",
    "endDate": "2026-07-12T00:00:00.000Z",
    "plan": { "name": "Ilimitado", "price": 1200, "duration": 30, "description": "Acceso ilimitado" },
    "activity": null
  }
}
```

---

### `GET /memberships/client/:clientId` 👑 Solo ADMIN

**Cómo se usa:** historial completo de membresías de un cliente (todas, no solo la activa) — útil para ver renovaciones y cambios de plan pasados en el detalle del cliente.

---

### `GET /memberships/:id` 👑 Solo ADMIN

---

### `PATCH /memberships/:id/suspend` 👑 Solo ADMIN

**Cómo se usa:** botón "Suspender" en el detalle de una membresía activa (p. ej. cliente pide pausa). No cobra ni modifica fechas, solo cambia el estado.

**Response:**
```json
{ "data": { "id": "uuid", "status": "SUSPENDED" } }
```

---

### `PATCH /memberships/:id/renew` 👑 Solo ADMIN

**Cómo se usa:** botón "Renovar" en el detalle de una membresía — es el caso de mostrador: cliente existente que paga por más tiempo, opcionalmente cambiando de plan o con un descuento manual. Si el admin quiere registrar el cobro, debe incluir `paymentMethod`; si lo omite, la membresía se extiende gratis (renovación de cortesía) y **no se crea ningún `Payment`** — no muestres un recibo de pago en ese caso.

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
| `paymentMethod` | Solo `CASH` \| `TERMINAL`. Si se omite, la membresía se extiende **sin cobro** y no se crea ningún `Payment`. **`TRANSFER` no se acepta aquí** — usa `POST /payments/transfer` para ese método |
| `transactionId` / `notes` | Opcionales, solo aplican si se envía `paymentMethod` |

> Si no se envía nada en el body, se comporta como antes: renueva 1 mes usando la duración del plan actual, sin cobro.

---

### `PATCH /memberships/:id/change-plan` 👑 Solo ADMIN

**Cómo se usa:** endpoint **nuevo** — botón "Cambiar de plan" en el detalle de una membresía activa, para cuando el cliente quiere moverse a otro plan (p. ej. de Mensual a Ilimitado) sin pasar por el flujo de renovación. A diferencia de `renew`, **este endpoint no cobra ni crea ningún `Payment`** — solo cambia el plan y **arranca un período de facturación nuevo desde hoy** usando la duración del nuevo plan (no conserva días restantes del plan anterior, porque precios/duraciones difieren entre planes). Si necesitas cobrar el cambio de plan, cóbralo aparte con `POST /payments` o similar.

**Body:**
```json
{ "planId": "uuid-del-nuevo-plan" }
```
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `planId` | ✅ | ID del nuevo plan. Debe ser distinto al plan actual y estar activo |

> Falla con 400 si `planId` es el mismo plan que ya tiene la membresía, o si el plan no está activo.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "planId": "uuid-nuevo-plan",
    "status": "ACTIVE",
    "startDate": "2026-07-24T00:00:00.000Z",
    "endDate": "2026-08-23T00:00:00.000Z",
    "client": { "...": "..." },
    "plan": { "name": "Ilimitado", "price": 1200, "duration": 30 }
  }
}
```

---

## 6. PAYMENTS

> El controller entero requiere estar autenticado. Algunas rutas son solo ADMIN; otras (`transfer`, `my`, `card`, `config/mp-public-key`) están disponibles también para CLIENT, porque son operaciones que el propio cliente ejecuta sobre sus pagos.

### `POST /clients/register` (ver sección Clients)

Para registrar pago junto con el alta del cliente, usa `POST /clients/register`.

---

### `POST /payments` 👑 Solo ADMIN

**Cómo se usa:** registro de pago genérico cuando el admin ya sabe el `amount` exacto a cobrar y el método (incluye `TRANSFER`, a diferencia de `renew`). Para efectivo/terminal es más simple usar `/payments/cash` o `/payments/terminal` directamente, que no piden `paymentMethod` explícito.

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
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `membershipId` | ✅ | |
| `clientId` | ❌ | Normalmente no hace falta, se infiere de la membresía |
| `amount` | ✅ | Monto exacto — aquí **sí** se envía, a diferencia de `/clients/register` y `/memberships/:id/renew` |
| `paymentMethod` | ✅ | `CASH` \| `TRANSFER` \| `TERMINAL` \| `CARD` |
| `transactionId` / `notes` | ❌ | |

---

### `POST /payments/cash` 👑 Solo ADMIN

**Cómo se usa:** botón rápido "Cobrar en efectivo" desde el detalle de una membresía. No pidas `paymentMethod` en este formulario — queda fijo en `CASH` y el estado final siempre es `APPROVED` (no pasa por revisión).

**Body:**
```json
{ "membershipId": "uuid-membresía", "amount": 1200, "notes": "Pago en caja" }
```

---

### `POST /payments/terminal` 👑 Solo ADMIN

**Cómo se usa:** botón "Cobrar con terminal" (tarjeta física en el mostrador, no confundir con `/payments/card` que es pago en línea vía MercadoPago). Estado final siempre `APPROVED`.

**Body:**
```json
{ "membershipId": "uuid-membresía", "amount": 1200, "transactionId": "TXN-00123" }
```

---

### `POST /payments/transfer` 🔑 Auth (CLIENT sube, ADMIN también puede)

**Cómo se usa:** pantalla del cliente "Subir comprobante de transferencia". A diferencia de los otros métodos de pago, este **no aprueba automáticamente** — queda en `PENDING` hasta que un admin lo revisa. Muéstrale al cliente un estado "en revisión" tras subirlo, no un check verde inmediato. Se envía como `multipart/form-data` (no JSON) porque incluye el archivo del comprobante.

**Form fields:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `membershipId` | string | ID de la membresía |
| `amount` | number | Monto de la transferencia. Requerido **si no** se envía `months` |
| `months` | number (opcional) | Cantidad de meses que cubre este pago (renovación). Si se envía, el monto se calcula como `plan.price × months` ajustado por `discount`, **y la membresía se extiende automáticamente al aprobar el pago** (no al subir el comprobante) |
| `discount` | number (opcional) | Ajuste manual sobre el precio calculado. Solo aplica si se envía `months` |
| `notes` | string (opcional) | Observaciones |
| `voucher` | archivo | JPG, PNG o PDF (máx. 5MB) |

---

### `PATCH /payments/approve/:id` 👑 Solo ADMIN

**Cómo se usa:** botón "Aprobar" en la bandeja de transferencias pendientes (`GET /payments/pending`). Solo aplica a pagos en estado `PENDING`. Envía email de confirmación al cliente automáticamente. Si el pago tenía `months` (transferencia de renovación), **la membresía se extiende recién en este momento**, no cuando se subió el comprobante — no muestres la nueva fecha de vencimiento hasta que esto ocurra.

**Response:**
```json
{ "data": { "id": "uuid", "status": "APPROVED", "paidAt": "2026-06-12T18:00:00.000Z" } }
```

---

### `PATCH /payments/reject/:id` 👑 Solo ADMIN

**Cómo se usa:** botón "Rechazar" en la bandeja de pendientes. Envía email de rechazo al cliente. Ten en cuenta el efecto en la membresía: si este era el único pago aprobable (p. ej. el pago fundador de una membresía nueva), la membresía se suspende automáticamente; si la membresía ya tenía otro pago `APPROVED` (rechazas una transferencia de *renovación* sobre algo ya vigente), la membresía **no** se suspende — refleja esto en el UI, no asumas que rechazar siempre suspende.

**Body (opcional):**
```json
{ "reason": "El monto no coincide con el plan" }
```

---

### `GET /payments/my` 🔑 Auth

**Cómo se usa:** pantalla del cliente "Mi historial de pagos" — el `clientId` se resuelve del propio token, no hace falta pasarlo. Análogo a `GET /clients/:id/payments` pero para consumo del propio cliente en vez del admin.

---

### `GET /payments/pending` 👑 Solo ADMIN

**Cómo se usa:** bandeja de transferencias sin revisar — normalmente la primera pantalla que un admin revisa al entrar, junto con el dashboard.

---

### `GET /payments/config/mp-public-key` 🔑 Auth

**Cómo se usa:** llámalo al montar la pantalla de pago con tarjeta, **antes** de inicializar el SDK JS de MercadoPago en el frontend — necesitas esta `publicKey` para tokenizar la tarjeta ahí (`Mercadopago.setPublishableKey(...)` o equivalente según la versión del SDK). Si `publicKey` viene `null`, MercadoPago no está configurado en este ambiente — oculta la opción de pago con tarjeta en vez de dejar que el usuario intente pagar.

**Response:**
```json
{ "publicKey": "APP_USR-xxxxxxxx-xxxxxx" }
```
> Nota: esta respuesta **no** viene envuelta en `{ data: ... }` como el resto de la API — es un objeto plano.

---

### `GET /payments` 👑 Solo ADMIN

**Query params:** `?status=PENDING` | `APPROVED` | `REJECTED` | `REFUNDED`

---

### `GET /payments/:id` 👑 Solo ADMIN

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

**Cómo se usa:** ajuste manual de estado para casos que no caben en approve/reject (p. ej. marcar un `REFUNDED`). Úsalo con moderación — para el flujo normal de transferencias usa `approve`/`reject`.

**Body:**
```json
{ "status": "APPROVED", "transactionId": "TXN-456", "notes": "Verificado manualmente" }
```

---

### `POST /payments/card` 🔑 Auth

**Cómo se usa:** pantalla de "Pagar con tarjeta" — flujo de MercadoPago Checkout API. Es un flujo de **dos pasos en el frontend**:

1. Cargas el SDK JS de MercadoPago con la `publicKey` de `GET /payments/config/mp-public-key`, montas el formulario de tarjeta con ese SDK, y el SDK te devuelve un `cardToken` + `paymentMethodId` (+ `issuerId` si aplica) **sin que el número de tarjeta pase nunca por este backend**.
2. Mandas ese token aquí, junto con el monto y el email del pagador, para que el backend confirme el cargo con MercadoPago.

El pago puede quedar `APPROVED`, `PENDING` (en revisión por el banco) o `REJECTED` — muestra los tres estados en el UI, no asumas éxito solo porque el request HTTP fue 201. Si envías `months`, la membresía se extiende automáticamente cuando el pago queda `APPROVED`.

**Body:**
```json
{
  "membershipId": "uuid-membresía",
  "amount": 1200,
  "cardToken": "token-generado-por-mp-sdk",
  "paymentMethodId": "visa",
  "issuerId": "310",
  "installments": 1,
  "payerEmail": "cliente@email.com",
  "months": 1
}
```
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `membershipId` | ✅ | |
| `amount` | ✅ | Debe coincidir con el precio del plan |
| `cardToken` | ✅ | Generado por el SDK JS de MercadoPago en el frontend |
| `paymentMethodId` | ✅ | Devuelto por el SDK (`visa`, `master`, `amex`, etc.) |
| `issuerId` | ❌ | Devuelto por el SDK cuando aplica |
| `installments` | ❌ | Número de mensualidades, default `1` (máx. 24) |
| `payerEmail` | ✅ | Email del titular de la tarjeta |
| `months` | ❌ | Si se envía, extiende la membresía automáticamente al aprobarse el pago |

**Response:**
```json
{
  "data": {
    "id": "uuid-payment",
    "amount": 1200,
    "paymentMethod": "CARD",
    "status": "APPROVED",
    "transactionId": "mp-payment-id",
    "paidAt": "2026-07-24T18:00:00.000Z"
  }
}
```

> **`POST /payments/webhook/mercadopago` no es para el frontend** — es la URL de notificación que MercadoPago llama server-to-server para confirmar cambios de estado asíncronos (p. ej. un pago que queda `PENDING` y luego se aprueba). No lo invoques desde la app.

---

## 7. ATTENDANCE

### `POST /attendance/check-in` 🔑 Auth

**Cómo se usa:** botón de "Registrar entrada" — pensado para que lo dispare el **propio cliente** (p. ej. escaneando un QR en recepción) o un admin marcando la entrada de alguien en el mostrador. Si quien llama es CLIENT, el `clientId` que envíes se ignora y se usa el de su propio token — no necesitas resolverlo tú. El backend valida que tenga membresía activa antes de registrar la entrada.

**Body:**
```json
{
  "clientId": "uuid-del-cliente",
  "activityId": "uuid-actividad-opcional",
  "checkIn": "2026-06-12T09:00:00.000Z"
}
```
> `activityId` y `checkIn` son opcionales. Si no se envía `checkIn`, se usa la hora actual del servidor.

**Response:**
```json
{ "data": { "id": "uuid", "clientId": "uuid-cliente", "checkIn": "2026-06-12T09:00:00.000Z", "activity": null } }
```

---

### `POST /attendance` 👑 Solo ADMIN

**Cómo se usa:** registro manual de asistencia por un admin **sin** pasar por la validación de membresía activa que sí aplica en `check-in` — útil para corregir/cargar asistencias retroactivas o excepciones. Mismo body que `check-in`.

**Body:** igual que `POST /attendance/check-in`.

---

### `GET /attendance` 👑 Solo ADMIN

**Cómo se usa:** listado paginado de todas las asistencias, para reportes o auditoría.

**Query params:** `?page=1&limit=20`

---

### `GET /attendance/client/:id` 👑 Solo ADMIN

**Cómo se usa:** historial de asistencias de un cliente puntual, dentro de su detalle.

---

## 8. CLASSES

### `POST /classes` 👑 Solo ADMIN

**Cómo se usa:** pantalla de administración de horario — crea una sesión concreta con cupo y horario, opcionalmente ligada a una `activityId` (p. ej. una sesión de "CrossFit Matutino" bajo la actividad "CrossFit").

**Body:**
```json
{
  "name": "CrossFit Matutino",
  "description": "Clase de alta intensidad",
  "capacity": 20,
  "startTime": "2026-06-13T09:00:00.000Z",
  "endTime": "2026-06-13T10:00:00.000Z",
  "instructorName": "Juan Pérez",
  "activityId": "uuid-actividad-opcional"
}
```
| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| `name` | ✅ | |
| `description` | ❌ | |
| `capacity` | ✅ | Entero ≥ 1 |
| `startTime` / `endTime` | ✅ | ISO datetime |
| `instructorName` | ❌ | |
| `activityId` | ❌ | Liga la clase a una actividad existente |

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

**Cómo se usa:** listado administrativo — incluye clases activas **e inactivas**. Para la pantalla del cliente que solo debe ver lo reservable, usa `GET /classes/schedule` en vez de este.

---

### `GET /classes/schedule` 🔑 Auth

**Cómo se usa:** el CLIENT usa este endpoint (no `GET /classes`) para ver qué puede reservar, ya con el cupo disponible calculado. Acepta `?date=YYYY-MM-DD` para filtrar el horario de un día específico (p. ej. un selector de fecha tipo calendario); sin el parámetro, devuelve el horario activo general.

**Query params:** `?date=2026-07-24` (opcional)

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

---

### `PATCH /classes/:id` 👑 Solo ADMIN

**Body:**
```json
{ "capacity": 25, "isActive": true }
```

---

### `DELETE /classes/:id` 👑 Solo ADMIN

**Cómo se usa:** botón "Eliminar clase". **Falla con 400 si la clase tiene reservas activas** — el frontend debe guiar al admin a cancelarlas primero (o hacerlo tú automáticamente vía `DELETE /reservations/:id` por cada una) antes de reintentar.

**Error si tiene reservas:**
```json
{ "statusCode": 400, "message": "Cannot delete class: it has 3 active reservation(s). Cancel them first." }
```

---

## 9. RESERVATIONS

### `POST /reservations` 🔑 Auth

**Cómo se usa:** botón "Reservar" en la pantalla de horario del cliente. Si quien llama es CLIENT, el `clientId` se ignora y se toma del token — igual debes mandar el campo en el body (el DTO lo requiere), pero su valor no importa para un CLIENT. Un ADMIN sí puede reservar a nombre de cualquier cliente pasando el `clientId` real.

**Body:**
```json
{ "clientId": "cualquier-valor-si-eres-client", "classId": "uuid-de-la-clase" }
```

**Response:**
```json
{ "data": { "id": "uuid", "clientId": "uuid-cliente-real", "classId": "uuid-clase", "createdAt": "2026-06-12T18:00:00.000Z" } }
```
> Si el cliente ya tiene reserva en esa clase, devuelve `409 Conflict` — captúralo para mostrar "ya tienes una reserva en esta clase" en vez de un error genérico.

---

### `GET /reservations` 👑 Solo ADMIN

---

### `GET /reservations/client/:id` 🔑 Auth (Admin o el propio cliente)

**Cómo se usa:** el propio cliente puede consultar sus reservas (`:id` debe ser su propio `clientId`, si no coincide devuelve 403); un admin puede consultar las de cualquiera.

---

### `DELETE /reservations/:id` 🔑 Auth

**Cómo se usa:** botón "Cancelar reserva". Un CLIENT solo puede cancelar las suyas (el backend valida ownership); un ADMIN puede cancelar cualquiera.

---

## 10. PERSONAL RECORDS

### `POST /personal-records` 🔑 Auth

**Cómo se usa:** pantalla del cliente "Registrar PR" (récord personal). El `userId` se toma del token — no lo mandes. Para el selector de ejercicio, el backend sugiere esta lista fija (no es una validación estricta de enum, pero es lo que usa el resto de la app): `Back Squat`, `Front Squat`, `Deadlift`, `Snatch`, `Clean & Jerk`, `Bench Press`, `Otros`.

**Body:**
```json
{ "exercise": "Sentadilla", "weight": 120, "unit": "KG", "notes": "Nuevo récord personal" }
```
> `unit`: `KG` | `LB` (default `KG` si se omite).

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

**Cómo se usa:** listado completo de PRs del cliente autenticado, ordenado por fecha — para una vista tipo "historial".

---

### `GET /personal-records/my/best` 🔑 Auth

**Cómo se usa:** requiere `?exercise=` — a diferencia de lo que su nombre sugiere, **no** devuelve "el mejor por cada ejercicio" automáticamente, sino el mejor registro **de un ejercicio específico** que tú indiques. Si quieres una tarjeta de "mis mejores marcas" por cada ejercicio, tendrás que llamarlo una vez por ejercicio o agrupar tú mismo desde `GET /personal-records/my`.

**Query params:** `?exercise=Sentadilla` (requerido)

---

### `GET /personal-records/admin` 👑 Solo ADMIN

**Query params:** `?exercise=` (opcional, para filtrar)

---

### `GET /personal-records/client/:clientId` 👑 Solo ADMIN

---

### `GET /personal-records/:id` 🔑 Auth (Admin o el dueño del récord)

---

### `PATCH /personal-records/:id` 🔑 Auth (Admin o el dueño del récord)

**Body:**
```json
{ "weight": 125, "notes": "Con cinturón" }
```

---

### `DELETE /personal-records/:id` 🔑 Auth (Admin o el dueño del récord)

---

## 11. INVENTORY

> Todos los endpoints de inventario son exclusivos del ADMIN.

### `POST /inventory` 👑 Solo ADMIN

**Cómo se usa:** alta de equipo o producto en el catálogo interno del gimnasio.

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

> Solo `name`, `type` y `quantity` son obligatorios — el resto es opcional.

---

### `GET /inventory` 👑 Solo ADMIN

**Cómo se usa:** tabla principal de inventario con filtros por tipo/estado (tabs o dropdowns en el UI).

**Query params:** `?type=EQUIPMENT&status=AVAILABLE`

---

### `GET /inventory/maintenance` 👑 Solo ADMIN

**Cómo se usa:** vista rápida de artículos en `IN_MAINTENANCE` — útil como widget del dashboard.

---

### `GET /inventory/:id` 👑 Solo ADMIN

---

### `PATCH /inventory/:id` 👑 Solo ADMIN

**Body:**
```json
{ "quantity": 8, "status": "IN_MAINTENANCE", "maintenanceRequired": true, "notes": "Revisión programada" }
```

---

### `DELETE /inventory/:id` 👑 Solo ADMIN

---

### `POST /inventory/upload-image` 👑 Solo ADMIN

**Cómo se usa:** subir la primera imagen de un artículo recién creado. Usa `multipart/form-data`.

**Form fields:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `itemId` | string | ID del artículo |
| `image` | archivo | JPG, PNG o WEBP (máx. 5MB) |

---

### `PATCH /inventory/update-image/:id` 👑 Solo ADMIN

**Cómo se usa:** reemplazar la imagen existente de un artículo. `multipart/form-data`, mismo campo `image`.

---

### `DELETE /inventory/delete-image/:id` 👑 Solo ADMIN

---

## 12. REPORTS

> Todos los reportes son exclusivos del ADMIN. No requieren body — son todos `GET`.

### `GET /reports/dashboard` 👑 Solo ADMIN

**Cómo se usa:** pantalla principal del panel de admin al hacer login — resumen general del negocio.

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

**Query params:** `?year=2026&month=7` (ambos opcionales, default: mes actual)

---

### `GET /reports/monthly-income-chart` 👑 Solo ADMIN

**Cómo se usa:** endpoint pensado específicamente para alimentar una gráfica de línea de ingresos mensuales en el dashboard (distinto de `monthly-income`, que da el total de un solo mes). Devuelve una serie de N meses hacia atrás.

**Query params:** `?months=12` (opcional, default 12 — cuántos meses hacia atrás incluir)

---

### `GET /reports/recent-activity` 👑 Solo ADMIN

**Cómo se usa:** feed de actividad reciente para el dashboard (pagos, altas/cambios de membresía, check-ins recientes mezclados en orden cronológico) — útil como un widget tipo "últimos eventos".

**Query params:** `?limit=20` (opcional, default 20)

---

### `GET /reports/revenue` 👑 Solo ADMIN

**Cómo se usa:** si mandas `startDate` y `endDate`, filtra por ese rango; si omites ambos, devuelve el histórico total. No mandes solo uno de los dos — el backend solo aplica el filtro si vienen **ambos**.

**Query params:** `?startDate=2026-01-01&endDate=2026-06-30`

---

### `GET /reports/active-memberships` 👑 Solo ADMIN

---

### `GET /reports/expired-memberships` 👑 Solo ADMIN

---

### `GET /reports/expiring-memberships` 👑 Solo ADMIN

**Cómo se usa:** para el widget "por renovar" del dashboard o para armar una campaña de contacto proactivo.

**Query params:** `?days=7` (opcional, default 7)

---

### `GET /reports/attendance` 👑 Solo ADMIN

**Query params:** `?startDate=&endDate=` (opcionales)

---

### `GET /reports/active-clients` 👑 Solo ADMIN

---

### `GET /reports/inactive-clients` 👑 Solo ADMIN

---

### `GET /reports/payments` 👑 Solo ADMIN

**Query params:** `?startDate=&endDate=` (opcionales)

---

### `GET /reports/pending-payments` 👑 Solo ADMIN

---

### `GET /reports/users-by-activity` 👑 Solo ADMIN

---

### `GET /reports/equipment-maintenance` 👑 Solo ADMIN

---

### `GET /reports/low-stock` 👑 Solo ADMIN

**Cómo se usa:** artículos cuya `quantity` está por debajo de su `minStock` configurado — útil como alerta en el dashboard.

---

## 13. NOTIFICATIONS

### `POST /notifications` 👑 Solo ADMIN

**Cómo se usa:** crear una notificación **dentro de la app** para un usuario puntual (aparece en su campanita/lista, no es un email). Para mandar un correo real, usa `POST /notifications/send-email`.

**Body:**
```json
{
  "userId": "uuid-del-usuario",
  "title": "Tu membresía vence pronto",
  "message": "Tu membresía Ilimitado vence el 12 de julio. Renueva para seguir entrenando.",
  "type": "INFO"
}
```
> `type` es opcional: `INFO` \| `SUCCESS` \| `WARNING` \| `ERROR` \| `EXPIRY_WARNING` \| `MANUAL`.

---

### `POST /notifications/send-email` 👑 Solo ADMIN

**Cómo se usa:** envío de un email puntual y libre a un usuario (no es una plantilla predefinida como bienvenida/recuperación — tú escribes el asunto y el cuerpo). Útil para un botón tipo "contactar por correo" desde el detalle de un cliente.

**Body:**
```json
{ "userId": "uuid-del-usuario", "subject": "Aviso importante", "message": "Contenido del correo en texto plano." }
```
> Nota: este endpoint recibe los campos sueltos (no un DTO tipado), así que el backend no valida su forma más allá de que existan — revisa tú en el frontend que no estén vacíos antes de enviar.

---

### `POST /notifications/send-expiration-warning` 👑 Solo ADMIN

**Cómo se usa:** botón manual "Enviar avisos de vencimiento ahora" — dispara notificaciones + emails a todos los clientes cuya membresía vence en los próximos 7 días. (Esto también corre automáticamente por cron en el backend; este endpoint es para forzarlo on-demand, p. ej. para pruebas o para adelantarlo un día).

**Body:** ninguno.

---

### `POST /notifications/membership-expired` 👑 Solo ADMIN

**Cómo se usa:** alias exacto de `send-expiration-warning` (llama al mismo método). No hay diferencia funcional entre ambos — usa el que prefieras, pero no los llames dos veces pensando que hacen cosas distintas.

**Body:** ninguno.

---

### `GET /notifications` 👑 Solo ADMIN

**Cómo se usa:** vista de administración de todas las notificaciones del sistema. Acepta `?userId=` para filtrar por usuario.

---

### `GET /notifications/my` 🔑 Auth

**Cómo se usa:** campanita de notificaciones del usuario autenticado (ADMIN o CLIENT).

**Response:**
```json
{
  "data": [
    { "id": "uuid", "title": "Bienvenido", "message": "Tu cuenta ha sido creada.", "isRead": false, "createdAt": "2026-06-12T18:00:00.000Z" }
  ]
}
```

---

### `PATCH /notifications/:id/read` 🔑 Auth

**Response:**
```json
{ "data": { "id": "uuid", "isRead": true } }
```

---

### `PATCH /notifications/read-all/me` 🔑 Auth

**Cómo se usa:** botón "Marcar todas como leídas" en el dropdown de notificaciones.

---

## 14. USERS

### `GET /users` 👑 Solo ADMIN

**Cómo se usa:** listado de cuentas de usuario del sistema (incluye ADMIN y CLIENT), distinto de `GET /clients` (que solo trae perfiles de cliente). Úsalo para gestión de cuentas/roles, no como listado de clientes del gimnasio.

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
        "client": { "id": "uuid", "firstName": "Eduardo", "lastName": "Camarena", "phone": "4495406895" }
      }
    ],
    "meta": { "total": 9, "page": 1, "limit": 10, "totalPages": 1 }
  }
}
```

---

### `GET /users/profile` 🔑 Auth

**Cómo se usa:** ver `GET /auth/profile` — misma estructura, mismo propósito. Elige uno y sé consistente.

---

### `PATCH /users/profile` 🔑 Auth

**Cómo se usa:** formulario de "Editar mi perfil" del propio usuario (solo aplica a perfiles CLIENT — un ADMIN no tiene estos campos). Todos los campos son opcionales, manda solo los que cambiaron.

**Body:**
```json
{
  "firstName": "Eduardo",
  "lastName": "Camarena",
  "phone": "4495406895",
  "address": "Av. Héroe de Nacozari 301, Aguascalientes",
  "birthDate": "2004-06-12",
  "emergencyContact": "María Camarena - 4491234567"
}
```
> `emergencyContact` existe en el modelo pero no aparecía en versiones previas de este documento — inclúyelo si tu formulario de perfil tiene ese campo.

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

**Cómo se usa:** el propio usuario sube/reemplaza su foto de perfil. `multipart/form-data`, límite 2MB (más chico que el resto de los uploads del sistema, que aceptan 5MB — valídalo en el frontend antes de subir para no esperar el rechazo del servidor).

**Form fields:**
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `avatar` | archivo | JPG, PNG o WEBP (máx. 2MB) |

**Response:**
```json
{ "data": { "id": "uuid", "email": "cliente@email.com", "avatar": "/storage/profiles/abc123.jpg" } }
```

---

### `GET /users/:id` 👑 Solo ADMIN

**Cómo se usa:** por ID de **usuario** (`userId`), no el `clientId` — si vienes de una pantalla de cliente, asegúrate de usar el ID correcto (revisa `GET /clients/:id`, que trae ambos anidados).

---

### `PATCH /users/:id` 👑 Solo ADMIN

**Cómo se usa:** cambiar rol o activar/desactivar una cuenta desde la gestión de usuarios (distinto de `DELETE /clients/:id`, que es la baja normal de un cliente — este es para administrar la cuenta de acceso en sí, incluida la de otros admins).

**Body:**
```json
{ "isActive": false }
```
o
```json
{ "role": "ADMIN" }
```

---

### `PATCH /users/update-profile-image/:id` 👑 Solo ADMIN

**Cómo se usa:** un admin reemplaza la foto de perfil de **otro** usuario (p. ej. desde el detalle de un cliente en el panel). `multipart/form-data`, mismo campo `avatar` que el autoservicio, pero sin el límite de 2MB del endpoint de autoservicio.

---

### `DELETE /users/delete-profile-image/:id` 👑 Solo ADMIN o dueño de la cuenta

**Cómo se usa:** un ADMIN puede borrar la foto de cualquier usuario; un usuario normal solo puede borrar la suya propia (`:id` debe coincidir con su propio `id` de usuario, si no, 400).

---

## 15. UPLOADS (Archivos estáticos)

Los archivos subidos son accesibles directamente desde el servidor (no requieren token para leerse una vez que conoces la URL):

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
PATCH /users/profile → guardar dirección, fecha de nacimiento, teléfono, contacto de emergencia
POST /users/upload-profile-image → subir foto (multipart/form-data, máx 2MB)
```

### Flujo 5 — Cliente ve su membresía y reserva una clase

```
GET /memberships/my → mostrar membresía activa y fecha de vencimiento
GET /classes/schedule?date=... → mostrar horario con lugares disponibles
POST /reservations { classId } → confirmar reserva
GET /notifications/my → ver notificaciones pendientes
```

### Flujo 6 — Cliente paga por transferencia

```
POST /payments/transfer (multipart: membershipId, amount o months, voucher)
  → status: PENDING → esperar aprobación del admin
  → Admin ve en GET /payments/pending
  → Admin aprueba: PATCH /payments/approve/:id
  → Si el pago tenía months, la membresía se extiende AQUÍ (no antes)
  → Cliente recibe email de confirmación
```

### Flujo 7 — Cliente paga con tarjeta (MercadoPago)

```
GET /payments/config/mp-public-key → obtener publicKey
  → Inicializar SDK JS de MercadoPago con esa publicKey
  → Formulario de tarjeta del SDK → obtener cardToken + paymentMethodId (+ issuerId)
POST /payments/card { membershipId, amount, cardToken, paymentMethodId, payerEmail, months? }
  → status puede ser APPROVED, PENDING o REJECTED — manejar los tres en el UI
  → Si months fue enviado y quedó APPROVED, la membresía se extiende automáticamente
```

### Flujo 8 — Admin revisa el dashboard

```
GET /reports/dashboard → resumen general
GET /reports/monthly-income-chart → gráfica de ingresos
GET /reports/recent-activity → feed de actividad reciente
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
| `TERMINAL` | Terminal/tarjeta física en mostrador |
| `CARD` | Tarjeta en línea vía MercadoPago (`POST /payments/card`) |

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

### `NotificationType`
| Valor | Descripción |
|-------|-------------|
| `INFO` | Informativa |
| `SUCCESS` | Confirmación / éxito |
| `WARNING` | Advertencia |
| `ERROR` | Error |
| `EXPIRY_WARNING` | Aviso de vencimiento de membresía |
| `MANUAL` | Creada manualmente por un admin |

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
| `400` | Bad Request — datos inválidos o regla de negocio (revisa `message`, suele traer el detalle exacto) |
| `401` | Unauthorized — token inválido, expirado o ausente |
| `403` | Forbidden — no tiene permiso para ese recurso, o `mustChangePassword` pendiente |
| `404` | Not Found — recurso no encontrado |
| `409` | Conflict — duplicado (email repetido, reserva duplicada) |
| `429` | Too Many Requests — límite de intentos superado (`POST /auth/login`: máx. 5/min) |
| `500` | Server Error — error interno |
