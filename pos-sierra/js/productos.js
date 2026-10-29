'use strict';
/* ===== Pantalla Productos: catálogo, edición, margen, desactivar y ajuste masivo de precios ===== */
(() => {
  const D = 864e5, F = { q: '', cat: 'Todas', f: 'Todos', s: 'Nombre' };
  const FILTROS = ['Todos', 'Sin costo', 'Margen bajo', 'Sin ventas (30 días)', 'Inactivos'];
  const SORTS = ['Nombre', 'Precio (mayor)', 'Margen (menor)', 'Más vendidos (30 días)'];
  const mg = p => p.precio > 0 ? (p.precio - p.costo) / p.precio * 100 : 0;
  let V30 = {}, L = [];

  views.productos = {
    render(root) {
      V30 = {}; S.ventas.filter(v => v.fecha >= Date.now() - 30 * D).forEach(v => V30[v.producto] = (V30[v.producto] || 0) + v.cant);
      const A = S.prods, cats = ['Todas', ...new Set(A.map(p => p.cat))], conPrecio = A.filter(p => p.precio > 0);
      root.innerHTML = `<div class="pagehead"><h2>Productos</h2><span class="cact"><button class="btn ghost" data-a="csv">Exportar</button><button class="btn ghost" data-a="bulk">Ajustar precios</button><button class="btn primary" data-a="new">＋ Nuevo producto</button></span></div>
        <div class="kpis"><div class="card kpi"><span class="mu">Productos activos</span><b>${A.length}</b></div>
          <div class="card kpi"><span class="mu">Margen promedio</span><b>${(conPrecio.reduce((s, p) => s + mg(p), 0) / (conPrecio.length || 1)).toFixed(0)}%</b></div>
          <div class="card kpi"><span class="mu">Sin costo capturado</span><b>${A.filter(p => !(p.costo > 0)).length}</b></div>
          <div class="card kpi"><span class="mu">Categorías</span><b>${cats.length - 1}</b></div></div>
        <div class="toolbar"><input id="pq" type="search" placeholder="Buscar producto o categoría" aria-label="Buscar producto" value="${esc(F.q)}">
          <select id="ps" aria-label="Ordenar por">${SORTS.map(s => `<option ${s === F.s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="chips">${cats.map(c => `<button class="chip" data-c="${esc(c)}" aria-pressed="${c === F.cat}">${esc(c)}</button>`).join('')}</div>
        <div class="chips" style="padding-top:0">${FILTROS.map(f => `<button class="chip" data-f="${f}" aria-pressed="${f === F.f}">${f}</button>`).join('')}</div>
        <div class="mu" id="pn"></div><div class="list" id="pl"></div>`;
      $('#pq').oninput = e => { F.q = e.target.value; list(); };
      $('#ps').onchange = e => { F.s = e.target.value; list(); };
      root.onclick = e => {
        const c = e.target.closest('[data-c]'), f = e.target.closest('[data-f]'), a = e.target.closest('[data-a]'), p = e.target.closest('[data-e]');
        if (c) { F.cat = c.dataset.c; views.productos.render(root); } else if (f) { F.f = f.dataset.f; views.productos.render(root); }
        else if (a) ({ new: () => form(null), bulk, csv })[a.dataset.a]();
        else if (p) form(L[+p.dataset.e]);
      };
      list();
    }
  };

  function list() {
    const q = F.q.toLowerCase(), base = F.f === 'Inactivos' ? (S.inactivos || []) : S.prods;
    L = base.filter(p => (p.nombre + ' ' + p.cat).toLowerCase().includes(q) && (F.cat === 'Todas' || p.cat === F.cat) && ({
      'Todos': true, 'Inactivos': true, 'Sin costo': !(p.costo > 0), 'Margen bajo': p.precio > 0 && mg(p) < 30, 'Sin ventas (30 días)': !V30[p.nombre] })[F.f]);
    L.sort(({ 'Nombre': (a, b) => a.nombre.localeCompare(b.nombre), 'Precio (mayor)': (a, b) => b.precio - a.precio, 'Margen (menor)': (a, b) => mg(a) - mg(b), 'Más vendidos (30 días)': (a, b) => (V30[b.nombre] || 0) - (V30[a.nombre] || 0) })[F.s]);
    $('#pn').textContent = L.length + ' producto(s)';
    $('#pl').innerHTML = L.slice(0, 150).map((p, i) => {
      const m = mg(p), cls = !(p.costo > 0) ? '' : m >= 40 ? 'ok' : m >= 20 ? '' : 'x';
      return `<div class="card cli" data-e="${i}"><div class="tl"><b style="min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(p.nombre)}</b><span class="tag ${cls}">${p.costo > 0 ? m.toFixed(0) + '% margen' : 'Sin costo'}</span></div>
        <div class="mu">${esc(p.cat)}${p.stock != null ? ' · ' + p.stock + ' en existencia' : ''}</div>
        <div class="tl" style="margin-top:8px"><b class="amt">${money(p.precio)}</b><span class="mu">Costo ${money(p.costo)} · Utilidad ${money(p.precio - p.costo)}</span></div>
        <div class="tl mu" style="margin-top:6px"><span>${F.f === 'Inactivos' ? 'Inactivo' : (V30[p.nombre] || 0) + ' vendidos en 30 días'}</span><span class="btn sm ghost">${F.f === 'Inactivos' ? 'Reactivar' : 'Editar'}</span></div></div>`;
    }).join('') || '<p class="mu">No hay productos con estos filtros.</p>';
  }

  function form(p) {
    const nuevo = !p, x = p || { cat: '', nombre: '', precio: '', costo: '' }, inactivo = !nuevo && (S.inactivos || []).includes(p);
    modal(`<h2>${nuevo ? 'Nuevo producto' : 'Editar producto'}</h2>
      <label class="fl">Nombre<input id="fn" value="${esc(x.nombre)}" autocomplete="off"></label>
      <label class="fl">Categoría<input id="fc" list="fcl" value="${esc(x.cat)}" placeholder="Ej. Café en grano"></label>
      <datalist id="fcl">${[...new Set(S.prods.map(q => q.cat))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="form" style="grid-template-columns:1fr 1fr"><label class="fl">Precio de venta<input id="fp" type="number" min="0" step="any" inputmode="decimal" value="${x.precio}"></label>
        <label class="fl">Costo<input id="fk" type="number" min="0" step="any" inputmode="decimal" value="${x.costo}"></label></div>
      <div class="mu" id="fm" aria-live="polite"></div>
      ${nuevo ? `<div class="form" style="grid-template-columns:1fr 1fr"><label class="fl">Existencia inicial (opcional)<input id="fs" type="number" min="0" step="any" inputmode="decimal"></label><label class="fl">Mínimo (opcional)<input id="fmn" type="number" min="0" step="any" inputmode="decimal"></label></div>` : ''}
      <div class="mu" id="fw"></div>
      <button class="btn primary" id="fok">${nuevo ? 'Guardar producto' : inactivo ? 'Guardar y reactivar' : 'Guardar cambios'}</button>
      ${nuevo || inactivo ? '' : '<button class="btn ghost danger" id="fof">Desactivar (ocultar del POS)</button>'}<button class="btn ghost" id="fno">Cancelar</button>`);
    const prev = () => {
      const pr = +$('#fp').value || 0, ck = +$('#fk').value || 0;
      $('#fm').textContent = pr > 0 ? 'Utilidad por pieza ' + money(pr - ck) + ' · Margen ' + ((pr - ck) / pr * 100).toFixed(0) + '%' + (ck > 0 ? ' · Precio sugerido a 40% de margen: ' + money(ck / 0.6) : '') : '';
      $('#fw').textContent = !nuevo && $('#fn').value.trim() && $('#fn').value.trim() !== x.nombre ? 'Al cambiar el nombre también se actualizará en tus ventas anteriores.' : '';
    };
    ['#fp', '#fk', '#fn'].forEach(s => $(s).oninput = prev); prev(); $('#fn').focus(); $('#fno').onclick = closeM;
    const save = async activo => {
      const o = { original: x.nombre, nombre: $('#fn').value.trim(), cat: $('#fc').value.trim() || 'Otros', precio: +$('#fp').value, costo: +$('#fk').value || 0, activo };
      if (!o.nombre) return toast('Escribe el nombre del producto.', true);
      if (!(o.precio > 0) && activo) return toast('Escribe un precio de venta mayor a cero.', true);
      if (nuevo) await api('saveProduct', { ...o, stock: $('#fs').value, min: $('#fmn').value }); else await api('updateProduct', o);
      closeM(); toast(nuevo ? 'Producto agregado' : activo ? 'Producto actualizado' : 'Producto desactivado'); load();
    };
    $('#fok').onclick = () => save(true);
    if ($('#fof')) $('#fof').onclick = () => { if (confirm('¿Desactivar "' + x.nombre + '"? Dejará de aparecer en Vender, pero conserva su historial.')) save(false); };
  }

  function bulk() {
    const cats = [...new Set(S.prods.map(p => p.cat))];
    modal(`<h2>Ajustar precios</h2><p class="mu">Cambia varios productos a la vez. Revisa la vista previa antes de aplicar.</p>
      <select id="bs" aria-label="Productos"><option value="*">Todos los productos activos</option>${cats.map(c => `<option value="${esc(c)}">Categoría: ${esc(c)}</option>`).join('')}</select>
      <select id="bw" aria-label="Qué cambiar"><option value="precio">Cambiar el precio de venta</option><option value="costo">Cambiar el costo</option></select>
      <div class="form" style="grid-template-columns:1fr 1fr"><select id="bt" aria-label="Tipo"><option value="%">Porcentaje (%)</option><option value="$">Monto fijo ($)</option></select><input id="bv" type="number" step="any" inputmode="decimal" placeholder="Ej. 5 sube, -5 baja" aria-label="Cantidad"></div>
      <select id="br" aria-label="Redondeo"><option value="0">Sin redondeo</option><option value="1">Redondear al peso</option><option value="5">Redondear a $5</option><option value="10">Redondear a $10</option></select>
      <div class="mu" id="bp" aria-live="polite"></div><button class="btn primary" id="bok" disabled>Aplicar cambios</button><button class="btn ghost" id="bno">Cancelar</button>`);
    let C = [];
    const calc = () => {
      const v = parseFloat($('#bv').value), campo = $('#bw').value, r = +$('#br').value, sc = $('#bs').value;
      C = [];
      if (isNaN(v) || v === 0) { $('#bp').textContent = 'Escribe la cantidad a cambiar.'; $('#bok').disabled = true; return; }
      S.prods.filter(p => sc === '*' || p.cat === sc).forEach(p => {
        let n = $('#bt').value === '%' ? p[campo] * (1 + v / 100) : p[campo] + v;
        n = Math.max(0, r ? Math.round(n / r) * r : Math.round(n * 100) / 100);
        if (n !== p[campo]) C.push({ nombre: p.nombre, antes: p[campo], [campo]: n });
      });
      $('#bp').innerHTML = C.length ? `Se cambiarán <b>${C.length}</b> producto(s). Ejemplo:<br>` + C.slice(0, 3).map(c => `${esc(c.nombre)}: ${money(c.antes)} → ${money(c[campo])}`).join('<br>') : 'Ningún producto cambiaría con estos valores.';
      $('#bok').disabled = !C.length;
    };
    ['#bs', '#bw', '#bt', '#bv', '#br'].forEach(s => { $(s).oninput = calc; $(s).onchange = calc; }); $('#bno').onclick = closeM;
    $('#bok').onclick = async () => {
      if (!confirm('¿Aplicar el cambio a ' + C.length + ' producto(s)?')) return;
      const n = await api('bulkPrice', C.map(({ antes, ...c }) => c)); closeM(); toast(n + ' producto(s) actualizados'); load();
    };
  }

  function csv() {
    const rows = [['Categoría', 'Producto', 'Precio', 'Costo', 'Margen %', 'Estado', 'Vendidos 30 días'], ...[...S.prods.map(p => [p, 'Activo']), ...(S.inactivos || []).map(p => [p, 'Inactivo'])].map(([p, e]) => [p.cat, p.nombre, p.precio, p.costo, mg(p).toFixed(1), e, V30[p.nombre] || 0])];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'catalogo-productos.csv'; a.click(); URL.revokeObjectURL(a.href);
  }
})();
