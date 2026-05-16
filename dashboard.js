// Verificar autenticación
if (!Auth.isAuthenticated()) {
  window.location.href = 'index.html';
}

let usuarioActual = null;
let modalUsuario = null;
let modalCliente = null;
let pedidoItems = [];
let pedidoEditOriginalItems = [];
let pedidoEditOriginalEstado = 'pendiente';
let productosCache = [];
let clientesCache = [];
let categoriasCache = [];
let inventariosCache = [];
let proveedoresCache = [];
let ordenesCache = [];
let recepcionesCache = [];
let comprasCache = [];
let almacenesCache = [];
let ordenLineas = [];
let costosCache = [];
let pagosCache = [];
let pedidosCache = [];
let enviosCache = [];
let enviosLoaded = false;

function isDigitsOnly(value) {
  if (value === undefined || value === null) return false;
  const str = String(value).trim();
  return str.length > 0 && /^[0-9]+$/.test(str);
}

document.addEventListener('DOMContentLoaded', async function() {
  usuarioActual = Auth.getUsuario();
  modalUsuario = new bootstrap.Modal(document.getElementById('usuarioModal'));
  modalCliente = new bootstrap.Modal(document.getElementById('clienteModal'));

  cargarClientes();
  cargarCategorias().finally(async () => {
    await cargarProductos();
    cargarInventarios();
  });
  await cargarEnvios();
  cargarPedidos();
  cargarAlmacenes();
  cargarTransportistas();
  cargarVehiculos();
  cargarRutas();
  cargarProveedores();
  await cargarPagos();
  cargarOrdenes();
  cargarRecepciones();
  cargarCompras();
  cargarResumenFinanzas();
  cargarCostos();

  const pagoOrdenSelect = document.getElementById('pagoOrden');
  const pagoProveedorSelect = document.getElementById('pagoProveedor');
  if (pagoOrdenSelect) pagoOrdenSelect.addEventListener('change', onPagoOrdenChange);
  if (pagoProveedorSelect) pagoProveedorSelect.addEventListener('change', onPagoProveedorChange);
  actualizarBloqueoCamposPago();

  if (usuarioActual) {
    document.getElementById('usuarioNombre').textContent = usuarioActual.nombre;
    document.getElementById('usuarioInfo').innerHTML = `
      <div class="alert alert-info">
        <strong>Usuario:</strong> ${usuarioActual.nombre}<br>
        <strong>Correo:</strong> ${usuarioActual.correo}<br>
        <strong>Rol:</strong> ${usuarioActual.role_name || 'N/A'}<br>
        <strong>Estado:</strong> ${usuarioActual.estado === 1 ? 'Activo' : 'Inactivo'}
      </div>
    `;

    // Mostrar pestaña de administración solo si es administrador (id_rol = 1)
    if (usuarioActual.id_rol === 1) {
      document.getElementById('adminTabContainer').style.display = '';
      cargarRoles();
      cargarUsuarios();
      inicializarEventosAdmin();
    }
    // Aplicar permisos por rol (mostrar/ocultar pestañas)
    applyRolePermissions(usuarioActual.role_name || usuarioActual.id_rol);
  }

  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    Auth.logout();
  });

  // --- FUNCIONES DE PERMISOS POR ROL ---
  function applyRolePermissions(roleIdentifier) {
    // roleIdentifier puede ser nombre ('Administrador') o id
    const roleName = typeof roleIdentifier === 'string' ? roleIdentifier : null;

    const normalizeRole = (name) => {
      if (!name) return null;
      return String(name).trim().toLowerCase().replace(/\s+/g, '_');
    };

    // Mapeo de rol -> módulos permitidos (ids de pestañas / targets)
    const accessMap = {
      'administrador': 'all',
      'compras_suministros': ['compras', 'suministros'],
      'bodega': ['inventarios'],
      'transporte_almacenes': ['transportes', 'almacenes'],
      'finanzas': ['finanzas'],
      'pedidos': ['pedidos']
    };

    // Determinar permisos
    let allowed = 'all';
    const normalizedRole = normalizeRole(roleName);
    if (normalizedRole && accessMap[normalizedRole]) allowed = accessMap[normalizedRole];

    const navLinks = document.querySelectorAll('#modulosTabs .nav-link');
    navLinks.forEach(link => {
      const target = link.getAttribute('data-bs-target') || link.getAttribute('data-target') || '';
      const id = target.replace('#', '');

      let show = true;
      if (allowed !== 'all') {
        show = allowed.includes(id);
        // Always allow 'inicio' for basic access
        if (id === 'inicio') show = true;
      }

      // ocultar pestaña (<li> wrapper)
      const li = link.closest('.nav-item');
      if (li) li.style.display = show ? '' : 'none';
    });

    // Si la pestaña activa no está permitida, activar la primera permitida
    const activeTab = document.querySelector('#modulosTabs .nav-link.active');
    if (activeTab) {
      const activeId = (activeTab.getAttribute('data-bs-target') || '').replace('#','');
      if (allowed !== 'all' && activeId && activeId !== 'inicio' && !allowed.includes(activeId)) {
        // seleccionar primer nav-link visible
        const firstVisible = Array.from(navLinks).find(l => l.closest('.nav-item').style.display !== 'none');
        if (firstVisible) {
          const bsTab = new bootstrap.Tab(firstVisible);
          bsTab.show();
        }
      }
    }
  }

  document.getElementById('btnNuevoCliente').addEventListener('click', nuevoCliente);
  document.getElementById('btnGuardarCliente').addEventListener('click', guardarCliente);
  document.getElementById('btnAgregarItem').addEventListener('click', agregarItemPedido);
  document.getElementById('btnCrearPedido').addEventListener('click', crearPedido);
  const btnCancelarPedido = document.getElementById('btnCancelarPedido');
  if (btnCancelarPedido) btnCancelarPedido.addEventListener('click', cancelarPedidoEdicion);
  document.getElementById('formAlmacen').addEventListener('submit', guardarAlmacen);
  document.getElementById('btnCancelarAlmacen').addEventListener('click', cancelarAlmacen);
  document.getElementById('formTransportista').addEventListener('submit', guardarTransportista);
  document.getElementById('formVehiculo').addEventListener('submit', guardarVehiculo);
  document.getElementById('formRuta').addEventListener('submit', guardarRuta);
  document.getElementById('formEnvio').addEventListener('submit', crearEnvio);
  const envioPedidoSelect = document.getElementById('envio_pedido');
  if (envioPedidoSelect) envioPedidoSelect.addEventListener('change', actualizarDetallePedidoEnvio);
  document.getElementById('formProveedor').addEventListener('submit', guardarProveedor);
  document.getElementById('btnCancelarProveedor').addEventListener('click', cancelarProveedor);
  document.getElementById('formOrden').addEventListener('submit', guardarOrden);
  const btnAgregarLineaOrden = document.getElementById('btnAgregarLineaOrden');
  if (btnAgregarLineaOrden) btnAgregarLineaOrden.addEventListener('click', agregarLineaOrden);
  document.getElementById('formRecepcion').addEventListener('submit', guardarRecepcion);
  document.getElementById('formCompra').addEventListener('submit', guardarCompra);
  document.getElementById('formCosto').addEventListener('submit', guardarCosto);
  document.getElementById('formPago').addEventListener('submit', guardarPago);
  inicializarEventosInventario();
});

// Transportistas
function limpiarFormularioTransportista() {
  document.getElementById('formTransportista').reset();
  document.getElementById('transportistaId').value = '';
  const btn = document.querySelector('#formTransportista button');
  if (btn) btn.textContent = 'Guardar Transportista';
}

async function cargarTransportistas() {
  try {
    const rows = await apiCall('GET', API_CONFIG.endpoints.transportistas);
    const tbody = document.getElementById('transportistasTable');
    const vehSelect = document.getElementById('vehiculo_transportista');
    const envioTransportista = document.getElementById('envio_transportista');
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay transportistas</td></tr>';
      vehSelect.innerHTML = '<option value="">Seleccionar transportista...</option>';
      envioTransportista.innerHTML = '<option value="">Transportista...</option>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.id_transportista}</td>
        <td>${r.nombre_transportista}</td>
        <td>${r.telefono || '-'}</td>
        <td>${r.correo || '-'}</td>
        <td>
          <button class="btn btn-sm btn-warning me-1" onclick="editarTransportista(${r.id_transportista})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarTransportista(${r.id_transportista})">Eliminar</button>
        </td>
      </tr>
    `).join('');

    vehSelect.innerHTML = '<option value="">Seleccionar transportista...</option>' + rows.map(r => `<option value="${r.id_transportista}">${r.nombre_transportista}</option>`).join('');
    envioTransportista.innerHTML = '<option value="">Transportista...</option>' + rows.map(r => `<option value="${r.id_transportista}">${r.nombre_transportista}</option>`).join('');
  } catch (err) { console.error('Error cargando transportistas', err); }
}

async function guardarTransportista(e) {
  e.preventDefault();
  const id = document.getElementById('transportistaId').value;
  const nombre = document.getElementById('nombre_transportista').value.trim();
  const telefono = document.getElementById('telefono_transportista').value.trim();
  const correo = document.getElementById('correo_transportista').value.trim();
  const tipo = document.getElementById('tipo_transportista').value;
  if (!nombre) return showError('Nombre es requerido');
  if (telefono && !isDigitsOnly(telefono)) return showError('El teléfono debe contener solo dígitos');
  try {
    const payload = { nombre_transportista: nombre, telefono, correo, tipo };
    if (id) {
      await apiCall('PUT', `${API_CONFIG.endpoints.transportistas}/${id}`, payload);
      showSuccess('Transportista actualizado');
    } else {
      await apiCall('POST', API_CONFIG.endpoints.transportistas, payload);
      showSuccess('Transportista guardado');
    }
    limpiarFormularioTransportista();
    cargarTransportistas();
  } catch (err) { alert('Error: ' + err.message); }
}

async function editarTransportista(id) {
  try {
    const t = await apiCall('GET', `${API_CONFIG.endpoints.transportistas}/${id}`);
    document.getElementById('transportistaId').value = t.id_transportista || id;
    document.getElementById('nombre_transportista').value = t.nombre_transportista || '';
    document.getElementById('telefono_transportista').value = t.telefono || '';
    document.getElementById('correo_transportista').value = t.correo || '';
    document.getElementById('tipo_transportista').value = t.tipo || 'EXTERNO';
    const btn = document.querySelector('#formTransportista button'); if (btn) btn.textContent = 'Actualizar Transportista';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) { alert('Error cargando transportista: ' + err.message); }
}

window.eliminarTransportista = async function(id) {
  if (!confirm('Eliminar transportista?')) return;
  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.transportistas}/${id}`);
    if (document.getElementById('transportistaId').value === String(id)) {
      limpiarFormularioTransportista();
    }
    cargarTransportistas();
  } catch (err) { alert('Error: ' + err.message); }
}

// Vehículos
function limpiarFormularioVehiculo() {
  document.getElementById('formVehiculo').reset();
  document.getElementById('vehiculoId').value = '';
  const btn = document.querySelector('#formVehiculo button');
  if (btn) btn.textContent = 'Guardar Vehículo';
}

async function cargarVehiculos() {
  try {
    const rows = await apiCall('GET', API_CONFIG.endpoints.vehiculos);
    const tbody = document.getElementById('vehiculosTable');
    const vehSelect = document.getElementById('envio_vehiculo');
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay vehículos</td></tr>';
      vehSelect.innerHTML = '<option value="">Vehículo...</option>';
      return;
    }
    tbody.innerHTML = rows.map(v => `
      <tr>
        <td>${v.id_vehiculo}</td>
        <td>${v.placa}</td>
        <td>${v.marca || '-'}</td>
        <td>${v.nombre_transportista || '-'}</td>
        <td>
          <button class="btn btn-sm btn-warning me-1" onclick="editarVehiculo(${v.id_vehiculo})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarVehiculo(${v.id_vehiculo})">Eliminar</button>
        </td>
      </tr>
    `).join('');
    vehSelect.innerHTML = '<option value="">Vehículo...</option>' + rows.map(v => `<option value="${v.id_vehiculo}">${v.placa} - ${v.marca||''}</option>`).join('');
  } catch (err) { console.error('Error cargando vehiculos', err); }
}

async function guardarVehiculo(e) {
  e.preventDefault();
  const id = document.getElementById('vehiculoId').value;
  const placa = document.getElementById('placa').value.trim();
  const marca = document.getElementById('marca').value.trim();
  const modelo = document.getElementById('modelo').value.trim();
  const capacidad = Number(document.getElementById('capacidad_carga').value || 0);
  const id_transportista = document.getElementById('vehiculo_transportista').value || null;
  if (!placa) return alert('Placa requerida');
  try {
    const payload = { placa, marca, modelo, capacidad_carga: capacidad, id_transportista };
    if (id) {
      await apiCall('PUT', `${API_CONFIG.endpoints.vehiculos}/${id}`, payload);
      alert('Vehículo actualizado');
    } else {
      await apiCall('POST', API_CONFIG.endpoints.vehiculos, payload);
      alert('Vehículo guardado');
    }
    limpiarFormularioVehiculo();
    cargarVehiculos();
  } catch (err) { alert('Error: ' + err.message); }
}

