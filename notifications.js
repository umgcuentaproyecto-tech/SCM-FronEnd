// Notificaciones globales (toasts)
(function(){
  function ensureContainer(){
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function createToast(type, message, timeout = 6000){
    const container = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${type}`;
    toast.innerHTML = `<div class="toast-body"><strong>${type === 'error' ? 'Error' : type === 'success' ? 'Éxito' : 'Aviso'}</strong><div class="toast-message">${message}</div></div><button class="toast-close">×</button>`;
    container.appendChild(toast);
    // close handler
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.classList.add('hide');
      setTimeout(()=> toast.remove(), 300);
    });
    // auto remove
    setTimeout(()=>{
      if (toast.parentElement) {
        toast.classList.add('hide');
        setTimeout(()=> toast.remove(), 300);
      }
    }, timeout);
  }

  window.showAlert = function(type, message, timeout){
    if (!message) return;
    // sanitize simple dangerous chars
    const safe = String(message).replace(/</g,'&lt;').replace(/>/g,'&gt;');
    createToast(type, safe, timeout);
  };

  // expose convenience shortcuts
  window.showError = (msg, t) => window.showAlert('error', msg, t);
  window.showSuccess = (msg, t) => window.showAlert('success', msg, t);
  window.showInfo = (msg, t) => window.showAlert('info', msg, t);

  // Override global alert() to use toast notifications (keeps confirm intact)
  try {
    const _alert = window.alert;
    window.alert = function(message) {
      try {
        const msg = String(message || '');
        const low = msg.toLowerCase();
        if (low.startsWith('error') || low.includes('error')) {
          // strip common prefixes
          const cleaned = msg.replace(/^error[:\s-]*/i, '');
          window.showError(cleaned);
        } else if (low.includes('guardado') || low.includes('actualizado') || low.includes('eliminado')) {
          window.showSuccess(msg);
        } else {
          window.showInfo(msg);
        }
      } catch(e) { _alert(message); }
    };
  } catch(e) {}
})();
