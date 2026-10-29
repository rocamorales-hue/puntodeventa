'use strict';
/* ===== Pantalla Configuración ===== */
(() => {
  const F = [['nombre', 'Nombre comercial'], ['razonSocial', 'Razón social'], ['rfc', 'RFC'], ['telefono', 'Teléfono'], ['correo', 'Correo'], ['web', 'Sitio web'], ['direccion', 'Dirección'], ['cp', 'Código postal'], ['datosBancarios', 'Datos bancarios / CLABE']];
  views.configuracion = {
    render(root) {
      const c = S.config || {};
      root.innerHTML = `<h2>Configuración</h2><p class="mu">Estos datos aparecen en las cotizaciones impresas.</p>
        <div class="card" style="margin-top:14px"><div class="form">${F.map(([k, l]) => `<input data-k="${k}" placeholder="${l}" aria-label="${l}" value="${esc(c[k] || '')}">`).join('')}</div>
        <textarea id="cn" placeholder="Condiciones de venta y notas" aria-label="Condiciones de venta" style="width:100%;min-height:90px;margin-top:10px;padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit">${esc(c.notas || '')}</textarea>
        <button class="btn primary" id="sv" style="margin-top:10px">Guardar configuración</button></div>`;
      $('#sv').onclick = async () => {
        const o = { ...c }; document.querySelectorAll('[data-k]').forEach(i => o[i.dataset.k] = i.value); o.notas = $('#cn').value;
        await api('saveConfig', o); toast('Configuración guardada'); load();
      };
    }
  };
})();