async function editarVehiculo(id) {
  try {
    const v = await apiCall('GET', `${API_CONFIG.endpoints.vehiculos}/${id}`);
    document.getElementById('vehiculoId').value = v.id_vehiculo || id;
    document.getElementById('placa').value = v.placa || '';
    document.getElementById('marca').value = v.marca || '';
    document.getElementById('modelo').value = v.modelo || '';
    document.getElementById('capacidad_carga').value = v.capacidad_carga || '';
    document.getElementById('vehiculo_transportista').value = v.id_transportista || '';
    const btn = document.querySelector('#formVehiculo button'); if (btn) btn.textContent = 'Actualizar Vehículo';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) { alert('Error cargando vehículo: ' + err.message); }
}

window.eliminarVehiculo = async function(id) {
  if (!confirm('Eliminar vehículo?')) return;
  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.vehiculos}/${id}`);
    if (document.getElementById('vehiculoId').value === String(id)) {
      limpiarFormularioVehiculo();
    }
    cargarVehiculos();
  } catch (err) { alert('Error: ' + err.message); }
}

// Rutas
function limpiarFormularioRuta() {
  document.getElementById('formRuta').reset();
  document.getElementById('rutaId').value = '';
  const btn = document.querySelector('#formRuta button');
  if (btn) btn.textContent = 'Guardar Ruta';
}

async function cargarRutas() {
  try {
    const rows = await apiCall('GET', API_CONFIG.endpoints.rutas);
    const tbody = document.getElementById('rutasTable');
    const envioRuta = document.getElementById('envio_ruta');
    if (!rows || rows.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay rutas</td></tr>'; envioRuta.innerHTML = '<option value="">Ruta...</option>'; return; }
    tbody.innerHTML = rows.map(r => `<tr><td>${r.id_ruta}</td><td>${r.nombre_ruta}</td><td>${r.origen}</td><td>${r.destino}</td><td><button class="btn btn-sm btn-warning me-1" onclick="editarRuta(${r.id_ruta})">Editar</button><button class="btn btn-sm btn-danger" onclick="eliminarRuta(${r.id_ruta})">Eliminar</button></td></tr>`).join('');
    envioRuta.innerHTML = '<option value="">Ruta...</option>' + rows.map(r => `<option value="${r.id_ruta}">${r.nombre_ruta}</option>`).join('');
  } catch (err) { console.error('Error cargando rutas', err); }
}

async function guardarRuta(e) {
  e.preventDefault();
  const id = document.getElementById('rutaId').value;
  const nombre = document.getElementById('nombre_ruta').value.trim();
  const origen = document.getElementById('origen').value.trim();
  const destino = document.getElementById('destino').value.trim();
  const distancia = Number(document.getElementById('distancia_km').value || 0);
  if (!nombre||!origen||!destino) return alert('Campos requeridos');
  try {
    const payload = { nombre_ruta: nombre, origen, destino, distancia_km: distancia };
    if (id) {
      await apiCall('PUT', `${API_CONFIG.endpoints.rutas}/${id}`, payload);
      alert('Ruta actualizada');
    } else {
      await apiCall('POST', API_CONFIG.endpoints.rutas, payload);
      alert('Ruta guardada');
    }
    limpiarFormularioRuta();
    cargarRutas();
  } catch (err) { alert('Error: ' + err.message); }
}

async function editarRuta(id) {
  try {
    const r = await apiCall('GET', `${API_CONFIG.endpoints.rutas}/${id}`);
    document.getElementById('rutaId').value = r.id_ruta || id;
    document.getElementById('nombre_ruta').value = r.nombre_ruta || '';
    document.getElementById('origen').value = r.origen || '';
    document.getElementById('destino').value = r.destino || '';
    document.getElementById('distancia_km').value = r.distancia_km || '';
    const btn = document.querySelector('#formRuta button'); if (btn) btn.textContent = 'Actualizar Ruta';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) { alert('Error cargando ruta: ' + err.message); }
}

window.eliminarRuta = async function(id) {
  if (!confirm('Eliminar ruta?')) return;
  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.rutas}/${id}`);
    if (document.getElementById('rutaId').value === String(id)) {
      limpiarFormularioRuta();
    }
    cargarRutas();
  } catch (err) { alert('Error: ' + err.message); }
}

// Envíos
function limpiarFormularioEnvio() {
  document.getElementById('formEnvio').reset();
  document.getElementById('envioId').value = '';
  const detalle = document.getElementById('envioPedidoDetalle');
  if (detalle) {
    detalle.innerHTML = 'Selecciona un pedido para ver sus productos vinculados al inventario.';
  }
  const btn = document.querySelector('#formEnvio button');
  if (btn) btn.textContent = 'Crear Envío';
}

