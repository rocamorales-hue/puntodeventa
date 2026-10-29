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
      $('#cl').onclick = e => { const b = e.target.closest('[data-n]'), s = e.target.closest('[data-s]'); if (b) abono(b.dataset.n); if (s) stmt(s.dataset.s); };
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
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">${s > 0 ? `<button class="btn sm primary" data-n="${esc(n)}">Registrar abono</button>` : ''}<button class="btn sm ghost" data-s="${esc(n)}">Estado de cuenta</button></div></div>`;
    }).join('') || '<p class="mu">No hay clientes con ese nombre.</p>';
  }

  function stmt(n) {
    const T = tickets().filter(t => up(t.cliente) === n).sort((a, b) => a.fecha - b.fecha), A = (S.abonos || []).filter(a => up(a.cliente) === n).sort((a, b) => a.fecha - b.fecha);
    const pend = T.filter(t => t.estado !== 'Pagado').reduce((s, t) => s + t.total, 0), ab = A.reduce((s, a) => s + a.monto, 0);
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Estado de cuenta</title><style>body{font:14px Arial;margin:28px;color:#1f2937}table{width:100%;border-collapse:collapse;margin:10px 0 22px}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3ece3}.n{text-align:right}h1{font-size:22px;margin:0}</style></head><body>
      <h1>Estado de cuenta — ${esc(n)}</h1><p>Café Sierra Escondida · ${new Date().toLocaleDateString('es-MX')}</p>
      <h3>Ventas</h3><table><tr><th>Fecha</th><th>Folio</th><th>Concepto</th><th>Estado</th><th class=n>Total</th></tr>${T.map(t => `<tr><td>${fdate(t.fecha)}</td><td>${esc(t.folio)}</td><td>${t.items.map(x => esc(x.producto)).join(', ')}</td><td>${esc(t.estado)}</td><td class=n>${money(t.total)}</td></tr>`).join('') || '<tr><td colspan=5>Sin ventas</td></tr>'}</table>
      <h3>Abonos</h3><table><tr><th>Fecha</th><th>Método</th><th class=n>Monto</th></tr>${A.map(a => `<tr><td>${fdate(a.fecha)}</td><td>${esc(a.metodo)}</td><td class=n>${money(a.monto)}</td></tr>`).join('') || '<tr><td colspan=3>Sin abonos</td></tr>'}</table>
      <p>Pendiente: ${money(pend)} · Abonos: ${money(ab)}</p><h2>Saldo a pagar: ${money(Math.max(0, pend - ab))}</h2></body></html>`);
    w.document.close(); w.print();
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
