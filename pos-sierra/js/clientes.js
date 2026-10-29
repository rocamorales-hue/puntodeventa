'use strict';
/* ===== Pantalla Clientes: alta, saldo y abonos ===== */
(() => {
  let q = '';
  const up = s => String(s || '').trim().toUpperCase();

  function saldos() {
    const d = {};
    tickets().filter(t => t.estado !== 'Pagado').forEach(t => { const k = up(t.cliente); if (k) d[k] = (d[k] || 0) + t.total; });
    (S.abonos || []).forEach(a => { const k = up(a.cliente); if (k) d[k] = (d[k] || 0) - a.monto; });
    return d;
  }

  views.clientes = {
    render(root) {
      root.innerHTML = `<h2>Clientes</h2>
        <div class="card" style="margin:14px 0"><div class="form">
          <input id="cn" placeholder="Nombre" aria-label="Nombre"><input id="ct" placeholder="Teléfono" inputmode="tel" aria-label="Teléfono"><input id="ce" placeholder="Correo" aria-label="Correo">
          <button class="btn primary" id="add">Agregar cliente</button></div></div>
        <input id="cq" type="search" placeholder="Buscar cliente" aria-label="Buscar cliente" value="${esc(q)}">
        <div class="list" id="cl"></div>`;
      $('#add').onclick = add;
      $('#cq').oninput = e => { q = e.target.value; list(); };
      $('#cl').onclick = e => { const b = e.target.closest('[data-n]'); if (b) abono(b.dataset.n); };
      list();
    }
  };

  function list() {
    const d = saldos(), tel = {};
    S.clients.forEach(c => tel[up(c.nombre)] = c.tel);
    const names = [...new Set([...S.clients.map(c => up(c.nombre)), ...Object.keys(d)])].filter(n => n && n.toLowerCase().includes(q.toLowerCase())).sort();
    $('#cl').innerHTML = names.map(n => {
      const s = Math.round((d[n] || 0) * 100) / 100;
      return `<div class="card"><div class="tl"><b>${esc(n)}</b><span class="tag ${s > 0 ? '' : 'ok'}">${s > 0 ? 'Debe ' + money(s) : 'Sin saldo'}</span></div>
        <div class="mu">${esc(tel[n]) || 'Sin teléfono'}</div>
        ${s > 0 ? `<button class="btn sm primary" style="margin-top:10px" data-n="${esc(n)}">Registrar abono</button>` : ''}</div>`;
    }).join('') || '<p class="mu">No hay clientes con ese nombre.</p>';
  }

  async function add() {
    const n = $('#cn').value.trim();
    if (!n) return toast('Escribe el nombre del cliente.', true);
    await api('saveClient', { nombre: n.toUpperCase(), tel: $('#ct').value, email: $('#ce').value });
    toast('Cliente agregado'); load();
  }

  function abono(n) {
    const s = saldos()[n] || 0;
    modal(`<h2>Abono de ${esc(n)}</h2><p class="mu">Saldo actual: <b>${money(s)}</b></p>
      <input id="am" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Monto del abono" aria-label="Monto del abono" value="${s > 0 ? s.toFixed(2) : ''}">
      <select id="ap" aria-label="Método"><option>Efectivo</option><option value="Débito">Tarjeta</option><option>Transferencia</option></select>
      <button class="btn primary" id="aok">Guardar abono</button><button class="btn ghost" id="ano">Cancelar</button>`);
    $('#ano').onclick = closeM;
    $('#aok').onclick = async () => {
      const m = +$('#am').value;
      if (!(m > 0)) return toast('El abono debe ser mayor a cero.', true);
      await api('addPayment', n, '', m, $('#ap').value, '', ''); closeM(); toast('Abono guardado'); load();
    };
  }
})();