async function cargarEnvios() {
  try {
    const rows = await apiCall('GET', API_CONFIG.endpoints.envios);
    enviosCache = rows || [];
    enviosLoaded = true;
    const tbody = document.getElementById('enviosTable');
    if (!rows || rows.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay envíos</td></tr>'; return; }
    tbody.innerHTML = rows.map(e => `
      <tr>
        <td>${e.id_envio}</td>
        <td>${e.id_pedido ? `#${e.id_pedido} - ${e.pedido_cliente || 'Pedido'}` : '-'}</td>
        <td>${e.direccion_entrega}</td>
        <td>${e.nombre_transportista || '-'}</td>
        <td>${e.placa || '-'}</td>
        <td>${e.nombre_ruta || '-'}</td>
        <td>${e.pedido_productos || '-'}</td>
        <td>
          <button class="btn btn-sm btn-warning me-1" onclick="editarEnvio(${e.id_envio})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarEnvio(${e.id_envio})">Eliminar</button>
        </td>
      </tr>`).join('');
  } catch (err) { console.error('Error cargando envios', err); }
}

async function crearEnvio(e) {
  e.preventDefault();
  const id = document.getElementById('envioId').value;
  const id_pedido = document.getElementById('envio_pedido').value || null;
  const direccion = document.getElementById('direccion_entrega').value.trim();
  const id_transportista = document.getElementById('envio_transportista').value || null;
  const id_vehiculo = document.getElementById('envio_vehiculo').value || null;
  const id_ruta = document.getElementById('envio_ruta').value || null;
  if (!direccion) return alert('Dirección requerida');

  if (id_pedido) {
    const alreadyAssigned = enviosCache.some(envio => String(envio.id_pedido) === String(id_pedido) && String(envio.id_envio) !== String(id));
    if (alreadyAssigned) {
      return alert('Este pedido ya tiene un envío asignado.');
    }
  }

  try {
    const payload = { id_pedido, direccion_entrega: direccion, id_transportista, id_vehiculo, id_ruta };
    if (id) {
      await apiCall('PUT', `${API_CONFIG.endpoints.envios}/${id}`, payload);
      alert('Envío actualizado');
    } else {
      await apiCall('POST', API_CONFIG.endpoints.envios, payload);
      alert('Envío creado');
    }
    limpiarFormularioEnvio();
    await cargarEnvios();
    await cargarPedidos();
  } catch (err) { alert('Error: ' + err.message); }
}

async function editarEnvio(id) {
  try {
    const e = await apiCall('GET', `${API_CONFIG.endpoints.envios}/${id}`);
    document.getElementById('envioId').value = e.id_envio || id;
    document.getElementById('envio_pedido').value = e.id_pedido || '';
    document.getElementById('direccion_entrega').value = e.direccion_entrega || '';
    document.getElementById('envio_transportista').value = e.id_transportista || '';
    document.getElementById('envio_vehiculo').value = e.id_vehiculo || '';
    document.getElementById('envio_ruta').value = e.id_ruta || '';
    await cargarPedidos();
    await actualizarDetallePedidoEnvio();
    const btn = document.querySelector('#formEnvio button'); if (btn) btn.textContent = 'Actualizar Envío';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) { alert('Error cargando envío: ' + err.message); }
}

window.eliminarEnvio = async function(id) {
  if (!confirm('Eliminar envío?')) return;
  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.envios}/${id}`);
    if (document.getElementById('envioId').value === String(id)) {
      limpiarFormularioEnvio();
    }
    await cargarEnvios();
    await cargarPedidos();
  } catch (err) { alert('Error: ' + err.message); }
}


// Cargar lista de roles
async function cargarRoles() {
  try {
    const roles = await apiCall('GET', API_CONFIG.endpoints.roles);
    const selectRol = document.getElementById('id_rol');
    selectRol.innerHTML = '<option value="">Seleccionar rol...</option>';
    
    roles.forEach(rol => {
      const option = document.createElement('option');
      option.value = rol.id_rol;
      option.textContent = rol.nombre_rol;
      selectRol.appendChild(option);
    });
  } catch (error) {
    console.error('Error cargando roles:', error);
  }
}

// Cargar lista de usuarios
async function cargarUsuarios() {
  try {
    const usuarios = await apiCall('GET', API_CONFIG.endpoints.usuarios);
    const tbody = document.getElementById('usuariosTable');
    
    if (!usuarios || usuarios.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay usuarios</td></tr>';
      return;
    }

    tbody.innerHTML = usuarios.map(usuario => `
      <tr>
        <td>${usuario.id_usuario}</td>
        <td>${usuario.nombre}</td>
        <td>${usuario.correo}</td>
        <td>${usuario.role_name || 'N/A'}</td>
        <td>
          <span class="badge ${usuario.estado === 1 ? 'bg-success' : 'bg-danger'}">
            ${usuario.estado === 1 ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="editarUsuario(${usuario.id_usuario})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarUsuario(${usuario.id_usuario}, '${usuario.nombre}')">Eliminar</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error cargando usuarios:', error);
    document.getElementById('usuariosTable').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al cargar usuarios</td></tr>';
  }
}

// Inicializar eventos de administración
function inicializarEventosAdmin() {
  document.getElementById('btnNuevoUsuario').addEventListener('click', nuevoUsuario);
  document.getElementById('btnGuardarUsuario').addEventListener('click', guardarUsuario);
}

// Nuevo usuario
function nuevoUsuario() {
  document.getElementById('usuarioForm').reset();
  document.getElementById('usuarioId').value = '';
  document.getElementById('modalTitle').textContent = 'Nuevo Usuario';
  document.getElementById('password').required = true;
  document.getElementById('mensajeError').style.display = 'none';
  modalUsuario.show();
}

// Editar usuario
async function editarUsuario(id) {
  try {
    const response = await apiCall('GET', `${API_CONFIG.endpoints.usuarios}/${id}`);
    
    document.getElementById('usuarioId').value = response.id_usuario;
    document.getElementById('nombre').value = response.nombre;
    document.getElementById('correo').value = response.correo;
    document.getElementById('id_rol').value = response.id_rol || '';
    document.getElementById('telefono').value = response.telefono || '';
    document.getElementById('estado').value = response.estado;
    document.getElementById('password').value = '';
    document.getElementById('password').required = false;
    
    document.getElementById('modalTitle').textContent = 'Editar Usuario';
    document.getElementById('mensajeError').style.display = 'none';
    modalUsuario.show();
  } catch (error) {
    alert('Error al cargar usuario: ' + error.message);
  }
}

// Guardar usuario
async function guardarUsuario() {
  const id = document.getElementById('usuarioId').value;
  const nombre = document.getElementById('nombre').value.trim();
  const correo = document.getElementById('correo').value.trim();
  const password = document.getElementById('password').value;
  const id_rol = document.getElementById('id_rol').value;
  const telefono = document.getElementById('telefono').value.trim();
  const estado = document.getElementById('estado').value;
  const mensajeError = document.getElementById('mensajeError');

  // Validación
  if (!nombre || !correo) {
    mensajeError.textContent = 'Nombre y Correo son requeridos';
    mensajeError.style.display = 'block';
    return;
  }

  if (!id && !password) {
    mensajeError.textContent = 'Contraseña es requerida para nuevo usuario';
    mensajeError.style.display = 'block';
    return;
  }

  try {
    const datos = { nombre, correo, id_rol, telefono, estado };
    if (password) datos.password = password;

    if (id) {
      await apiCall('PUT', `${API_CONFIG.endpoints.usuarios}/${id}`, datos);
      alert('Usuario actualizado correctamente');
    } else {
      await apiCall('POST', API_CONFIG.endpoints.usuarios, datos);
      alert('Usuario creado correctamente');
    }

    modalUsuario.hide();
    cargarUsuarios();
  } catch (error) {
    mensajeError.textContent = 'Error: ' + error.message;
    mensajeError.style.display = 'block';
  }
}

// Eliminar usuario
async function eliminarUsuario(id, nombre) {
  if (!confirm(`¿Estás seguro de eliminar a ${nombre}?`)) return;

  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.usuarios}/${id}`);
    alert('Usuario eliminado correctamente');
    cargarUsuarios();
  } catch (error) {
    alert('Error al eliminar usuario: ' + error.message);
  }
}

// Clientes
async function cargarClientes() {
  try {
    const clientes = await apiCall('GET', API_CONFIG.endpoints.clientes);
    clientesCache = clientes || [];
    const tbody = document.getElementById('clientesTable');
    const selectCliente = document.getElementById('pedidoCliente');

    if (!clientes || clientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay clientes registrados</td></tr>';
      selectCliente.innerHTML = '<option value="">Selecciona un cliente...</option>';
      return;
    }

    tbody.innerHTML = clientes.map(cliente => `
      <tr>
        <td>${cliente.id_cliente}</td>
        <td>${cliente.nombre}</td>
        <td>${cliente.correo}</td>
        <td>${cliente.telefono || '-'}</td>
        <td><span class="badge ${Number(cliente.estado) === 1 ? 'bg-success' : 'bg-secondary'}">${Number(cliente.estado) === 1 ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <button type="button" class="btn btn-sm btn-outline-primary me-1" onclick="editarCliente(${cliente.id_cliente})">Editar</button>
          <button type="button" class="btn btn-sm btn-outline-danger" onclick="eliminarCliente(${cliente.id_cliente}, '${cliente.nombre.replace(/'/g, "\\'")}')">Eliminar</button>
        </td>
      </tr>
    `).join('');

    selectCliente.innerHTML = '<option value="">Selecciona un cliente...</option>' + clientes.map(cliente => `
      <option value="${cliente.id_cliente}"${Number(cliente.estado) !== 1 ? ' disabled' : ''}>${cliente.nombre}${Number(cliente.estado) !== 1 ? ' (Inactivo)' : ''}</option>
    `).join('');
  } catch (error) {
    console.error('Error cargando clientes:', error);
    document.getElementById('clientesTable').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error cargando clientes</td></tr>';
  }
}

window.editarCliente = function(id) {
  const cliente = clientesCache.find(c => Number(c.id_cliente) === Number(id));
  if (!cliente) return;

  document.getElementById('clienteId').value = cliente.id_cliente;
  document.getElementById('clienteNombre').value = cliente.nombre || '';
  document.getElementById('clienteCorreo').value = cliente.correo || '';
  document.getElementById('clienteTelefono').value = cliente.telefono || '';
  document.getElementById('clienteDireccion').value = cliente.direccion || '';
  document.getElementById('clienteEstado').value = cliente.estado;
  document.getElementById('clienteError').classList.add('d-none');
  document.querySelector('#clienteModal .modal-title').textContent = 'Editar Cliente';
  modalCliente.show();
};

async function eliminarCliente(id, nombre) {
  if (!confirm(`¿Eliminar cliente ${nombre}? Esta acción no se puede deshacer.`)) return;
  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.clientes}/${id}`);
    alert('Cliente eliminado correctamente');
    cargarClientes();
  } catch (error) {
    alert('Error al eliminar cliente: ' + error.message);
  }
}

function nuevoCliente() {
  document.getElementById('clienteForm').reset();
  document.getElementById('clienteId').value = '';
  document.getElementById('clienteError').classList.add('d-none');
  document.querySelector('#clienteModal .modal-title').textContent = 'Registrar Cliente';
  modalCliente.show();
}

async function guardarCliente() {
  const id = document.getElementById('clienteId').value;
  const nombre = document.getElementById('clienteNombre').value.trim();
  const correo = document.getElementById('clienteCorreo').value.trim();
  const telefono = document.getElementById('clienteTelefono').value.trim();
  const direccion = document.getElementById('clienteDireccion').value.trim();
  const estado = document.getElementById('clienteEstado').value;
  const errorBox = document.getElementById('clienteError');

  if (!nombre || !correo) {
    errorBox.textContent = 'Nombre y correo son requeridos';
    errorBox.classList.remove('d-none');
    return;
  }

  try {
    const datos = { nombre, correo, telefono, direccion, estado };
    if (id) {
      await apiCall('PUT', `${API_CONFIG.endpoints.clientes}/${id}`, datos);
      alert('Cliente actualizado correctamente');
    } else {
      await apiCall('POST', API_CONFIG.endpoints.clientes, datos);
      alert('Cliente registrado correctamente');
    }
    modalCliente.hide();
    cargarClientes();
  } catch (error) {
    errorBox.textContent = 'Error: ' + error.message;
    errorBox.classList.remove('d-none');
  }
}

function inicializarEventosInventario() {
  document.getElementById('formProducto').addEventListener('submit', guardarProducto);
  document.getElementById('btnCancelarProducto').addEventListener('click', cancelarProducto);
  document.getElementById('formInventario').addEventListener('submit', guardarInventario);
  document.getElementById('btnCancelarInventario').addEventListener('click', cancelarInventario);
  document.getElementById('formCategoria').addEventListener('submit', guardarCategoria);
  document.getElementById('btnCancelarCategoria').addEventListener('click', cancelarCategoria);
}

// Productos e inventario
async function cargarProductos() {
  try {
    const productos = await apiCall('GET', API_CONFIG.endpoints.productos);
    productosCache = productos || [];
    const tbody = document.getElementById('productosTable');
    const selectProducto = document.getElementById('pedidoProducto');
    const tablaProductos = document.getElementById('tablaProductos');
    const invSelect = document.getElementById('inv_id_producto');
    const ordenProducto = document.getElementById('ordenProducto');
    const costoProducto = document.getElementById('costoProducto');

    if (!productos || productos.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay productos registrados</td></tr>';
      if (selectProducto) selectProducto.innerHTML = '<option value="">Selecciona un producto...</option>';
      if (tablaProductos) tablaProductos.innerHTML = '<tr><td colspan="8" class="text-center">No hay productos registrados</td></tr>';
      if (invSelect) invSelect.innerHTML = '<option value="">Selecciona un producto...</option>';
      if (ordenProducto) ordenProducto.innerHTML = '<option value="">Seleccionar producto...</option>';
      if (costoProducto) costoProducto.innerHTML = '<option value="">Sin producto específico</option>';
      return;
    }

    if (tbody) {
      tbody.innerHTML = productos.map(producto => `
        <tr>
          <td>${producto.id_producto}</td>
          <td>${producto.nombre_producto}</td>
          <td>${formatearNumero(producto.stock || 0)}</td>
          <td>${formatearMoneda(producto.precio || producto.precio_venta || 0)}</td>
        </tr>
      `).join('');
    }

    if (selectProducto) {
      selectProducto.innerHTML = '<option value="">Selecciona un producto...</option>' + productos.map(producto => `
        <option value="${producto.id_producto}">${producto.nombre_producto} (stock: ${Number(producto.stock || 0)})</option>
      `).join('');
    }

    if (tablaProductos) {
      tablaProductos.innerHTML = productos.map(producto => `
        <tr>
          <td>${producto.id_producto}</td>
          <td>${producto.codigo_producto || '-'}</td>
          <td>${producto.nombre_producto}</td>
          <td>Q${Number(producto.precio_venta || producto.precio || 0).toFixed(2)}</td>
          <td>${Number(producto.stock || 0)}</td>
          <td>${producto.proveedor_nombre || '-'}</td>
          <td>${producto.nombre_categoria || getNombreCategoria(producto.id_categoria)}</td>
          <td>
            <button class="btn btn-sm btn-warning" onclick="editarProducto(${producto.id_producto})">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${producto.id_producto})">Eliminar</button>
          </td>
        </tr>
      `).join('');
    }

    if (invSelect) {
      invSelect.innerHTML = '<option value="">Selecciona un producto...</option>' + productos.map(producto => `
        <option value="${producto.id_producto}">${producto.nombre_producto}</option>
      `).join('');
    }

    if (ordenProducto) {
      ordenProducto.innerHTML = '<option value="">Seleccionar producto...</option>' + productos.map(producto => `<option value="${producto.id_producto}">${producto.nombre_producto}</option>`).join('');
    }

    if (costoProducto) {
      costoProducto.innerHTML = '<option value="">Sin producto específico</option>' + productos.map(producto => `<option value="${producto.id_producto}">${producto.nombre_producto}</option>`).join('');
    }
  } catch (error) {
    console.error('Error cargando productos:', error);
    document.getElementById('productosTable').innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error cargando productos</td></tr>';
    document.getElementById('tablaProductos').innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error cargando productos</td></tr>';
  }
}

async function cargarPedidos() {
  try {
    if (!enviosLoaded) {
      await cargarEnvios();
    }
    const pedidos = await apiCall('GET', API_CONFIG.endpoints.pedidos);
    pedidosCache = pedidos || [];
    const tbody = document.getElementById('pedidosTable');
    const envioPedidoSelect = document.getElementById('envio_pedido');

    if (!pedidosCache || pedidosCache.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay pedidos registrados</td></tr>';
      if (envioPedidoSelect) envioPedidoSelect.innerHTML = '<option value="">Seleccionar pedido...</option>';
      return;
    }

    const selectedPedidoId = envioPedidoSelect?.value;
    const pedidosDisponibles = pedidosCache.filter(pedido => {
      const disabledByEnvio = enviosCache.some(envio => String(envio.id_pedido) === String(pedido.id_pedido));
      return !disabledByEnvio || String(pedido.id_pedido) === String(selectedPedidoId);
    });

    if (envioPedidoSelect) {
      envioPedidoSelect.innerHTML = '<option value="">Seleccionar pedido...</option>' + pedidosDisponibles.map(pedido => `
        <option value="${pedido.id_pedido}">#${pedido.id_pedido} - ${pedido.cliente || 'N/A'} - Q${Number(pedido.total || 0).toFixed(2)} - ${pedido.estado || 'pendiente'}</option>
      `).join('');
      if (selectedPedidoId) {
        envioPedidoSelect.value = selectedPedidoId;
      }
    }

    if (tbody) {
      tbody.innerHTML = pedidosCache.map(pedido => {
        const estado = String(pedido.estado || 'pendiente').toLowerCase();
        const esPendiente = estado === 'pendiente';
        return `
        <tr>
          <td>${pedido.id_pedido}</td>
          <td>${pedido.cliente || 'N/A'}</td>
          <td>Q${Number(pedido.total).toFixed(2)}</td>
          <td><span class="badge ${getEstadoBadge(estado)}">${estado}</span></td>
          <td>
            <button class="btn btn-sm btn-info" onclick="verPedido(${pedido.id_pedido})">Ver</button>
            ${esPendiente ? `<button class="btn btn-sm btn-secondary" onclick="editarPedido(${pedido.id_pedido})">Editar</button>` : ''}
            ${esPendiente ? `<button class="btn btn-sm btn-primary" onclick="confirmarPedido(${pedido.id_pedido})">Confirmar</button>` : ''}
            <button class="btn btn-sm btn-success" onclick="generarFactura(${pedido.id_pedido})">Factura</button>
            <button class="btn btn-sm btn-danger" onclick="registrarDevolucion(${pedido.id_pedido})">Devolver</button>
          </td>
        </tr>
      `;
      }).join('');
    }

    if (envioPedidoSelect && envioPedidoSelect.value) {
      await actualizarDetallePedidoEnvio();
    }
  } catch (error) {
    console.error('Error cargando pedidos:', error);
    const tbody = document.getElementById('pedidosTable');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error cargando pedidos</td></tr>';
  }
}

async function actualizarDetallePedidoEnvio() {
  const selectPedido = document.getElementById('envio_pedido');
  const detalle = document.getElementById('envioPedidoDetalle');
  if (!selectPedido || !detalle) return;

  const idPedido = selectPedido.value;
  if (!idPedido) {
    detalle.innerHTML = '<div class="text-muted small">Selecciona un pedido para ver sus productos vinculados al inventario.</div>';
    return;
  }

  try {
    const pedido = await apiCall('GET', `${API_CONFIG.endpoints.pedidos}/${idPedido}`);
    const items = pedido?.items || [];
    if (items.length === 0) {
      detalle.innerHTML = '<div class="text-muted small">El pedido no tiene productos asociados.</div>';
      return;
    }

    detalle.innerHTML = `
      <div class="small fw-semibold mb-1">Productos del pedido</div>
      <ul class="mb-0 ps-3 small">
        ${items.map(item => `<li>${item.nombre_producto || `Producto ${item.id_producto}`} x${item.cantidad}</li>`).join('')}
      </ul>
    `;
  } catch (error) {
    detalle.innerHTML = '<div class="text-danger small">No se pudo cargar el detalle del pedido.</div>';
  }
}

function getNombreCategoria(idCategoria) {
  const categoria = categoriasCache.find(c => Number(c.id_categoria) === Number(idCategoria));
  return categoria ? categoria.nombre_categoria : (idCategoria || 'N/A');
}

async function guardarProducto(event) {
  event.preventDefault();
  const form = document.getElementById('formProducto');
  const editingId = form.dataset.editingId;
  const producto = {
    codigo_producto: document.getElementById('codigo_producto').value.trim(),
    nombre_producto: document.getElementById('nombre_producto').value.trim(),
    descripcion: document.getElementById('descripcion').value.trim(),
    id_categoria: document.getElementById('id_categoria').value || null,
    id_proveedor: document.getElementById('id_proveedor').value || null,
    unidad_medida: document.getElementById('unidad_medida').value,
    precio_compra: Number(document.getElementById('precio_compra').value || 0),
    precio_venta: Number(document.getElementById('precio_venta').value || 0),
    stock_minimo: Number(document.getElementById('stock_minimo').value || 0),
    stock_maximo: Number(document.getElementById('stock_maximo').value || 0),
    estado: 1
  };

  if (!producto.nombre_producto) {
    alert('Nombre producto es requerido');
    return;
  }

  const erroresProducto = validarDatosProducto(producto);
  if (erroresProducto.length > 0) {
    alert(`Corrige los datos del producto antes de guardar:\n\n- ${erroresProducto.join('\n- ')}`);
    return;
  }

  try {
    if (editingId) {
      await apiCall('PUT', `${API_CONFIG.endpoints.productos}/${editingId}`, producto);
      alert('Producto actualizado correctamente');
    } else {
      await apiCall('POST', API_CONFIG.endpoints.productos, producto);
      alert('Producto creado correctamente');
    }

    cancelarProducto();
    cargarProductos();
  } catch (error) {
    alert('Error al guardar producto: ' + error.message);
  }
}

function validarDatosProducto(producto) {
  const errores = [];

  if (producto.codigo_producto) {
    const codigoDuplicado = productosCache.some(p =>
      String(p.codigo_producto || '').trim().toLowerCase() === producto.codigo_producto.toLowerCase() &&
      String(p.id_producto) !== String(document.getElementById('formProducto').dataset.editingId || '')
    );

    if (codigoDuplicado) {
      errores.push('Ya existe otro producto con ese código.');
    }
  }

  if (producto.precio_compra <= 0) {
    errores.push('El precio de compra debe ser mayor que 0.');
  }

  if (producto.precio_venta <= 0) {
    errores.push('El precio de venta debe ser mayor que 0.');
  }

  if (producto.precio_compra > 0 && producto.precio_venta > 0 && producto.precio_compra >= producto.precio_venta) {
    errores.push('El precio de compra debe ser menor que el precio de venta.');
  }

  if (producto.stock_minimo <= 0 && producto.stock_maximo <= 0) {
    errores.push('El stock mínimo y el stock máximo no pueden ser ambos 0.');
  }

  if (producto.stock_minimo < 0 || producto.stock_maximo < 0) {
    errores.push('El stock mínimo y el stock máximo no pueden ser negativos.');
  }

  if (producto.stock_minimo > producto.stock_maximo) {
    errores.push('El stock mínimo no puede ser mayor que el stock máximo.');
  }

  return errores;
}

window.editarProducto = function(id) {
  const producto = productosCache.find(p => Number(p.id_producto) === Number(id));
  if (!producto) return alert('Producto no encontrado');

  document.getElementById('codigo_producto').value = producto.codigo_producto || '';
  document.getElementById('nombre_producto').value = producto.nombre_producto || '';
  document.getElementById('descripcion').value = producto.descripcion || '';
  document.getElementById('id_categoria').value = producto.id_categoria || '';
  document.getElementById('id_proveedor').value = producto.id_proveedor || '';
  document.getElementById('unidad_medida').value = producto.unidad_medida || '';
  document.getElementById('precio_compra').value = producto.precio_compra || '';
  document.getElementById('precio_venta').value = producto.precio_venta || producto.precio || '';
  document.getElementById('stock_minimo').value = producto.stock_minimo || '';
  document.getElementById('stock_maximo').value = producto.stock_maximo || '';
  document.getElementById('formProducto').dataset.editingId = id;
  document.getElementById('btnGuardarProducto').textContent = 'Actualizar Producto';
  document.getElementById('btnCancelarProducto').classList.remove('d-none');
};

window.eliminarProducto = async function(id) {
  if (!confirm('¿Eliminar producto?')) return;

  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.productos}/${id}`);
    cargarProductos();
  } catch (error) {
    alert(getMensajeEliminarProducto(error));
  }
};

