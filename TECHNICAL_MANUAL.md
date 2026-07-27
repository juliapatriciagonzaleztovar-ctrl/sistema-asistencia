# Manual Técnico - Sistema de Gestión de Asistencia

## Arquitectura del Sistema

### Stack Tecnológico
- **Frontend**: Next.js 14+ (App Router), React, TypeScript
- **Estilos**: Tailwind CSS
- **Backend/Database**: Supabase (PostgreSQL + Auth + Realtime)
- **Despliegue**: Vercel (Frontend) + Supabase Cloud (Backend)
- **PWA**: Service Worker + manifest.json

### Estructura de Directorios

```
sistema-asistencia/
├── src/
│   ├── app/                    # App Router (Next.js 14+)
│   │   ├── layout.tsx          # Layout principal con auth
│   │   ├── page.tsx            # Redirect a /login
│   │   ├── login/              # Página de login
│   │   ├── dashboard/          # Dashboard principal
│   │   ├── children/           # CRUD de niños
│   │   ├── groups/             # CRUD de grupos
│   │   ├── teachers/           # CRUD de profesores
│   │   ├── practitioners/      # CRUD de practicantes
│   │   ├── attendance/
│   │   │   ├── children/       # Asistencia infantil
│   │   │   └── staff/          # Asistencia personal + firma
│   │   ├── reports/            # Reportes + exportación
│   │   ├── audit/              # Logs de auditoría
│   │   ├── users/              # Gestión de usuarios
│   │   └── settings/           # Configuración del sistema
│   ├── components/
│   │   ├── layout/             # Sidebar, ThemeToggle
│   │   ├── ui/                 # Button, Input, Modal, Card
│   │   ├── children/           # Componentes de niños
│   │   ├── attendance/         # Componentes de asistencia
│   │   ├── reports/            # Componentes de reportes
│   │   └── audit/              # Componentes de auditoría
│   ├── lib/
│   │   ├── supabase.ts         # Cliente Supabase (browser)
│   │   ├── supabaseServer.ts   # Cliente Supabase (server)
│   │   ├── auth.ts             # Funciones de autenticación
│   │   ├── attendance.ts       # Funciones de asistencia
│   │   ├── audit.ts            # Funciones de auditoría
│   │   ├── export.ts           # Exportación PDF/Excel
│   │   └── utils.ts            # Utilidades generales
│   ├── hooks/
│   │   └── useAuth.ts          # Hook de autenticación
│   └── types/
│       └── database.ts         # Tipos TypeScript del schema
├── database/
│   └── schema.sql              # Schema completo de PostgreSQL
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service Worker
│   └── icons/                  # Iconos PWA
└── .env.local                  # Variables de entorno (no commitear)
```

### Modelo de Base de Datos

#### Diagrama Entidad-Relación

```
┌──────────────┐     ┌──────────────┐
│   profiles   │     │    groups    │
│──────────────│     │──────────────│
│ id (PK)      │     │ id (PK)      │
│ email        │     │ name         │
│ display_name │     │ description  │
│ role         │     │ created_at   │
└──────────────┘     └──────────────┘
                            │
                            │ 1:N
                            ▼
┌──────────────┐     ┌──────────────┐
│   children   │────▶│  attendance_ │
│──────────────│     │   children   │
│ id (PK)      │     │──────────────│
│ first_name   │     │ id (PK)      │
│ last_name    │     │ child_id (FK)│
│ date_of_birth│     │ attendance_  │
│ group_id (FK)│     │   date       │
│ shift        │     │ status       │
│ status       │     │ registered_by│
└──────────────┘     └──────────────┘

┌──────────────┐     ┌──────────────┐
│  teachers    │────▶│  attendance_ │
│──────────────│     │    staff     │
│ id (PK)      │     │──────────────│
│ first_name   │     │ id (PK)      │
│ last_name    │     │ staff_id (FK)│
│ email        │     │ staff_type   │
│ phone        │     │ check_in     │
│ status       │     │ check_out    │
└──────────────┘     │ signature_url│
                     └──────────────┘

┌──────────────┐
│ audit_logs   │
│──────────────│
│ id (PK)      │
│ user_id (FK) │
│ action       │
│ entity_type  │
│ entity_id    │
│ details      │
│ created_at   │
└──────────────┘
```

### Roles y Permisos

| Acción | Super Admin | Operador |
|--------|:-----------:|:--------:|
| Ver Dashboard | ✅ | ✅ |
| CRUD Niños | ✅ | ❌ |
| CRUD Grupos | ✅ | ❌ |
| CRUD Profesores | ✅ | ❌ |
| CRUD Practicantes | ✅ | ❌ |
| Registrar Asistencia Niños | ✅ | ✅ |
| Registrar Asistencia Personal | ✅ | ✅ |
| Modificar Asistencia | ✅ | ❌ |
| Ver Reportes | ✅ | ✅ |
| Exportar PDF/Excel | ✅ | ✅ |
| Ver Auditoría | ✅ | ❌ |
| CRUD Usuarios | ✅ | ❌ |
| Configuración | ✅ | ❌ |

### Seguridad

1. **Row Level Security (RLS)**: Todas las tablas tienen RLS habilitado
2. **Autenticación**: Supabase Auth con email/password
3. **Sesiones**: Manejadas por Supabase con cookies HTTP-only
4. **Protección de Rutas**: Middleware de Next.js redirige a login
5. **Auditoría**: Todas las acciones quedan registradas

### Performance

- **SSG/ISR**: Next.js genera páginas estáticas cuando es posible
- **Lazy Loading**: Componentes cargados bajo demanda
- **Optimistic UI**: Actualizaciones inmediatas en la interfaz
- **Índices de BD**: Consultas optimizadas con índices en columnas frecuentes

## Variables de Entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| NEXT_PUBLIC_SUPABASE_URL | URL del proyecto Supabase | https://xxx.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Clave pública de Supabase | eyJhbG... |
| SUPABASE_SERVICE_ROLE_KEY | Clave de servicio (server only) | eyJhbG... |

## Comandos

```bash
# Desarrollo
npm run dev

# Build de producción
npm run build

# Ejecutar build
npm start

# Lint
npm run lint
```

## Tecnologías y Licencias

| Tecnología | Licencia | Uso |
|------------|----------|-----|
| Next.js | MIT | Framework frontend |
| React | MIT | UI library |
| TypeScript | Apache 2.0 | Type safety |
| Tailwind CSS | MIT | Estilos |
| Supabase | Apache 2.0 | Backend/DB |
| Recharts | MIT | Gráficas |
| jsPDF | MIT | Exportación PDF |
| SheetJS (xlsx) | Apache 2.0 | Exportación Excel |
| Heroicons | MIT | Iconografía |

Todas las tecnologías son de código abierto y gratuitas.