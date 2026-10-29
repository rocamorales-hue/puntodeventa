'use strict';
/* ===== Pantalla Inventario: existencias, mínimos y entradas ===== */
(() => {
  const F = { f: 'Todos', q: '' };
  const st = p => p.stock == null ? 'Sin control' : p.stock <= 0 ? 'Agotado' : p.stock <= p.min ? 'Bajo' : 'Disponible';
  let L = [];

  views.inventario = {
    render(root) {
      const c = S.prods.filter(p => p.stock != null), bajo = c.filter(p => p.stock > 0 && p.stock <= p.min).length, ago = c.filter(p => p.stock <= 0).length;
      root.innerHTML = `<h2>Inventario</h2>
        <div class="kpis"><div class="card kpi"><span class="mu">Productos con control</span><b>${c.length}</b></div><div class="card kpi"><span class="mu">Con existencia baja</span><b>${bajo}</b></div><div class="card kpi"><span class="mu">Agotados</span><b>${ago}</b></div><div class="card kpi"><span class="mu">Valor del inventario (a costo)</span><b>${money(c.reduce((s, p) => s + Math.max(0, p.stock) * p.costo, 0))}</b></div></div>
        <input id="iq" type="search" placeholder="Buscar producto" aria-label="Buscar producto" value="${esc(F.q)}">
        <div class="chips">${['Todos', 'Bajo', 'Agotado', 'Sin control'].map(f => `<button class="chip" data-f="${f}" aria-pressed="${f === F.f}">${f}</button>`).join('')}</div>
        <div class="list" id="il"></div>`;
      $('#iq').oninput = e => { F.q = e.target.value; list(); };
      root.onclick = e => {
        const f = e.target.closest('[data-f]'); if (f) { F.f = f.dataset.f; views.inventario.render(root); return; }
        const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a, L[+b.dataset.i]);
      };
      list();
    }
  };

  function list() {
    L = S.prods.filter(p => (p.nombre + p.cat).toLowerCase().includes(F.q.toLowerCase()) && (F.f === 'Todos' || st(p) === F.f)).slice(0, 150);
    $('#il').innerHTML = L.map((p, i) => `<div class="card"><div class="tl"><b>${esc(p.nombre)}</b><span class="tag ${st(p) === 'Disponible' ? 'ok' : ''}">${st(p)}</span></div>
      <div class="mu">${esc(p.cat)}${p.stock == null ? '' : ' · Mínimo ' + p.min}</div>
      <div class="tl" style="margin-top:6px"><b class="amt">${p.stock == null ? '—' : p.stock}</b><span>
        <button class="btn sm primary" data-a="entrada" data-i="${i}">Entrada</button>
        <button class="btn sm ghost" data-a="ajuste" data-i="${i}">${p.stock == null ? 'Activar control' : 'Ajustar'}</button>
        ${p.stock == null ? '' : `<button class="btn sm ghost" data-a="min" data-i="${i}">Mínimo</button>`}</span></div></div>`).join('') || '<p class="mu">No hay productos con ese filtro.</p>';
  }

  function act(a, p) {
    const T = { entrada: ['Entrada de mercancía', 'Cantidad que entra', 'Guardar entrada'], ajuste: [p.stock == null ? 'Activar control de existencia' : 'Ajustar existencia', 'Existencia real contada', 'Guardar existencia'], min: ['Existencia mínima', 'Avisar cuando queden…', 'Guardar mínimo'] }[a];
    modal(`<h2>${T[0]}</h2><p class="mu">${esc(p.nombre)}${p.stock == null ? '' : ' · hay ' + p.stock}</p>
      <input id="iv" type="number" min="0" step="any" inputmode="decimal" placeholder="${T[1]}" aria-label="${T[1]}" value="${a === 'min' ? p.min : ''}">
      ${a === 'min' ? '' : '<input id="in" placeholder="Nota (proveedor, motivo…)" aria-label="Nota">'}
      <button class="btn primary" id="iok">${T[2]}</button><button class="btn ghost" id="ino">Cancelar</button>`);
    $('#iv').focus(); $('#ino').onclick = closeM;
    $('#iok').onclick = async () => {
      const v = $('#iv').value;
      if (v === '' || +v < 0 || (a === 'entrada' && !(+v > 0))) return toast('Escribe una cantidad válida.', true);
      if (a === 'min') await api('setMinStock', p.nombre, +v); else await api('adjustStock', p.nombre, a, +v, $('#in').value);
      closeM(); toast('Inventario actualizado'); load();
    };
  }
})();