function getMensajeEliminarProducto(error) {
  const mensaje = error?.message || '';

  if (
    mensaje.includes('relacionado') ||
    mensaje.includes('relacionados') ||
    mensaje.includes('inventario') ||
    mensaje.includes('pedidos') ||
    mensaje.includes('compras')
  ) {
    return 'No se puede eliminar este producto porque ya tiene inventario, pedidos, compras u otros movimientos relacionados. Para conservar el historial del sistema, primero elimina o ajusta esos registros relacionados.';
  }

  return 'No se pudo eliminar el producto. Inténtalo de nuevo o revisa si tiene movimientos relacionados.';
}

function cancelarProducto() {
  const form = document.getElementById('formProducto');
  form.reset();
  delete form.dataset.editingId;
  document.getElementById('btnGuardarProducto').textContent = 'Guardar Producto';
  document.getElementById('btnCancelarProducto').classList.add('d-none');
}

async function cargarCategorias() {
  try {
    const categorias = await apiCall('GET', API_CONFIG.endpoints.categorias);
    categoriasCache = categorias || [];
    const tablaCategorias = document.getElementById('tablaCategorias');
    const selectCategoria = document.getElementById('id_categoria');

    selectCategoria.innerHTML = '<option value="">Seleccionar categoría...</option>' + categoriasCache.map(categoria => `
      <option value="${categoria.id_categoria}">${categoria.nombre_categoria}</option>
    `).join('');

    if (categoriasCache.length === 0) {
      tablaCategorias.innerHTML = '<tr><td colspan="4" class="text-center">No hay categorías registradas</td></tr>';
      return;
    }

    tablaCategorias.innerHTML = categoriasCache.map(categoria => `
      <tr>
        <td>${categoria.id_categoria}</td>
        <td>${categoria.nombre_categoria}</td>
        <td>${categoria.descripcion || '-'}</td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="editarCategoria(${categoria.id_categoria})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarCategoria(${categoria.id_categoria})">Eliminar</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error cargando categorías:', error);
    document.getElementById('tablaCategorias').innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error cargando categorías</td></tr>';
  }
}

async function guardarCategoria(event) {
  event.preventDefault();
  const form = document.getElementById('formCategoria');
  const editingId = form.dataset.editingId;
  const categoria = {
    nombre_categoria: document.getElementById('nombre_categoria').value.trim(),
    descripcion: document.getElementById('descripcion_categoria').value.trim(),
    estado: 1
  };

  if (!categoria.nombre_categoria) {
    alert('Nombre categoría es requerido');
    return;
  }

  try {
    if (editingId) {
      await apiCall('PUT', `${API_CONFIG.endpoints.categorias}/${editingId}`, categoria);
      alert('Categoría actualizada correctamente');
    } else {
      await apiCall('POST', API_CONFIG.endpoints.categorias, categoria);
      alert('Categoría creada correctamente');
    }

    cancelarCategoria();
    await cargarCategorias();
    cargarProductos();
  } catch (error) {
    alert('Error al guardar categoría: ' + error.message);
  }
}

window.editarCategoria = function(id) {
  const categoria = categoriasCache.find(c => Number(c.id_categoria) === Number(id));
  if (!categoria) return alert('Categoría no encontrada');

  document.getElementById('nombre_categoria').value = categoria.nombre_categoria || '';
  document.getElementById('descripcion_categoria').value = categoria.descripcion || '';
  document.getElementById('formCategoria').dataset.editingId = id;
  document.getElementById('btnGuardarCategoria').textContent = 'Actualizar Categoría';
  document.getElementById('btnCancelarCategoria').classList.remove('d-none');
};

window.eliminarCategoria = async function(id) {
  if (!confirm('¿Eliminar categoría?')) return;

  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.categorias}/${id}`);
    await cargarCategorias();
    cargarProductos();
  } catch (error) {
    alert('Error al eliminar categoría: ' + error.message);
  }
};

function cancelarCategoria() {
  const form = document.getElementById('formCategoria');
  form.reset();
  delete form.dataset.editingId;
  document.getElementById('btnGuardarCategoria').textContent = 'Guardar Categoría';
  document.getElementById('btnCancelarCategoria').classList.add('d-none');
}

