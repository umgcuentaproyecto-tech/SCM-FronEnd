document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  const submitBtn = loginForm.querySelector('button[type="submit"]');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validar el formulario
    if (!loginForm.checkValidity() === false) {
      e.stopPropagation();
    }

    // Limpiar mensajes anteriores
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';

    // Obtener valores del formulario
    const correo = document.getElementById('correo').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    // Mostrar loading
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Iniciando sesión...';

    try {
      // Realizar login
      // NOTA: Tu API actualmente no tiene endpoint de login con validación de password
      // Este es un ejemplo de cómo sería. Ajusta según tu API real
      
      // Intentar autenticación usando endpoint /api/usuarios/login
      const response = await apiCall('POST', '/usuarios/login', { correo, password });
      if (!response || !response.id_usuario) {
        throw new Error('Correo o contraseña incorrectos');
      }

      const usuario = response;
      // Guardar datos de sesión
      Auth.setToken(`token_${usuario.id_usuario}_${Date.now()}`); // Token demo
      Auth.setUsuario(usuario);

      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('correoGuardado', correo);
      }

      // Mostrar mensaje de éxito
      successMessage.textContent = `¡Bienvenido ${usuario.nombre}!`;
      successMessage.style.display = 'block';

      // Redirigir después de 1.5 segundos
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1500);

    } catch (error) {
      console.error('Login error:', error);
      errorMessage.textContent = error.message || 'Error al iniciar sesión. Verifica tus credenciales.';
      errorMessage.style.display = 'block';

      // Restaurar botón
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
      submitBtn.textContent = 'Iniciar Sesión';
    }
  });

  // Cargar correo guardado si existe
  if (localStorage.getItem('rememberMe') === 'true') {
    const correoGuardado = localStorage.getItem('correoGuardado');
    if (correoGuardado) {
      document.getElementById('correo').value = correoGuardado;
      document.getElementById('rememberMe').checked = true;
    }
  }

  // Validar formulario en tiempo real
  const inputs = loginForm.querySelectorAll('.form-control');
  inputs.forEach(input => {
    input.addEventListener('blur', function() {
      if (this.checkValidity() === false) {
        this.classList.add('is-invalid');
      } else {
        this.classList.remove('is-invalid');
      }
    });

    input.addEventListener('input', function() {
      if (this.checkValidity() === true) {
        this.classList.remove('is-invalid');
      }
    });
  });
});
