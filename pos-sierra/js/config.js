'use strict';
/* ===== Configuración: negocio, cotizaciones, operación y herramientas ===== */
(() => {
  let C = {}, tab = 'negocio', dirty = false;
  const TABS = [['negocio', 'Negocio'], ['cotiz', 'Cotizaciones'], ['oper', 'Operación'], ['herr', 'Herramientas']];
  const inp = (k, l, o = {}) => `<label class="fl">${l}<input data-k="${k}" value="${esc(C[k] || '')}" ${o.type ? `type="${o.type}"` : ''} ${o.ph ? `placeholder="${o.ph}"` : ''} ${o.attr || ''}></label>`;
  const area = (k, l, ph) => `<label class="fl">${l}<textarea data-k="${k}" placeholder="${ph || ''}" style="min-height:90px;padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:inherit;font-weight:400">${esc(C[k] || '')}</textarea></label>`;
  const card = (t, h, sub) => `<div class="card" style="margin-bottom:14px"><b>${t}</b>${sub ? `<p class="mu" style="margin:2px 0 10px">${sub}</p>` : '<div style="height:8px"></div>'}${h}</div>`;
  const grid = h => `<div class="form">${h}</div>`;

  views.configuracion = {
    render(root) {
      if (!dirty) C = { ...(S.config || {}) };
      root.innerHTML = `<div class="pagehead"><h2>Configuración</h2><span class="cact"><span class="mu" id="cd" ${dirty ? '' : 'hidden'}>● Cambios sin guardar</span><button class="btn primary" data-a="save">Guardar cambios</button></span></div>
        <div class="chips">${TABS.map(([k, l]) => `<button class="chip" data-t="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div><div id="ct"></div>`;
      root.onclick = async e => {
        const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; views.configuracion.render(root); return; }
        const a = e.target.closest('[data-a]'); if (a && A[a.dataset.a]) A[a.dataset.a](a);
      };
      root.oninput = e => { const k = e.target.dataset.k; if (k !== undefined) { C[k] = e.target.value; dirty = true; $('#cd').hidden = false; } };
      root.onchange = e => { if (e.target.id === 'logof' && e.target.files[0]) logo(e.target.files[0]); };
      $('#ct').innerHTML = TABS.find(x => x[0] === tab) && ({ negocio, cotiz, oper, herr })[tab]();
    }
  };

  function negocio() {
    return card('Datos del negocio', grid(inp('nombre', 'Nombre comercial') + inp('razonSocial', 'Razón social') + inp('rfc', 'RFC') + inp('regimen', 'Régimen fiscal') + inp('telefono', 'Teléfono', { type: 'tel' }) + inp('correo', 'Correo', { type: 'email' }) + inp('web', 'Sitio web') + inp('direccion', 'Dirección') + inp('cp', 'Código postal') + inp('ciudad', 'Ciudad y estado')), 'Aparecen en cotizaciones, tickets y reportes.') +
      card('Imagen de marca', `<div class="chead">${/^data:image\//.test(C.logo || '') ? `<img src="${C.logo}" alt="Logo" style="max-height:60px;max-width:180px;border:1px solid var(--line);border-radius:8px;padding:4px;background:#fff">` : '<span class="mu">Sin logo</span>'}
        <span class="cact"><label class="btn sm">Subir logo<input id="logof" type="file" accept="image/*" hidden></label>${C.logo ? '<button class="btn sm ghost" data-a="nologo">Quitar</button>' : ''}</span></div>
        <div style="margin-top:12px" class="form"><label class="fl">Color de marca<input data-k="color" type="color" value="${/^#[0-9a-f]{6}$/i.test(C.color || '') ? C.color : '#a35d17'}" style="padding:4px"></label></div>`, 'El logo se reduce automáticamente. El color se usa en cotizaciones y reportes.');
  }
  function cotiz() {
    return card('Condiciones comerciales', grid(inp('vigenciaDias', 'Vigencia (días)', { type: 'number', ph: '15', attr: 'min="1"' }) + inp('condPago', 'Forma de pago', { ph: 'Ej. 50% anticipo, 50% contra entrega' }) + inp('tiempoEntrega', 'Tiempo de entrega', { ph: 'Ej. 3 días hábiles' }) +
      `<label class="fl">IVA<select data-k="ivaModo">${[['ninguno', 'No desglosar IVA'], ['incluido', 'Precios incluyen IVA (desglosar)'], ['sumar', 'Sumar IVA al total']].map(([v, l]) => `<option value="${v}" ${(C.ivaModo || 'ninguno') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` + inp('ivaTasa', 'Tasa de IVA (%)', { type: 'number', ph: '16' })), 'La vigencia aplica a las cotizaciones nuevas.') +
      card('Textos del documento', area('notas', 'Términos y condiciones', 'Ej. Precios sujetos a cambio sin previo aviso. Entrega sujeta a disponibilidad.') + area('datosBancarios', 'Datos para pago (banco, titular, CLABE)') + grid(inp('firmaNombre', 'Nombre de quien firma') + inp('firmaPuesto', 'Puesto')), '') +
      `<button class="btn" data-a="demo">Ver cotización de ejemplo (PDF)</button><p class="mu">Guarda los cambios antes para ver el ejemplo con la configuración nueva.</p>`;
  }
  function oper() {
    return card('Ticket de venta', grid(inp('ticketLeyenda', 'Leyenda al pie del ticket', { ph: '¡Gracias por su compra!' })), 'El nombre y teléfono salen de los datos del negocio.') +
      card('Alertas y metas', grid(inp('margenMin', 'Margen mínimo deseado (%)', { type: 'number', ph: '30' }) + inp('diasInactivo', 'Días para considerar inactivo a un cliente', { type: 'number', ph: '30' }) + inp('metaMensual', 'Meta de ventas mensual ($)', { type: 'number', ph: '0' })), 'El margen mínimo marca los productos con "Margen bajo". La meta aparece en Reportes y en el reporte ejecutivo.');
  }
  function herr() {
    const n = { v: tickets().length, l: S.ventas.length, c: S.clients.length, p: S.prods.length, q: S.cots.length, a: (S.abonos || []).length };
    return card('Estado del sistema', `<div class="tl"><span class="mu">Versión</span><b>${VERSION}</b></div><div class="tl"><span class="mu">Última actualización</span><b>${net.last ? net.last.toLocaleTimeString('es-MX') : '—'}</b></div>
      <div class="tl"><span class="mu">Registros</span><b>${n.v} tickets · ${n.c} clientes · ${n.p} productos · ${n.q} cotizaciones</b></div>
      <div class="cact" style="margin-top:10px"><button class="btn sm" data-a="ping">Probar conexión</button><button class="btn sm ghost" data-a="reload">Actualizar la aplicación</button></div>`) +
      card('Respaldo y exportación', `<p class="mu" style="margin-top:0">Descarga tus datos a tu equipo. El respaldo completo incluye clientes y ventas: guárdalo en un lugar seguro.</p>
        <div class="cact"><button class="btn sm primary" data-a="backup">Respaldo completo (JSON)</button><button class="btn sm ghost" data-a="csvv">Ventas (CSV)</button><button class="btn sm ghost" data-a="csvc">Clientes (CSV)</button><button class="btn sm ghost" data-a="csvp">Productos (CSV)</button></div>`) +
      card('Este dispositivo', `<div class="cact"><button class="btn sm ghost" data-a="favs">Borrar favoritos</button><button class="btn sm ghost danger" data-a="key">Olvidar la clave guardada</button></div><p class="mu">La clave se vuelve a pedir la próxima vez que abras el POS.</p>`);
  }

  const dlf = (name, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
  const csv = (name, rows) => dlf(name, new Blob(['\ufeff' + rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  const hoy = () => new Date().toISOString().slice(0, 10);

  const A = {
    async save() {
      const o = { ...C }; Object.keys(o).forEach(k => { if (o[k] === undefined || o[k] === null) delete o[k]; });
      await api('saveConfig', o); dirty = false; toast('Configuración guardada'); load();
    },
    nologo() { delete C.logo; dirty = true; views.configuracion.render($('#app')); },
    demo() { Cotizacion.ejemplo(); },
    async ping() { const t = performance.now(); await api('getConfig'); toast('Conexión correcta (' + Math.round(performance.now() - t) + ' ms)'); },
    reload() { location.href = location.pathname + '?r=' + Date.now(); },
    backup() { dlf('respaldo-pos-' + hoy() + '.json', new Blob([JSON.stringify({ fecha: new Date().toISOString(), version: VERSION, productos: S.prods, inactivos: S.inactivos, clientes: S.clients, ventas: S.ventas, cotizaciones: S.cots, abonos: S.abonos, config: { ...S.config, logo: undefined } }, null, 1)], { type: 'application/json' })); toast('Respaldo descargado'); },
    csvv() { csv('ventas-' + hoy() + '.csv', [['Folio', 'Fecha', 'Producto', 'Cantidad', 'Precio', 'Total', 'Método', 'Costo', 'Cliente', 'Estado', 'Tipo', 'Descuento'], ...S.ventas.map(v => [v.folio, new Date(v.fecha).toLocaleString('es-MX'), v.producto, v.cant, v.precio, v.total, v.metodo, v.costo, v.cliente, v.estado, v.tipo, v.desc || 0])]); },
    csvc() { csv('clientes-' + hoy() + '.csv', [['Nombre', 'Teléfono', 'Correo'], ...S.clients.map(c => [c.nombre, c.tel, c.email])]); },
    csvp() { csv('productos-' + hoy() + '.csv', [['Categoría', 'Producto', 'Precio', 'Costo', 'Existencia'], ...S.prods.map(p => [p.cat, p.nombre, p.precio, p.costo, p.stock == null ? '' : p.stock])]); },
    favs() { store.set('favs', []); toast('Favoritos borrados de este dispositivo'); },
    key() { if (confirm('¿Olvidar la clave guardada en este dispositivo?')) { try { localStorage.removeItem('pos_key'); } catch (e) {} toast('Clave olvidada'); } }
  };

  /* Logo: se reduce y se guarda como imagen incrustada (cabe en una celda de Google Sheets) */
  function logo(file) {
    const fr = new FileReader(), img = new Image();
    fr.onload = () => { img.onload = () => {
      const s = Math.min(1, 320 / img.width, 140 / img.height), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(img.width * s)); cv.height = Math.max(1, Math.round(img.height * s));
      const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
      let d = cv.toDataURL('image/png'); if (d.length > 38000) d = cv.toDataURL('image/jpeg', .8);
      if (d.length > 40000) return toast('El logo es muy pesado. Usa una imagen más sencilla o pequeña.', true);
      C.logo = d; dirty = true; views.configuracion.render($('#app'));
    }; img.onerror = () => toast('No se pudo leer la imagen.', true); img.src = fr.result; };
    fr.readAsDataURL(file);
  }
})();