async function cargarInventarios() {
  try {
    const inventarios = await apiCall('GET', API_CONFIG.endpoints.inventarios);
    inventariosCache = inventarios || [];
    const tablaInventarios = document.getElementById('tablaInventarios');

    if (inventariosCache.length === 0) {
      tablaInventarios.innerHTML = '<tr><td colspan="6" class="text-center">No hay registros de inventario</td></tr>';
      return;
    }

    tablaInventarios.innerHTML = inventariosCache.map(inventario => {
      const producto = productosCache.find(p => Number(p.id_producto) === Number(inventario.id_producto));
      return `
        <tr>
          <td>${inventario.id_inventario}</td>
          <td>${producto ? producto.nombre_producto : inventario.id_producto}</td>
          <td>${inventario.id_almacen || '-'}</td>
          <td>${formatearNumero(inventario.stock_actual)}</td>
          <td>${inventario.ubicacion || '-'}</td>
          <td>
            <button class="btn btn-sm btn-warning" onclick="editarInventario(${inventario.id_inventario})">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="eliminarInventario(${inventario.id_inventario})">Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');
    renderTablaInventarioFinanzas();
    await cargarAlmacenes();
  } catch (error) {
    console.error('Error cargando inventarios:', error);
    document.getElementById('tablaInventarios').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error cargando inventarios</td></tr>';
  }
}

async function guardarInventario(event) {
  event.preventDefault();
  const form = document.getElementById('formInventario');
  const editingId = form.dataset.editingId;
  const inventario = {
    id_producto: Number(document.getElementById('inv_id_producto').value),
    id_almacen: document.getElementById('inv_id_almacen').value ? Number(document.getElementById('inv_id_almacen').value) : null,
    stock_actual: Number(document.getElementById('inv_stock_actual').value || 0),
    ubicacion: document.getElementById('inv_ubicacion').value.trim()
  };

  if (!inventario.id_producto) {
    alert('Selecciona un producto');
    return;
  }

  if (!inventario.id_almacen) {
    alert('Selecciona un almacén antes de guardar el inventario. No se puede registrar inventario sin un almacén disponible.');
    return;
  }

  const almacenSeleccionado = almacenesCache.find(a => Number(a.id_almacen) === Number(inventario.id_almacen));
  if (almacenSeleccionado && Number(almacenSeleccionado.estado) !== 1) {
    alert('No se puede guardar inventario en un almacén inactivo. Activa el almacén o selecciona otro almacén activo.');
    return;
  }

  try {
    if (editingId) {
      await apiCall('PUT', `${API_CONFIG.endpoints.inventarios}/${editingId}`, inventario);
      alert('Inventario actualizado correctamente');
    } else {
      await apiCall('POST', API_CONFIG.endpoints.inventarios, inventario);
      alert('Inventario creado correctamente');
    }

    cancelarInventario();
    await cargarInventarios();
    cargarProductos();
  } catch (error) {
    alert('Error al guardar inventario: ' + error.message);
  }
}

window.editarInventario = function(id) {
  const inventario = inventariosCache.find(i => Number(i.id_inventario) === Number(id));
  if (!inventario) return alert('Inventario no encontrado');

  document.getElementById('inv_id_producto').value = inventario.id_producto || '';
  document.getElementById('inv_id_almacen').value = inventario.id_almacen || '';
  document.getElementById('inv_stock_actual').value = inventario.stock_actual || 0;
  document.getElementById('inv_ubicacion').value = inventario.ubicacion || '';
  document.getElementById('formInventario').dataset.editingId = id;
  document.getElementById('btnGuardarInventario').textContent = 'Actualizar Inventario';
  document.getElementById('btnCancelarInventario').classList.remove('d-none');
};

window.eliminarInventario = async function(id) {
  if (!confirm('¿Eliminar registro de inventario?')) return;

  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.inventarios}/${id}`);
    await cargarInventarios();
    cargarProductos();
  } catch (error) {
    alert('Error al eliminar inventario: ' + error.message);
  }
};

function cancelarInventario() {
  const form = document.getElementById('formInventario');
  form.reset();
  delete form.dataset.editingId;
  document.getElementById('btnGuardarInventario').textContent = 'Guardar Inventario';
  document.getElementById('btnCancelarInventario').classList.add('d-none');
}

function agregarItemPedido() {
  const productoId = Number(document.getElementById('pedidoProducto').value);
  const cantidad = Number(document.getElementById('pedidoCantidad').value);
  const errorBox = document.getElementById('pedidoError');
  errorBox.classList.add('d-none');

  if (!productoId || cantidad <= 0) {
    errorBox.textContent = 'Selecciona un producto válido y una cantidad mayor que cero.';
    errorBox.classList.remove('d-none');
    return;
  }

  const producto = productosCache.find(p => p.id_producto === productoId);
  if (!producto) {
    errorBox.textContent = 'Producto no encontrado.';
    errorBox.classList.remove('d-none');
    return;
  }

  const existente = pedidoItems.find(item => item.id_producto === productoId);
  const totalCantidad = existente ? existente.cantidad + cantidad : cantidad;
  const originalItem = pedidoEditOriginalItems.find(item => Number(item.id_producto) === productoId);
  const stockDisponible = Number(producto.stock || 0) + Number(originalItem?.cantidad || 0);
  if (totalCantidad > stockDisponible) {
    errorBox.textContent = `No hay stock suficiente para ${producto.nombre_producto}. Disponibles: ${stockDisponible}`;
    errorBox.classList.remove('d-none');
    return;
  }

  if (existente) {
    existente.cantidad += cantidad;
  } else {
    pedidoItems.push({
      id_producto: productoId,
      nombre_producto: producto.nombre_producto,
      cantidad,
      precio_unitario: Number(producto.precio || producto.precio_venta || 0)
    });
  }

  actualizarPedidoItemsUI();
}

function actualizarPedidoItemsUI() {
  const tbody = document.getElementById('pedidoItemsTable');
  if (pedidoItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Agrega productos al pedido</td></tr>';
    document.getElementById('pedidoTotal').textContent = 'Q0.00';
    return;
  }

  let total = 0;
  tbody.innerHTML = pedidoItems.map((item, index) => {
    const subtotal = item.precio_unitario * item.cantidad;
    total += subtotal;
    return `
      <tr>
        <td>${item.nombre_producto}</td>
        <td>${item.cantidad}</td>
        <td>Q${item.precio_unitario.toFixed(2)}</td>
        <td>Q${subtotal.toFixed(2)}</td>
        <td><button type="button" class="btn btn-sm btn-danger" onclick="removerItemPedido(${index})">Eliminar</button></td>
      </tr>
    `;
  }).join('');

  document.getElementById('pedidoTotal').textContent = `Q${total.toFixed(2)}`;
}

function resetPedidoForm() {
  document.getElementById('pedidoForm').reset();
  document.getElementById('pedidoId').value = '';
  document.getElementById('pedidoFormTitle').textContent = 'Crear Pedido';
  document.getElementById('btnCrearPedido').textContent = 'Crear Pedido';
  document.getElementById('btnCancelarPedido').classList.add('d-none');
  document.getElementById('pedidoCliente').disabled = false;
  document.getElementById('pedidoEstado').disabled = false;
  document.getElementById('pedidoProducto').disabled = false;
  document.getElementById('pedidoCantidad').disabled = false;
  document.getElementById('btnAgregarItem').disabled = false;
  pedidoItems = [];
  pedidoEditOriginalItems = [];
  pedidoEditOriginalEstado = 'pendiente';
  actualizarPedidoItemsUI();
}

function cancelarPedidoEdicion() {
  resetPedidoForm();
}

async function refrescarTablasRelacionadasPedidos() {
  await Promise.all([
    cargarPedidos(),
    cargarProductos(),
    cargarInventarios(),
    cargarEnvios()
  ]);
}

window.removerItemPedido = function(index) {
  pedidoItems.splice(index, 1);
  actualizarPedidoItemsUI();
};

async function crearPedido() {
  const pedidoId = document.getElementById('pedidoId').value;
  const clienteId = Number(document.getElementById('pedidoCliente').value);
  const estado = document.getElementById('pedidoEstado').value;
  const errorBox = document.getElementById('pedidoError');
  errorBox.classList.add('d-none');

  if (!clienteId) {
    errorBox.textContent = 'Selecciona un cliente para el pedido.';
    errorBox.classList.remove('d-none');
    return;
  }

  const clienteSeleccionado = clientesCache.find(c => Number(c.id_cliente) === Number(clienteId));
  if (clienteSeleccionado && Number(clienteSeleccionado.estado) !== 1) {
    errorBox.textContent = 'No se puede crear el pedido con un cliente inactivo. Activa el cliente o elige otro cliente.';
    errorBox.classList.remove('d-none');
    return;
  }

  if (pedidoItems.length === 0) {
    errorBox.textContent = 'Agrega al menos un producto al pedido.';
    errorBox.classList.remove('d-none');
    return;
  }

  for (const item of pedidoItems) {
    const producto = productosCache.find(p => Number(p.id_producto) === Number(item.id_producto));
    const stockActual = producto ? Number(producto.stock || 0) : 0;
    if (!producto) {
      errorBox.textContent = `Producto no encontrado: ${item.id_producto}`;
      errorBox.classList.remove('d-none');
      return;
    }
    if (item.cantidad > stockActual) {
      errorBox.textContent = `No hay stock suficiente para ${producto.nombre_producto}. Disponibles: ${stockActual}`;
      errorBox.classList.remove('d-none');
      return;
    }
  }

  if (estado === 'confirmado' && (!pedidoId || pedidoEditOriginalEstado !== 'confirmado')) {
    const confirmarConfirmado = confirm('Este pedido se confirmará y el stock se descontará. ¿Continuar?');
    if (!confirmarConfirmado) {
      return;
    }
  }

  try {
    const payload = { id_cliente: clienteId, items: pedidoItems, estado };
    if (pedidoId) {
      await apiCall('PUT', `${API_CONFIG.endpoints.pedidos}/${pedidoId}`, payload);
      alert('Pedido actualizado correctamente');
    } else {
      await apiCall('POST', API_CONFIG.endpoints.pedidos, payload);
      alert('Pedido creado correctamente');
    }

    resetPedidoForm();
    await refrescarTablasRelacionadasPedidos();
  } catch (error) {
    errorBox.textContent = 'Error: ' + error.message;
    errorBox.classList.remove('d-none');
  }
}

// Almacenes
async function cargarAlmacenes() {
  try {
      const almacenes = await apiCall('GET', API_CONFIG.endpoints.almacenes);
    almacenesCache = almacenes || [];
    const activeAlmacenes = almacenesCache.filter(a => Number(a.estado) === 1);
    const tbody = document.getElementById('almacenesTable');
    const inventarioAlmacen = document.getElementById('inv_id_almacen');
    const inventarioAlmacenError = document.getElementById('inventarioAlmacenError');
    const btnGuardarInventario = document.getElementById('btnGuardarInventario');

    if (!almacenesCache || almacenesCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay almacenes registrados</td></tr>';
      if (inventarioAlmacen) inventarioAlmacen.innerHTML = '<option value="">No hay almacenes disponibles</option>';
      if (btnGuardarInventario) btnGuardarInventario.disabled = true;
      if (inventarioAlmacenError) {
        inventarioAlmacenError.textContent = 'No hay almacenes disponibles. Crea un almacén antes de registrar inventario.';
        inventarioAlmacenError.classList.remove('d-none');
      }
      return;
    }

    tbody.innerHTML = almacenesCache.map(a => `
      ${renderAlmacenRow(a)}
    `).join('');
    if (inventarioAlmacen) {
      inventarioAlmacen.innerHTML = '<option value="">Seleccionar almacén...</option>' + almacenesCache.map(a => ` <option value="${a.id_almacen}"${Number(a.estado) === 1 ? '' : ' disabled'}>${a.nombre_almacen}${Number(a.estado) === 1 ? '' : ' (Inactivo)'}</option>`).join('');
    }

    if (!activeAlmacenes || activeAlmacenes.length === 0) {
      if (btnGuardarInventario) btnGuardarInventario.disabled = true;
      if (inventarioAlmacenError) {
        inventarioAlmacenError.textContent = 'No hay almacenes activos disponibles. Activa un almacén antes de registrar inventario.';
        inventarioAlmacenError.classList.remove('d-none');
      }
    } else {
      if (btnGuardarInventario) btnGuardarInventario.disabled = false;
      if (inventarioAlmacenError) {
        inventarioAlmacenError.textContent = '';
        inventarioAlmacenError.classList.add('d-none');
      }
    }

    const recepcionAlmacen = document.getElementById('recepcionAlmacen');
    const recepcionAlmacenError = document.getElementById('recepcionAlmacenError');
    const btnGuardarRecepcion = document.getElementById('btnGuardarRecepcion');
    if (recepcionAlmacen) {
      recepcionAlmacen.innerHTML = '<option value="">Seleccionar almacén...</option>' + almacenesCache.map(a => `<option value="${a.id_almacen}"${Number(a.estado) === 1 ? '' : ' disabled'}>${a.nombre_almacen}${Number(a.estado) === 1 ? '' : ' (Inactivo)'}</option>`).join('');
    }
    if (!activeAlmacenes || activeAlmacenes.length === 0) {
      if (btnGuardarRecepcion) btnGuardarRecepcion.disabled = true;
      if (recepcionAlmacenError) {
        recepcionAlmacenError.textContent = 'No hay almacenes activos disponibles. Activa un almacén antes de registrar la recepción.';
        recepcionAlmacenError.classList.remove('d-none');
      }
    } else {
      if (btnGuardarRecepcion) btnGuardarRecepcion.disabled = false;
      if (recepcionAlmacenError) {
        recepcionAlmacenError.textContent = '';
        recepcionAlmacenError.classList.add('d-none');
      }
    }
  } catch (error) {
    console.error('Error cargando almacenes:', error);
    document.getElementById('almacenesTable').innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error cargando almacenes</td></tr>';
  }
}

function renderAlmacenRow(a) {
  const productosDelAlmacen = inventariosCache
    .filter(inv => Number(inv.id_almacen) === Number(a.id_almacen))
    .map(inv => {
      const producto = productosCache.find(p => Number(p.id_producto) === Number(inv.id_producto));
      const nombreProducto = producto ? producto.nombre_producto : `Producto ${inv.id_producto}`;
      return `${nombreProducto} (${Number(inv.stock_actual || 0)})`;
    });

  const productosHtml = productosDelAlmacen.length > 0
    ? `<div class="small">${productosDelAlmacen.map(p => `<span class="badge bg-light text-dark border me-1 mb-1">${escapeHtml(p)}</span>`).join('')}</div>`
    : '<span class="text-muted">Sin productos</span>';

  return `
      <tr>
        <td>${a.id_almacen}</td>
        <td>${a.nombre_almacen}</td>
        <td>${a.direccion || '-'}</td>
        <td>${a.encargado || '-'}</td>
        <td>${a.telefono || '-'}</td>
        <td>${productosHtml}</td>
        <td><span class="badge ${Number(a.estado) === 1 ? 'bg-success' : 'bg-secondary'}">${Number(a.estado) === 1 ? 'Activo' : 'Inactivo'}</span></td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="editarAlmacen(${a.id_almacen})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarAlmacen(${a.id_almacen}, '${(a.nombre_almacen||'').replace(/'/g, "\\'")}')">Eliminar</button>
        </td>
      </tr>
  `;
}

function setAlmacenFormError(message) {
  const errorBox = document.getElementById('almacenError');
  errorBox.textContent = message;
  errorBox.classList.toggle('d-none', !message);
}

function resetAlmacenForm() {
  document.getElementById('formAlmacen').reset();
  document.getElementById('almacenId').value = '';
  document.getElementById('almacenFormTitle').textContent = 'Nuevo Almacén';
  document.getElementById('btnGuardarAlmacen').textContent = 'Guardar Almacén';
  document.getElementById('btnCancelarAlmacen').classList.add('d-none');
  setAlmacenFormError('');
}

function cancelarAlmacen() {
  resetAlmacenForm();
}

async function guardarAlmacen(event) {
  event.preventDefault();

  const id = document.getElementById('almacenId').value;
  const nombre_almacen = document.getElementById('nombre_almacen').value.trim();
  const direccion = document.getElementById('direccion_almacen').value.trim();
  const encargado = document.getElementById('encargado_almacen').value.trim();
  const telefono = document.getElementById('telefono_almacen').value.trim();
  const estado = Number(document.getElementById('estado_almacen').value || 1);

  if (!nombre_almacen) {
    setAlmacenFormError('El nombre del almacén es requerido.');
    return;
  }
  if (telefono && !isDigitsOnly(telefono)) {
    setAlmacenFormError('El teléfono debe contener solo dígitos');
    return;
  }

  try {
    const payload = { nombre_almacen, direccion, encargado, telefono, estado };
    if (id) {
      await apiCall('PUT', `${API_CONFIG.endpoints.almacenes}/${id}`, payload);
      alert('Almacén actualizado correctamente');
    } else {
      await apiCall('POST', API_CONFIG.endpoints.almacenes, payload);
      alert('Almacén creado correctamente');
    }

    resetAlmacenForm();
    await cargarAlmacenes();
  } catch (error) {
    setAlmacenFormError(error.message || 'Error guardando almacén');
  }
}

window.eliminarAlmacen = async function(id, nombre) {
  if (!confirm(`¿Estás seguro de eliminar el almacén ${nombre}?`)) return;
  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.almacenes}/${id}`);
    alert('Almacén eliminado');
    if (document.getElementById('almacenId').value === String(id)) {
      resetAlmacenForm();
    }
    cargarAlmacenes();
  } catch (err) { alert('Error eliminando almacén: ' + err.message); }
};

window.editarAlmacen = async function(id) {
  try {
    const almacen = await apiCall('GET', `${API_CONFIG.endpoints.almacenes}/${id}`);
    document.getElementById('almacenId').value = almacen.id_almacen || '';
    document.getElementById('nombre_almacen').value = almacen.nombre_almacen || '';
    document.getElementById('direccion_almacen').value = almacen.direccion || '';
    document.getElementById('encargado_almacen').value = almacen.encargado || '';
    document.getElementById('telefono_almacen').value = almacen.telefono || '';
    document.getElementById('estado_almacen').value = String(Number(almacen.estado) || 1);
    document.getElementById('almacenFormTitle').textContent = `Editar Almacén #${almacen.id_almacen}`;
    document.getElementById('btnGuardarAlmacen').textContent = 'Actualizar Almacén';
    document.getElementById('btnCancelarAlmacen').classList.remove('d-none');
    setAlmacenFormError('');
  } catch (err) { alert('Error actualizando almacén: ' + err.message); }
};

