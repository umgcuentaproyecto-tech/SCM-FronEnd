# Sistema SCM - Frontend

Frontend del Sistema de Gestión de Inventario y Compras (SCM).

## Estructura

- `index.html` - Página de login
- `dashboard.html` - Dashboard principal (protegido)
- `config.js` - Configuración de API y funciones de autenticación
- `login.js` - Lógica del formulario de login
- `dashboard.js` - Lógica del dashboard
- `styles.css` - Estilos personalizados

## Características

- ✅ Login con email y contraseña
- ✅ Validación de formularios en tiempo real
- ✅ Almacenamiento de sesión con localStorage
- ✅ Protección de rutas (redirección automática)
- ✅ Recordarme (opcional)
- ✅ Interfaz responsiva y moderna
- ✅ Integración con API backend

## Uso

1. Abre `index.html` en tu navegador
2. Ingresa credenciales válidas (correo y contraseña registrados en la BD)
3. Si es válido, serás redirigido al dashboard
4. Para cerrar sesión, haz click en "Cerrar Sesión"

## API Endpoints Utilizados

- `GET /api/usuarios` - Listar usuarios
- `POST /api/usuarios` - Crear usuario (en el futuro para registro)

## Nota

Actualmente el login compara el correo contra la lista de usuarios. 
Para seguridad, se recomienda implementar un endpoint `/api/login` en el backend que valide password de forma segura.
