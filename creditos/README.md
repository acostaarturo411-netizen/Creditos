# CreditOS — Guía de instalación

## Lo que necesitas
- Una cuenta de Google (ya la tienes)
- 20 minutos

---

## Paso 1 — Crear proyecto en Supabase (gratis)

1. Ve a **https://supabase.com** y haz clic en "Start your project"
2. Inicia sesión con tu cuenta Google
3. Clic en "New project"
4. Ponle nombre: `creditos`
5. Elige una contraseña para la base de datos (guárdala)
6. Región: **US East** (más cercana)
7. Clic en "Create new project" — espera ~2 minutos

---

## Paso 2 — Crear las tablas

1. En tu proyecto de Supabase, ve al menú izquierdo → **SQL Editor**
2. Clic en "New query"
3. Abre el archivo `SUPABASE_SCHEMA.sql` de esta carpeta
4. Copia todo el contenido y pégalo en el editor
5. Clic en **Run** (botón azul)
6. Debes ver "Success" en verde

---

## Paso 3 — Activar login con Google

1. En Supabase, ve a **Authentication** → **Providers**
2. Encuentra "Google" y actívalo
3. Necesitas crear credenciales OAuth en Google:
   - Ve a https://console.cloud.google.com
   - Crea un proyecto nuevo o usa uno existente
   - Ve a "APIs & Services" → "Credentials"
   - Clic en "Create Credentials" → "OAuth client ID"
   - Tipo: "Web application"
   - En "Authorized redirect URIs" agrega: `https://TU_PROYECTO.supabase.co/auth/v1/callback`
   - Copia el Client ID y Client Secret
4. De regreso en Supabase, pega el Client ID y Client Secret
5. Clic en Save

---

## Paso 4 — Conectar el código con Supabase

1. En Supabase ve a **Settings** → **API**
2. Copia la "Project URL" y la "anon public" key
3. Abre el archivo `src/lib/supabase.js` de esta carpeta
4. Reemplaza los valores:
   ```
   const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co'  ← pega tu URL aquí
   const SUPABASE_ANON_KEY = 'TU_ANON_KEY'                 ← pega tu key aquí
   ```
5. Guarda el archivo

---

## Paso 5 — Subir la app a Vercel (gratis)

1. Ve a **https://github.com** y crea una cuenta si no tienes
2. Crea un repositorio nuevo llamado `creditos`
3. Sube todos los archivos de esta carpeta a ese repositorio
4. Ve a **https://vercel.com** e inicia sesión con GitHub
5. Clic en "Add New Project"
6. Selecciona tu repositorio `creditos`
7. Vercel detecta automáticamente que es un proyecto Vite
8. Clic en **Deploy** — espera ~2 minutos
9. Vercel te da una URL tipo `creditos-abc123.vercel.app`

---

## Paso 6 — Agregar tu URL a Supabase

1. Ve a Supabase → **Authentication** → **URL Configuration**
2. En "Site URL" pon tu URL de Vercel: `https://creditos-abc123.vercel.app`
3. En "Redirect URLs" agrega la misma URL
4. Guarda

---

## ¡Listo!

Abre tu URL de Vercel, inicia sesión con Google y CreditOS está funcionando.

**Desde el celular:** Abre la URL en Safari (iPhone) o Chrome (Android) → menú → "Agregar a pantalla de inicio" → se instala como app.

---

## Soporte

Si algo no funciona, los errores más comunes son:
- **"Invalid API key"** → verifica que pegaste bien las claves en supabase.js
- **"Redirect URI mismatch"** → verifica que la URL de Vercel está en Supabase → Authentication → URL Configuration
- **Pantalla en blanco** → abre la consola del navegador (F12) y busca el error en rojo