function getEstadoBadge(estado) {
  switch (estado) {
    case 'confirmado':
      return 'bg-primary';
    case 'procesado':
      return 'bg-warning text-dark';
    case 'devuelto':
      return 'bg-danger';
    default:
      return 'bg-secondary';
  }
}

window.verPedido = async function(id) {
  try {
    const pedido = await apiCall('GET', `${API_CONFIG.endpoints.pedidos}/${id}`);
    if (!pedido) {
      alert('Pedido no encontrado');
      return;
    }

    const detalles = pedido.items.map(item => `
      ${item.nombre_producto} x ${item.cantidad} = Q${Number(item.total_item).toFixed(2)}
    `).join('\n');

    alert(`Pedido #${pedido.id_pedido}\nCliente: ${pedido.cliente}\nEstado: ${pedido.estado}\nTotal: Q${Number(pedido.total).toFixed(2)}\n\nDetalles:\n${detalles}`);
  } catch (error) {
    alert('Error cargando pedido: ' + error.message);
  }
};

window.editarPedido = async function(id) {
  try {
    const pedido = await apiCall('GET', `${API_CONFIG.endpoints.pedidos}/${id}`);
    if (!pedido) {
      alert('Pedido no encontrado');
      return;
    }

    const estado = String(pedido.estado || 'pendiente').toLowerCase();
    if (estado !== 'pendiente') {
      alert('Solo se puede editar un pedido en estado pendiente.');
      return;
    }

    pedidoEditOriginalEstado = estado;
    document.getElementById('pedidoId').value = pedido.id_pedido || '';
    document.getElementById('pedidoCliente').value = pedido.id_cliente || '';
    document.getElementById('pedidoEstado').value = 'pendiente';

    pedidoItems = (pedido.items || []).map(item => ({
      id_producto: Number(item.id_producto),
      nombre_producto: item.nombre_producto || `Producto ${item.id_producto}`,
      cantidad: Number(item.cantidad || 0),
      precio_unitario: Number(item.precio_unitario || 0)
    }));
    pedidoEditOriginalItems = (pedido.items || []).map(item => ({
      id_producto: Number(item.id_producto),
      cantidad: Number(item.cantidad || 0)
    }));

    actualizarPedidoItemsUI();
    document.getElementById('pedidoFormTitle').textContent = `Editar Pedido #${pedido.id_pedido}`;
    document.getElementById('btnCrearPedido').textContent = 'Actualizar Pedido';
    document.getElementById('btnCancelarPedido').classList.remove('d-none');
    document.getElementById('pedidoCliente').focus();
    document.getElementById('pedidoForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    alert('Error cargando pedido: ' + error.message);
  }
};

window.confirmarPedido = async function(id) {
  if (!confirm('¿Confirmar este pedido y descontar el stock?')) return;

  try {
    await apiCall('PUT', `${API_CONFIG.endpoints.pedidos}/${id}`, { estado: 'confirmado' });
    alert('Pedido confirmado correctamente. El stock ha sido descontado.');
    await refrescarTablasRelacionadasPedidos();
  } catch (error) {
    alert('Error confirmando pedido: ' + error.message);
  }
};

window.cambiarEstadoPedido = async function(id) {
  const nuevoEstado = prompt('Editar estado del pedido: pendiente, confirmado', 'confirmado');
  if (!nuevoEstado) return;

  const estadoNormalized = String(nuevoEstado).toLowerCase();
  if (!['pendiente', 'confirmado'].includes(estadoNormalized)) {
    alert('Estado inválido. Usa pendiente o confirmado.');
    return;
  }

  try {
    await apiCall('PUT', `${API_CONFIG.endpoints.pedidos}/${id}`, { estado: estadoNormalized });
    await refrescarTablasRelacionadasPedidos();
  } catch (error) {
    alert('Error editando estado: ' + error.message);
  }
};

window.registrarDevolucion = async function(id) {
  if (!confirm('¿Está seguro que desea eliminar este pedido? Se eliminará permanentemente.')) return;

  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.pedidos}/${id}`);
    alert('Pedido eliminado correctamente');
    await refrescarTablasRelacionadasPedidos();
  } catch (error) {
    alert('Error al eliminar pedido: ' + error.message);
  }
};

window.generarFactura = async function(id) {
  try {
    const pedido = await apiCall('GET', `${API_CONFIG.endpoints.pedidos}/${id}`);
    if (!pedido) {
      alert('Pedido no encontrado');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Factura Pedido #${pedido.id_pedido}`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Cliente: ${pedido.cliente || 'N/A'}`, 14, 30);
    doc.text(`Estado: ${pedido.estado}`, 14, 36);
    doc.text(`Total: Q${Number(pedido.total).toFixed(2)}`, 14, 42);

    let y = 54;
    doc.text('Detalles:', 14, y);
    y += 8;

    pedido.items.forEach(item => {
      doc.text(`- ${item.nombre_producto} x ${item.cantidad} @ Q${Number(item.precio_unitario).toFixed(2)} = Q${Number(item.total_item).toFixed(2)}`, 14, y);
      y += 8;
    });

    doc.save(`factura_pedido_${pedido.id_pedido}.pdf`);
  } catch (error) {
    alert('Error generando factura: ' + error.message);
  }
};

// Proveedores, órdenes, recepciones y compras
async function cargarProveedores() {
  try {
    const proveedores = await apiCall('GET', API_CONFIG.endpoints.proveedores);
    proveedoresCache = proveedores || [];
    const tbody = document.getElementById('tablaProveedores');
    const proveedorSelect = document.getElementById('id_proveedor');
    const ordenProveedorSelect = document.getElementById('ordenIdProveedor');
    const pagoProveedorSelect = document.getElementById('pagoProveedor');

    if (!proveedoresCache || proveedoresCache.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay proveedores registrados</td></tr>';
      if (proveedorSelect) proveedorSelect.innerHTML = '<option value="">Seleccionar proveedor...</option>';
      if (ordenProveedorSelect) ordenProveedorSelect.innerHTML = '<option value="">Seleccionar proveedor...</option>';
      if (pagoProveedorSelect) pagoProveedorSelect.innerHTML = '<option value="">Seleccionar proveedor...</option>';
      return;
    }

    if (tbody) {
      tbody.innerHTML = proveedoresCache.map(proveedor => `
        <tr>
          <td>${proveedor.id}</td>
          <td>${proveedor.nombre}</td>
          <td>${proveedor.telefono || '-'}</td>
          <td>${proveedor.correo || '-'}</td>
          <td>${proveedor.direccion || '-'}</td>
          <td>
            <button class="btn btn-sm btn-warning me-1" onclick="editarProveedor(${proveedor.id})">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="eliminarProveedor(${proveedor.id})">Eliminar</button>
          </td>
        </tr>
      `).join('');
    }

    if (proveedorSelect) {
      proveedorSelect.innerHTML = '<option value="">Seleccionar proveedor...</option>' + proveedoresCache.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    }
    if (ordenProveedorSelect) {
      ordenProveedorSelect.innerHTML = '<option value="">Seleccionar proveedor...</option>' + proveedoresCache.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    }
    if (pagoProveedorSelect) {
      pagoProveedorSelect.innerHTML = '<option value="">Seleccionar proveedor...</option>' + proveedoresCache.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    }
  } catch (error) {
    console.error('Error cargando proveedores:', error);
    const proveedorSelect = document.getElementById('id_proveedor');
    if (proveedorSelect) proveedorSelect.innerHTML = '<option value="">Seleccionar proveedor...</option>';
    const ordenProveedorSelect = document.getElementById('ordenIdProveedor');
    if (ordenProveedorSelect) ordenProveedorSelect.innerHTML = '<option value="">Seleccionar proveedor...</option>';
    const pagoProveedorSelect = document.getElementById('pagoProveedor');
    if (pagoProveedorSelect) pagoProveedorSelect.innerHTML = '<option value="">Seleccionar proveedor...</option>';
    const tbody = document.getElementById('tablaProveedores');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error cargando proveedores</td></tr>';
  }
}

async function guardarProveedor(event) {
  event.preventDefault();

  const id = document.getElementById('proveedorId').value;
  const proveedor = {
    nombre: document.getElementById('nombreProveedor').value.trim(),
    telefono: document.getElementById('telefonoProveedor').value.trim(),
    correo: document.getElementById('correoProveedor').value.trim(),
    direccion: document.getElementById('direccionProveedor').value.trim()
  };

  if (!proveedor.nombre) {
    alert('El nombre del proveedor es requerido');
    return;
  }

  try {
    if (id) {
      await apiCall('PUT', `${API_CONFIG.endpoints.proveedores}/${id}`, proveedor);
      alert('Proveedor actualizado correctamente');
    } else {
      await apiCall('POST', API_CONFIG.endpoints.proveedores, proveedor);
      alert('Proveedor guardado correctamente');
    }

    cancelarProveedor();
    await cargarProveedores();
  } catch (error) {
    console.error('Error guardando proveedor:', error);
    alert('No se pudo actualizar el proveedor. Reinicia el servidor, recarga la página con Ctrl + F5 e inténtalo nuevamente.');
  }
}

window.editarProveedor = async function(id) {
  try {
    const proveedor = proveedoresCache.find(p => Number(p.id) === Number(id)) || await apiCall('GET', `${API_CONFIG.endpoints.proveedores}/${id}`);
    document.getElementById('proveedorId').value = proveedor.id || id;
    document.getElementById('nombreProveedor').value = proveedor.nombre || '';
    document.getElementById('telefonoProveedor').value = proveedor.telefono || '';
    document.getElementById('correoProveedor').value = proveedor.correo || '';
    document.getElementById('direccionProveedor').value = proveedor.direccion || '';
    document.getElementById('btnGuardarProveedor').textContent = 'Actualizar Proveedor';
    document.getElementById('btnCancelarProveedor').classList.remove('d-none');
  } catch (error) {
    alert('No se pudo cargar el proveedor para editar.');
  }
};

function cancelarProveedor() {
  document.getElementById('formProveedor').reset();
  document.getElementById('proveedorId').value = '';
  document.getElementById('btnGuardarProveedor').textContent = 'Guardar Proveedor';
  document.getElementById('btnCancelarProveedor').classList.add('d-none');
}

window.eliminarProveedor = async function(id) {
  if (!confirm('¿Eliminar proveedor?')) return;

  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.proveedores}/${id}`);
    if (document.getElementById('proveedorId').value === String(id)) {
      cancelarProveedor();
    }
    await cargarProveedores();
  } catch (error) {
    alert('Error eliminando proveedor: ' + error.message);
  }
};

function obtenerOrdenesDisponibles() {
  const pagosPagados = new Set(pagosCache
    .filter(p => String(p.estado || '').toUpperCase() === 'PAGADO' && p.id_orden_compra)
    .map(p => Number(p.id_orden_compra))
  );
  return ordenesCache.filter(orden => !pagosPagados.has(Number(orden.id)));
}

function filtrarOrdenesPorProveedor(ordenes, proveedorId) {
  if (!proveedorId) return ordenes;
  return ordenes.filter(orden => String(orden.id_proveedor || '') === String(proveedorId));
}

function actualizarSelectOrdenesDisponibles() {
  const pagoOrdenSelect = document.getElementById('pagoOrden');
  if (!pagoOrdenSelect) return;
  const proveedorId = document.getElementById('pagoProveedor')?.value || '';
  const ordenesDisponibles = filtrarOrdenesPorProveedor(obtenerOrdenesDisponibles(), proveedorId);
  if (ordenesDisponibles.length === 0) {
    pagoOrdenSelect.innerHTML = '<option value="">No hay órdenes disponibles</option>';
    return;
  }
  pagoOrdenSelect.innerHTML = '<option value="">Sin orden específica</option>' + ordenesDisponibles.map(orden => `<option value="${orden.id}">#${orden.id} - ${orden.proveedor || orden.nombre_proveedor || 'Proveedor'} - Q${Number(orden.total || 0).toFixed(2)}</option>`).join('');
}

