// Configuración de la API
const API_CONFIG = {
  baseURL: 'https://scm-backend-production-09d4.up.railway.app/api',
  timeout: 5000,
  endpoints: {
    login: '/usuarios/login',
    usuarios: '/usuarios',
    roles: '/roles',
    clientes: '/clientes',
    productos: '/productos',
    categorias: '/categorias',
    inventarios: '/inventarios',
    pedidos: '/gestion_pedidos',
    almacenes: '/almacenes',
    ubicaciones: '/ubicaciones',
    envios: '/envios',
    rutas: '/rutas',
    transportistas: '/transportistas',
    vehiculos: '/vehiculos',
    proveedores: '/proveedores',
    ordenes: '/ordenes',
    recepciones: '/recepciones',
    compras: '/compras',
    finanzasResumen: '/finanzas/resumen',
    costos: '/finanzas/costos',
    pagos: '/finanzas/pagos'
  }
};

// Helpers para peticiones HTTP
async function apiCall(method, endpoint, data = null) {
  try {
    const url = `${API_CONFIG.baseURL}${endpoint}`;
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    // Incluir token si existe
    const token = localStorage.getItem('authToken');
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, options);
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { /* not json */ }

    if (!response.ok) {
      const technicalMessage = (json && (json.message || json.error || json.details)) || text || response.statusText;
      throw new Error(getUserFriendlyApiError(response.status, technicalMessage));
    }

    if (response.status === 204) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    return json;
  } catch (error) {
    console.error('API Error:', error);
    try { if (typeof window !== 'undefined' && window.showError) window.showError(error.message || 'Error en la petición'); } catch(e) {}
    throw error;
  }
}

function getUserFriendlyApiError(status, message = '') {
  const text = String(message).toLowerCase();

  if (
    status === 409 ||
    text.includes('foreign key') ||
    text.includes('constraint fails') ||
    text.includes('cannot delete or update a parent row') ||
    text.includes('er_row_is_referenced')
  ) {
    if (text.includes('código') || text.includes('codigo')) {
      return 'Ya existe otro producto con ese código. Ingresa un código diferente.';
    }

    return 'No se puede completar la acción porque este registro está relacionado con otros datos del sistema. Revisa inventario, pedidos, compras o movimientos relacionados antes de continuar.';
  }

  if (status === 404 || text.includes('not found')) {
    return 'No se encontró el registro solicitado. Es posible que ya haya sido eliminado o que la información esté desactualizada.';
  }

  if (status === 400) {
    return message && !text.includes('sql') ? message : 'Revisa los datos ingresados. Hay información incompleta o inválida.';
  }

  if (status === 401 || status === 403) {
    return 'No tienes permisos para realizar esta acción o tu sesión ya no está activa.';
  }

  if (status >= 500 || text.includes('sql') || text.includes('database') || text.includes('mysql')) {
    return 'Ocurrió un problema al procesar la solicitud. Inténtalo nuevamente o revisa la información ingresada.';
  }

  return message || 'No se pudo completar la acción. Inténtalo nuevamente.';
}

// Funciones de autenticación
const Auth = {
  async login(correo, password) {
    return apiCall('POST', '/usuarios', { correo, password });
  },

  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('usuario');
    // Usar ruta relativa para que funcione desde servidores estáticos o rutas base
    window.location.href = 'index.html';
  },

  isAuthenticated() {
    return !!localStorage.getItem('authToken');
  },

  getUsuario() {
    const usuario = localStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
  },

  setToken(token) {
    localStorage.setItem('authToken', token);
  },

  setUsuario(usuario) {
    localStorage.setItem('usuario', JSON.stringify(usuario));
  }
};
