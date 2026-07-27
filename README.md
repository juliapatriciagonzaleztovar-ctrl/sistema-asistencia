# Sistema de Gestión de Asistencia - Institución Infantil

Plataforma web moderna para el control digital de asistencia de niños, profesores y practicantes. Reemplaza completamente las planillas físicas.

## Características

- **PWA instalable** como app sin necesidad de Play Store/App Store
- **Diseño responsive** para celular, tablet y computador
- **Modo claro y oscuro**
- **Exportación** a PDF y Excel
- **Firma digital** para profesores y practicantes
- **Auditoría completa** de todas las acciones
- **100% gratuito** (Next.js + Supabase + Vercel)

## Stack

- Next.js 14+ (App Router)
- React + TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + Auth)
- Recharts (Gráficas)
- jsPDF + SheetJS (Exportación)
- Heroicons (Iconografía)

## Inicio Rápido

```bash
# 1. Clonar el repositorio
git clone https://github.com/TU-USUARIO/sistema-asistencia.git
cd sistema-asistencia

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.local.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 4. Ejecutar en desarrollo
npm run dev
```

## Despliegue

Consulta la guía completa en [DEPLOYMENT.md](./DEPLOYMENT.md)

### Pasos resumidos:
1. Crear proyecto en Supabase
2. Ejecutar el script SQL (`database/schema.sql`)
3. Subir código a GitHub
4. Desplegar en Vercel
5. Configurar variables de entorno
6. Crear Super Administrador

## Estructura del Proyecto

```
src/
├── app/          # Páginas (App Router)
├── components/   # Componentes React
├── lib/          # Utilidades y servicios
├── hooks/        # Custom hooks
└── types/        # Tipos TypeScript
```

## Documentación

- [Guía de Despliegue](./DEPLOYMENT.md)
- [Manual Técnico](./TECHNICAL_MANUAL.md)
- [Manual de Usuario](./USER_MANUAL.md)

## Licencia

MIT - Uso libre