async function cargarOrdenes() {
  try {
    const ordenes = await apiCall('GET', API_CONFIG.endpoints.ordenes);
    ordenesCache = ordenes || [];
    const tbody = document.getElementById('ordenesTable');
    const pagoOrdenSelect = document.getElementById('pagoOrden');

    if (!ordenesCache || ordenesCache.length === 0) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay órdenes de compra</td></tr>';
      if (pagoOrdenSelect) pagoOrdenSelect.innerHTML = '<option value="">Sin orden específica</option>';
      return;
    }

    if (tbody) {
      tbody.innerHTML = ordenesCache.map(orden => `
        <tr>
          <td>${orden.id}</td>
          <td>${orden.proveedor || orden.nombre_proveedor || '-'}</td>
          <td>${formatearFechaCorta(orden.fecha)}</td>
          <td>Q${Number(orden.total || 0).toFixed(2)}</td>
          <td>
            <button class="btn btn-sm btn-info me-1" onclick="verOrdenCompra(${orden.id})">Detalles</button>
            <button class="btn btn-sm btn-danger" onclick="eliminarOrden(${orden.id})">Eliminar</button>
          </td>
        </tr>
      `).join('');
    }
    if (pagoOrdenSelect) {
      actualizarSelectOrdenesDisponibles();
    }
  } catch (error) {
    console.error('Error cargando órdenes:', error);
    const tbody = document.getElementById('ordenesTable');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error cargando órdenes</td></tr>';
  }
}

function onPagoProveedorChange() {
  actualizarSelectOrdenesDisponibles();
}

function actualizarBloqueoCamposPago() {
  const pagoOrdenSelect = document.getElementById('pagoOrden');
  const pagoProveedorSelect = document.getElementById('pagoProveedor');
  const montoInput = document.getElementById('monto_pagado');
  // Mantener siempre bloqueados el select de proveedor y el campo monto.
  if (pagoProveedorSelect) {
    pagoProveedorSelect.disabled = true;
  }
  if (montoInput) {
    montoInput.readOnly = true;
    montoInput.classList.add('bg-light');
  }
}

function onPagoOrdenChange() {
  const pagoOrdenSelect = document.getElementById('pagoOrden');
  if (!pagoOrdenSelect) return;
  const ordenId = pagoOrdenSelect.value;

  if (!ordenId) {
    actualizarBloqueoCamposPago();
    return;
  }

  const orden = ordenesCache.find(item => String(item.id) === String(ordenId));
  if (!orden) {
    actualizarBloqueoCamposPago();
    return;
  }

  const proveedorSelect = document.getElementById('pagoProveedor');
  if (proveedorSelect && orden.id_proveedor) {
    proveedorSelect.value = orden.id_proveedor;
  }

  const montoInput = document.getElementById('monto_pagado');
  if (montoInput) montoInput.value = Number(orden.total || 0).toFixed(2);

  actualizarBloqueoCamposPago();
}

async function guardarOrden(event) {
  event.preventDefault();
  const orden = {
    proveedor: document.getElementById('ordenIdProveedor').selectedOptions[0]?.textContent?.trim() || '',
    id_proveedor: document.getElementById('ordenIdProveedor').value || null,
    fecha: document.getElementById('ordenFecha').value || null,
    total: Number(document.getElementById('ordenTotal').value || 0),
    lines: ordenLineas.map(l => ({ id_producto: l.id_producto, cantidad: l.cantidad, precio_unitario: l.precio_unitario, total_item: l.total_item }))
  };

  if (!orden.id_proveedor) { alert('El proveedor es requerido'); return; }

  try {
    await apiCall('POST', API_CONFIG.endpoints.ordenes, orden);
    ordenLineas = [];
    renderOrdenLineas();
    limpiarFormularioOrden();
    await cargarOrdenes();
    alert('Orden guardada correctamente');
  } catch (error) { alert('Error guardando orden: ' + error.message); }
}

function limpiarCamposLineaOrden() {
  document.getElementById('ordenProducto').value = '';
  document.getElementById('ordenCantidad').value = '';
  document.getElementById('ordenPrecio').value = '';
  document.getElementById('ordenProducto').focus();
}

function limpiarFormularioOrden() {
  document.getElementById('formOrden').reset();
  const totalInput = document.getElementById('ordenTotal');
  if (totalInput) {
    totalInput.readOnly = true;
    totalInput.value = '0.00';
  }
}

function agregarLineaOrden() {
  const id_producto = Number(document.getElementById('ordenProducto').value || 0);
  const cantidad = Number(document.getElementById('ordenCantidad').value || 0);
  const precio_unitario = Number(document.getElementById('ordenPrecio').value || 0);
  if (!id_producto || cantidad <= 0) return alert('Producto y cantidad son requeridos');
  const existeLinea = ordenLineas.some(l => Number(l.id_producto) === id_producto);
  if (existeLinea) return alert('Ese producto ya fue agregado a la tabla');
  const producto = productosCache.find(p => Number(p.id_producto) === Number(id_producto));
  const nombre_producto = producto ? producto.nombre_producto : 'Producto ' + id_producto;
  const total_item = Number((cantidad * precio_unitario).toFixed(2));
  ordenLineas.push({ id_producto, nombre_producto, cantidad, precio_unitario, total_item });
  limpiarCamposLineaOrden();
  renderOrdenLineas();
}

function renderOrdenLineas() {
  const tbody = document.getElementById('ordenLineasTable');
  const totalInput = document.getElementById('ordenTotal');
  if (!ordenLineas || ordenLineas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay líneas</td></tr>';
    if (totalInput) {
      totalInput.readOnly = true;
      totalInput.value = '0.00';
    }
    return;
  }
  tbody.innerHTML = ordenLineas.map((l, i) => `
    <tr>
      <td>${l.nombre_producto}</td>
      <td>${l.cantidad}</td>
      <td>Q${Number(l.precio_unitario).toFixed(2)}</td>
      <td>Q${Number(l.total_item).toFixed(2)}</td>
      <td><button class="btn btn-sm btn-danger" onclick="eliminarLineaOrden(${i})">Eliminar</button></td>
    </tr>
  `).join('');
  const total = ordenLineas.reduce((s, l) => s + Number(l.total_item || 0), 0);
  if (totalInput) {
    totalInput.readOnly = true;
    totalInput.value = total.toFixed(2);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[s]));
}

window.eliminarLineaOrden = function(i) { ordenLineas.splice(i,1); renderOrdenLineas(); };

window.eliminarOrden = async function(id) {
  if (!confirm('¿Eliminar orden de compra?')) return;

  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.ordenes}/${id}`);
    await cargarOrdenes();
  } catch (error) {
    alert('Error eliminando orden: ' + error.message);
  }
};

async function cargarRecepciones() {
  try {
    const recepciones = await apiCall('GET', API_CONFIG.endpoints.recepciones);
    recepcionesCache = recepciones || [];
    const tbody = document.getElementById('recepcionesTable');

    if (recepcionesCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay recepciones registradas</td></tr>';
      return;
    }

    tbody.innerHTML = recepcionesCache.map(recepcion => `
      <tr>
        <td>${recepcion.id}</td>
        <td>${recepcion.orden_id}</td>
        <td>${formatearFechaCorta(recepcion.fecha_recepcion)}</td>
        <td><span class="badge bg-secondary">${recepcion.estado || 'pendiente'}</span></td>
        <td>
          <button class="btn btn-sm btn-info me-1" onclick="verRecepcionDetalles(${recepcion.id})">Detalles</button>
          ${(() => {
            const estado = String(recepcion.estado || '').toLowerCase();
            if (estado === 'recibido' || estado === 'recibida') {
              return '';
            }
            return `
              <button class="btn btn-sm btn-success me-1" onclick="marcarRecepcion(${recepcion.id}, 'recibido')">Marcar recibido</button>
            `;
          })()}
          <button class="btn btn-sm btn-danger" onclick="eliminarRecepcion(${recepcion.id})">Eliminar</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error cargando recepciones:', error);
    document.getElementById('recepcionesTable').innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error cargando recepciones</td></tr>';
  }
}

async function guardarRecepcion(event) {
  event.preventDefault();

  const estadoRecepcion = document.getElementById('recepcionEstado');
  if (estadoRecepcion) estadoRecepcion.value = 'pendiente';

  const recepcion = {
    orden_id: Number(document.getElementById('recepcionOrdenId').value),
    fecha_recepcion: document.getElementById('recepcionFecha').value || null,
    estado: 'pendiente',
    id_almacen: document.getElementById('recepcionAlmacen').value || null
  };

  if (!recepcion.orden_id) {
    alert('El ID de la orden es requerido');
    return;
  }

  if (!recepcion.id_almacen) {
    alert('Selecciona un almacén destino antes de guardar la recepción.');
    return;
  }

  const almacenSeleccionado = almacenesCache.find(a => Number(a.id_almacen) === Number(recepcion.id_almacen));
  if (almacenSeleccionado && Number(almacenSeleccionado.estado) !== 1) {
    alert('No se puede guardar la recepción en un almacén inactivo. Activa el almacén o selecciona otro almacén activo.');
    return;
  }

  try {
    await apiCall('POST', API_CONFIG.endpoints.recepciones, recepcion);
    document.getElementById('formRecepcion').reset();
    if (estadoRecepcion) estadoRecepcion.value = 'pendiente';
    const select = document.getElementById('recepcionAlmacen'); if (select) select.value = '';
    await cargarRecepciones();
    alert('Recepción guardada correctamente');
  } catch (error) {
    alert('Error guardando recepción: ' + error.message);
  }
}

window.verRecepcionDetalles = async function(id) {
  try {
    const recepcion = recepcionesCache.find(r => r.id === id);
    if (!recepcion) {
      alert('Recepción no encontrada');
      return;
    }

    if (!recepcion.orden_id) {
      alert('Esta recepción no está asociada a una orden');
      return;
    }

    const orden = await apiCall('GET', `${API_CONFIG.endpoints.ordenes}/${recepcion.orden_id}`);
    if (!orden) {
      alert('Orden asociada no encontrada');
      return;
    }

    const detalles = (orden.lines || []).map(item => {
      const producto = productosCache.find(p => Number(p.id_producto) === Number(item.id_producto));
      const nombre = producto ? producto.nombre_producto : `Producto #${item.id_producto}`;
      return `${nombre} — Cantidad: ${item.cantidad} — Precio unitario: Q${Number(item.precio_unitario || 0).toFixed(2)} — Total: Q${Number(item.total_item || 0).toFixed(2)}`;
    }).join('\n');

    const mensaje = [
      `Recepción #${recepcion.id}`,
      `Orden asociada: #${orden.id}`,
      `Proveedor: ${orden.proveedor || orden.nombre_proveedor || 'N/A'}`,
      `Fecha orden: ${formatearFechaCorta(orden.fecha)}`,
      `Fecha recepción: ${formatearFechaCorta(recepcion.fecha_recepcion)}`,
      `Estado recepción: ${recepcion.estado || 'pendiente'}`,
      `Total orden: Q${Number(orden.total || 0).toFixed(2)}`,
      '',
      'Productos ingresados:' ,
      `${detalles || 'Sin detalles de orden registrados'}`
    ].join('\n');

    alert(mensaje);
  } catch (error) {
    alert('Error cargando detalles de recepción: ' + error.message);
  }
};

window.verOrdenCompra = async function(id) {
  try {
    const orden = await apiCall('GET', `${API_CONFIG.endpoints.ordenes}/${id}`);
    if (!orden) {
      alert('Orden no encontrada');
      return;
    }

    const detalles = (orden.lines || []).map(item => {
      const producto = productosCache.find(p => Number(p.id_producto) === Number(item.id_producto));
      const nombre = producto ? producto.nombre_producto : `Producto #${item.id_producto}`;
      return `${nombre} — Cantidad: ${item.cantidad} — Precio unitario: Q${Number(item.precio_unitario || 0).toFixed(2)} — Total: Q${Number(item.total_item || 0).toFixed(2)}`;
    }).join('\n');

    const mensaje = [
      `Orden de compra #${orden.id}`,
      `Proveedor: ${orden.proveedor || orden.nombre_proveedor || 'N/A'}`,
      `Fecha: ${formatearFechaCorta(orden.fecha)}`,
      `Total: Q${Number(orden.total || 0).toFixed(2)}`,
      '',
      'Productos ingresados:',
      `${detalles || 'Sin detalles registrados'}`
    ].join('\n');

    alert(mensaje);
  } catch (error) {
    alert('Error cargando detalles de orden: ' + error.message);
  }
};

