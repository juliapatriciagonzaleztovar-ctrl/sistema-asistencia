# Guia de Despliegue - Sistema de Asistencia

## Despliegue en Supabase

### 1. Crear Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Inicia sesión o crea una cuenta
3. Haz clic en "New Project"
4. Completa los datos:
   - **Organization**: Selecciona o crea una
   - **Project name**: `sistema-asistencia`
   - **Database Password**: Genera una contraseña segura
   - **Region**: Selecciona la más cercana (US West o South America)
5. Haz clic en "Create new project"
6. Espera a que el proyecto esté listo (2-3 minutos)

### 2. Crear Tablas de Base de Datos

1. Ve a **SQL Editor** en el panel de Supabase
2. Haz clic en "New query"
3. Copia y pega todo el contenido de `database/schema.sql`
4. Haz clic en "Run" para ejecutar el script
5. Verifica que todas las tablas se crearon correctamente en **Table Editor**

### 3. Configurar Autenticación

1. Ve a **Authentication > Providers**
2. Asegúrate de que "Email" esté habilitado
3. Ve a **Authentication > Settings**
4. Desactiva "Confirm email" para desarrollo (opcional)

### 4. Obtener Credenciales

1. Ve a **Project Settings > API**
2. Copia:
   - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
   - **anon public key** (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - **service_role key** (SUPABASE_SERVICE_ROLE_KEY)

## Despliegue en Vercel

### 1. Preparar el Repositorio

```bash
# Inicializar repositorio git
cd sistema-asistencia
git init
git add .
git commit -m "Initial commit: Sistema de Asistencia"
```

### 2. Crear Repositorio en GitHub

1. Ve a [https://github.com](https://github.com)
2. Crea un nuevo repositorio: `sistema-asistencia`
3. Sigue las instrucciones para subir el código:
```bash
git remote add origin https://github.com/TU-USUARIO/sistema-asistencia.git
git branch -M main
git push -u origin main
```

### 3. Desplegar en Vercel

1. Ve a [https://vercel.com](https://vercel.com)
2. Inicia sesión con tu cuenta de GitHub
3. Haz clic en "New Project"
4. Selecciona el repositorio `sistema-asistencia`
5. Configura las variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL` = tu URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = tu service role key
6. Haz clic en "Deploy"
7. Espera a que el despliegue termine (1-2 minutos)

### 4. Configurar Dominio Personalizado (Opcional)

1. En el panel de Vercel, ve a **Settings > Domains**
2. Agrega tu dominio personalizado
3. Configura los registros DNS según las instrucciones de Vercel

## Configuración Post-Despliegue

### 1. Crear Super Administrador

Después del despliegue, necesitas crear el primer usuario Super Administrador. Puedes hacerlo desde el SQL Editor de Supabase:

```sql
-- Primero, crea el usuario en auth
-- Ve a Authentication > Users > Add user
-- Email: admin@institucion.com
-- Password: TuContraseñaSegura123!
-- Marca "Auto Confirm Email"

-- Luego, inserta el perfil
INSERT INTO profiles (id, email, display_name, role)
VALUES (
  'id-del-usuario-aqui',  -- Reemplaza con el ID del usuario creado
  'admin@institucion.com',
  'Super Administrador',
  'super_admin'
);
```

### 2. Crear Operadores

Desde la interfaz del Super Administrador:
1. Inicia sesión con las credenciales del admin
2. Ve a **Usuarios > Crear Usuario**
3. Crea los 2 operadores con sus credenciales

### 3. Configurar Grupos

Desde la interfaz:
1. Ve a **Grupos > Crear Grupo**
2. Crea los grupos necesarios:
   - Caminadores
   - Párvulos
   - Prejardín
   - Jardín
   - Transición

## Solución de Problemas

### Error de CORS
Si ves errores de CORS en la consola:
1. Ve a Supabase > **Project Settings > API**
2. En **Additional allowed CORS origins**, agrega la URL de tu app Vercel

### Error de Autenticación
- Verifica que las variables de entorno estén correctamente configuradas
- Asegúrate de que el usuario tenga un perfil en la tabla `profiles`

### Error en las Tablas
- Verifica que el script SQL se ejecutó correctamente
- Revisa que las RLS policies estén activas

## Comandos Útiles

```bash
# Ejecutar localmente
npm run dev

# Build de producción
npm run build

# Analizar el build
npm run build -- --analyze
```