window.eliminarRecepcion = async function(id) {
  if (!confirm('¿Eliminar recepción?')) return;

  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.recepciones}/${id}`);
    await cargarRecepciones();
  } catch (error) {
    alert('Error eliminando recepción: ' + error.message);
  }
};

window.editarRecepcion = async function(id) {
  try {
    const recepcion = recepcionesCache.find(r => r.id === id) || await apiCall('GET', `${API_CONFIG.endpoints.recepciones}/${id}`);
    const nuevoEstado = prompt('Nuevo estado para la recepción (pendiente, recibido):', recepcion.estado || 'pendiente');
    if (!nuevoEstado) return;
    await apiCall('PUT', `${API_CONFIG.endpoints.recepciones}/${id}/estado`, { estado: nuevoEstado });
    await refrescarDespuesDeRecepcion();
    alert('Estado actualizado');
  } catch (err) { alert('Error actualizando estado: ' + err.message); }
};

window.marcarRecepcion = async function(id, estado = 'recibido') {
  if (!confirm('Marcar recepción como "' + estado + '"?')) return;
  try {
    await apiCall('PUT', `${API_CONFIG.endpoints.recepciones}/${id}/estado`, { estado });
    await refrescarDespuesDeRecepcion();
  } catch (err) { alert('Error: ' + err.message); }
};

async function refrescarDespuesDeRecepcion() {
  await Promise.all([
    cargarRecepciones(),
    cargarOrdenes(),
    cargarInventarios(),
    cargarProductos()
  ]);
}

async function cargarCompras() {
  try {
    const compras = await apiCall('GET', API_CONFIG.endpoints.compras);
    comprasCache = compras || [];
    const tbody = document.getElementById('comprasTable');

    if (comprasCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay compras registradas</td></tr>';
      return;
    }

    tbody.innerHTML = comprasCache.map(compra => `
      <tr>
        <td>${compra.id}</td>
        <td>${compra.producto}</td>
        <td>${compra.cantidad}</td>
        <td>Q${Number(compra.total || 0).toFixed(2)}</td>
        <td>${formatearFechaCorta(compra.fecha)}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="eliminarCompra(${compra.id})">Eliminar</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error cargando compras:', error);
    document.getElementById('comprasTable').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error cargando compras</td></tr>';
  }
}

async function guardarCompra(event) {
  event.preventDefault();

  const compra = {
    producto: document.getElementById('compraProducto').value.trim(),
    cantidad: Number(document.getElementById('compraCantidad').value || 0),
    total: Number(document.getElementById('compraTotal').value || 0),
    fecha: document.getElementById('compraFecha').value || null
  };

  if (!compra.producto || compra.cantidad <= 0) {
    alert('Producto y cantidad son requeridos');
    return;
  }

  try {
    await apiCall('POST', API_CONFIG.endpoints.compras, compra);
    document.getElementById('formCompra').reset();
    await cargarCompras();
    alert('Compra guardada correctamente');
  } catch (error) {
    alert('Error guardando compra: ' + error.message);
  }
}

window.eliminarCompra = async function(id) {
  if (!confirm('¿Eliminar compra?')) return;

  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.compras}/${id}`);
    await cargarCompras();
  } catch (error) {
    alert('Error eliminando compra: ' + error.message);
  }
};

// Costos y finanzas
async function cargarResumenFinanzas() {
  try {
    const resumen = await apiCall('GET', API_CONFIG.endpoints.finanzasResumen);
    setTextIfExists('totalCostos', formatearMoneda(resumen.total_costos));
    setTextIfExists('totalPagos', formatearMoneda(resumen.total_pagos));
    setTextIfExists('valorInventario', formatearMoneda(resumen.valor_inventario_costo));
    setTextIfExists('margenPotencial', formatearMoneda(resumen.margen_potencial));
  } catch (error) {
    console.error('Error cargando resumen financiero:', error);
  }
}

function renderTablaInventarioFinanzas() {
  const tbody = document.getElementById('tablaInventarioFinanzas');
  if (!tbody) return;

  if (!productosCache.length || !inventariosCache.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay datos de inventario financiero disponibles.</td></tr>';
    return;
  }

  const inventarioPorProducto = inventariosCache.reduce((acc, inv) => {
    const idProducto = Number(inv.id_producto);
    const stockActual = Number(inv.stock_actual || 0);
    if (!acc[idProducto]) acc[idProducto] = { id_producto: idProducto, stock_actual: 0 };
    acc[idProducto].stock_actual += stockActual;
    return acc;
  }, {});

  const filas = Object.values(inventarioPorProducto).map(entry => {
    const producto = productosCache.find(p => Number(p.id_producto) === Number(entry.id_producto));
    const stock = entry.stock_actual;
    const costoUnitario = Number(producto?.precio_compra || 0);
    const ventaUnitario = Number(producto?.precio_venta || 0);
    const costoTotal = stock * costoUnitario;
    const ventaTotal = stock * ventaUnitario;
    const ganancia = ventaTotal - costoTotal;

    return `
      <tr>
        <td>${producto ? producto.nombre_producto : `Producto ${entry.id_producto}`}</td>
        <td>${stock}</td>
        <td>${formatearMoneda(costoUnitario)}</td>
        <td>${formatearMoneda(costoTotal)}</td>
        <td>${formatearMoneda(ventaUnitario)}</td>
        <td>${formatearMoneda(ventaTotal)}</td>
        <td>${formatearMoneda(ganancia)}</td>
      </tr>
    `;
  });

  if (filas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay inventario financiero para mostrar.</td></tr>';
    return;
  }

  tbody.innerHTML = filas.join('');
}

async function cargarCostos() {
  const tbody = document.getElementById('tablaCostos');
  if (!tbody) return;

  try {
    const costos = await apiCall('GET', API_CONFIG.endpoints.costos);
    costosCache = costos || [];

    if (costosCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay costos registrados</td></tr>';
      return;
    }

    tbody.innerHTML = costosCache.map(costo => `
      <tr>
        <td>${costo.id_costo}</td>
        <td>${costo.tipo_costo || '-'}</td>
        <td>${costo.descripcion || '-'}</td>
        <td>${costo.nombre_producto || '-'}</td>
        <td>${formatearMoneda(costo.monto)}</td>
        <td>${formatearFechaCorta(costo.fecha_costo)}</td>
        <td>
          <button class="btn btn-sm btn-warning me-1" onclick="editarCosto(${costo.id_costo})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarCosto(${costo.id_costo})">Eliminar</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error cargando costos:', error);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error cargando costos</td></tr>';
  }
}

async function guardarCosto(event) {
  event.preventDefault();

  const form = event.target;
  const editingId = form.dataset.editingId;
  const usuario = Auth.getUsuario();
  const tipoCostoValor = String(document.getElementById('tipo_costo').value || '').trim().toUpperCase();
  const tiposPermitidos = ['DIRECTO', 'INDIRECTO', 'OPERATIVO', 'ADMINISTRATIVO'];
  const costo = {
    tipo_costo: tipoCostoValor,
    descripcion: document.getElementById('descripcion_costo').value.trim(),
    monto: Number(document.getElementById('monto_costo').value || 0),
    id_usuario: usuario?.id_usuario || null,
    id_producto: document.getElementById('costoProducto').value || null
  };

  if (!costo.tipo_costo || !costo.descripcion || costo.monto <= 0) {
    alert('Tipo, descripción y monto son requeridos');
    return;
  }
  if (!tiposPermitidos.includes(costo.tipo_costo)) {
    alert('Tipo de costo inválido. Selecciona Directo, Indirecto, Operativo o Administrativo.');
    return;
  }

  try {
    if (editingId) {
      await apiCall('PUT', `${API_CONFIG.endpoints.costos}/${editingId}`, costo);
    } else {
      await apiCall('POST', API_CONFIG.endpoints.costos, costo);
    }
    form.reset();
    delete form.dataset.editingId;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.textContent = 'Guardar Costo';
    await Promise.all([cargarCostos(), cargarResumenFinanzas()]);
    alert(editingId ? 'Costo actualizado correctamente' : 'Costo guardado correctamente');
  } catch (error) {
    alert('Error guardando costo: ' + error.message);
  }
}

window.editarCosto = function(id) {
  const costo = costosCache.find(item => Number(item.id_costo) === Number(id));
  if (!costo) {
    alert('No se encontró el costo a editar');
    return;
  }

  const form = document.getElementById('formCosto');
  if (!form) return;

  document.getElementById('tipo_costo').value = costo.tipo_costo || '';
  document.getElementById('descripcion_costo').value = costo.descripcion || '';
  document.getElementById('monto_costo').value = costo.monto ?? '';
  document.getElementById('costoProducto').value = costo.id_producto || '';
  form.dataset.editingId = id;

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.textContent = 'Actualizar Costo';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.eliminarCosto = async function(id) {
  if (!confirm('¿Eliminar costo?')) return;

  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.costos}/${id}`);
    await Promise.all([cargarCostos(), cargarResumenFinanzas()]);
  } catch (error) {
    alert('Error eliminando costo: ' + error.message);
  }
};

async function cargarPagos() {
  const tbody = document.getElementById('tablaPagos');
  if (!tbody) return;

  try {
    const pagos = await apiCall('GET', API_CONFIG.endpoints.pagos);
    pagosCache = pagos || [];

    if (pagosCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay pagos registrados</td></tr>';
      return;
    }

    tbody.innerHTML = pagosCache.map(pago => {
      const pagado = String(pago.estado || '').toUpperCase() === 'PAGADO';
      return `
      <tr>
        <td>${pago.id_pago}</td>
        <td>${pago.proveedor_nombre || pago.id_proveedor || '-'}</td>
        <td>${pago.id_orden_compra ? `#${pago.id_orden_compra}` : '-'}</td>
        <td>${formatearMoneda(pago.monto_pagado)}</td>
        <td>${pago.metodo_pago || '-'}</td>
        <td><span class="badge ${getPagoBadge(pago.estado)}">${pago.estado || 'PENDIENTE'}</span></td>
        <td>
          <button class="btn btn-sm btn-warning me-1" onclick="editarPago(${pago.id_pago})" ${pagado ? 'disabled title="Pago pagado no editable"' : ''}>Editar</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarPago(${pago.id_pago})">Eliminar</button>
        </td>
      </tr>
    `;
    }).join('');
  } catch (error) {
    console.error('Error cargando pagos:', error);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error cargando pagos</td></tr>';
  }
}

async function guardarPago(event) {
  event.preventDefault();

  const form = event.target;
  const editingId = form.dataset.editingId;
  const pago = {
    id_proveedor: document.getElementById('pagoProveedor').value,
    id_orden_compra: document.getElementById('pagoOrden').value || null,
    monto_pagado: Number(document.getElementById('monto_pagado').value || 0),
    metodo_pago: document.getElementById('metodo_pago').value,
    estado: document.getElementById('estado_pago').value
  };

  if (!pago.id_proveedor || pago.monto_pagado <= 0 || !pago.metodo_pago) {
    alert('Proveedor, monto y método de pago son requeridos');
    return;
  }

  if (editingId) {
    const pagoExistente = pagosCache.find(item => String(item.id_pago) === String(editingId));
    if (pagoExistente && String(pagoExistente.estado || '').toUpperCase() === 'PAGADO') {
      alert('No se puede editar un pago que ya está marcado como PAGADO.');
      return;
    }
  }

  try {
    if (editingId) {
      await apiCall('PUT', `${API_CONFIG.endpoints.pagos}/${editingId}`, pago);
    } else {
      await apiCall('POST', API_CONFIG.endpoints.pagos, pago);
    }
    form.reset();
    delete form.dataset.editingId;
    actualizarBloqueoCamposPago();
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.textContent = 'Guardar Pago';
    await Promise.all([cargarPagos(), cargarResumenFinanzas(), cargarOrdenes()]);
    alert(editingId ? 'Pago actualizado correctamente' : 'Pago guardado correctamente');
  } catch (error) {
    alert('Error guardando pago: ' + error.message);
  }
}

window.editarPago = function(id) {
  const pago = pagosCache.find(item => Number(item.id_pago) === Number(id));
  if (!pago) {
    alert('No se encontró el pago a editar');
    return;
  }

  if (String(pago.estado || '').toUpperCase() === 'PAGADO') {
    alert('Este pago ya está marcado como PAGADO y no se puede editar.');
    return;
  }

  const form = document.getElementById('formPago');
  if (!form) return;

  document.getElementById('pagoProveedor').value = pago.id_proveedor || '';
  actualizarSelectOrdenesDisponibles();
  document.getElementById('pagoOrden').value = pago.id_orden_compra || '';
  document.getElementById('monto_pagado').value = pago.monto_pagado ?? '';
  document.getElementById('metodo_pago').value = pago.metodo_pago || '';
  document.getElementById('estado_pago').value = pago.estado || 'PENDIENTE';
  form.dataset.editingId = id;
  actualizarBloqueoCamposPago();

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.textContent = 'Actualizar Pago';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.eliminarPago = async function(id) {
  if (!confirm('¿Eliminar pago?')) return;

  try {
    await apiCall('DELETE', `${API_CONFIG.endpoints.pagos}/${id}`);
    await Promise.all([cargarPagos(), cargarResumenFinanzas(), cargarOrdenes()]);
  } catch (error) {
    alert('Error eliminando pago: ' + error.message);
  }
};

function formatearNumero(valor) {
  return Number(valor || 0).toLocaleString('en-US');
}

function formatearMoneda(valor) {
  return `Q${Number(valor || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function setTextIfExists(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function getPagoBadge(estado) {
  switch (String(estado || '').toUpperCase()) {
    case 'PAGADO':
      return 'bg-success';
    case 'ANULADO':
      return 'bg-danger';
    default:
      return 'bg-warning text-dark';
  }
}

function formatearFechaCorta(fecha) {
  if (!fecha) return '-';
  return String(fecha).slice(0, 10);
}
