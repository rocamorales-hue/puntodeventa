'use strict';
/* ===== Pantalla Clientes: resumen, filtros, ficha con historial, abonos y cobranza ===== */
(() => {
  const D = 864e5, F = { f: 'Todos', s: 'Nombre', q: '' };
  const FILTROS = ['Todos', 'Con saldo', 'Sin saldo', 'Activos', 'Inactivos'];
  const SORTS = ['Nombre', 'Mayor saldo', 'Compró más recientemente', 'Mayor compra total'];
  const up = s => String(s || '').trim().toUpperCase();
  const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 40% 38%)`; };
  const days = t => t ? Math.floor((Date.now() - t) / D) : null;
  const ago = t => { const d = days(t); return d === null ? 'Sin compras' : d === 0 ? 'Compró hoy' : d === 1 ? 'Compró ayer' : 'Compró hace ' + d + ' días'; };
  let ST = {}, L = [];

  function stats() {
    const m = {}, get = n => m[n] || (m[n] = { n, tel: '', email: '', tk: 0, compras: 0, last: 0, pend: 0, ab: 0, saldo: 0 });
    S.clients.forEach(c => { const o = get(up(c.nombre)); o.tel = c.tel || ''; o.email = c.email || ''; });
    tickets().forEach(t => { const k = up(t.cliente); if (!k) return; const o = get(k); o.tk++; o.compras += t.total; o.last = Math.max(o.last, t.fecha); if (t.estado !== 'Pagado') o.pend += t.total; });
    (S.abonos || []).forEach(a => { const k = up(a.cliente); if (k) get(k).ab += a.monto; });
    Object.values(m).forEach(o => o.saldo = Math.round((o.pend - o.ab) * 100) / 100);
    return m;
  }
  const wa = (o, msg) => { const d = String(o.tel).replace(/\D/g, ''); window.open('https://wa.me/' + (d.length === 10 ? '52' + d : d) + '?text=' + encodeURIComponent(msg)); };

  views.clientes = {
    render(root) {
      ST = stats();
      const A = Object.values(ST), con = A.filter(o => o.saldo > 0), act = A.filter(o => o.last && days(o.last) <= 30);
      root.innerHTML = `<div class="pagehead"><h2>Clientes</h2><button class="btn primary" data-a="new">＋ Nuevo cliente</button></div>
        <div class="kpis"><div class="card kpi"><span class="mu">Clientes</span><b>${A.length}</b></div>
          <div class="card kpi"><span class="mu">Con saldo pendiente</span><b>${con.length}</b></div>
          <div class="card kpi"><span class="mu">Por cobrar</span><b>${money(con.reduce((s, o) => s + o.saldo, 0))}</b></div>
          <div class="card kpi"><span class="mu">Activos (últimos 30 días)</span><b>${act.length}</b></div></div>
        <div class="toolbar"><input id="cq" type="search" placeholder="Buscar por nombre o teléfono" aria-label="Buscar cliente" value="${esc(F.q)}">
          <select id="cs" aria-label="Ordenar por">${SORTS.map(s => `<option ${s === F.s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="chips">${FILTROS.map(f => `<button class="chip" data-f="${f}" aria-pressed="${f === F.f}">${f}</button>`).join('')}</div>
        <div class="mu" id="cn"></div><div class="list" id="cl"></div>`;
      $('#cq').oninput = e => { F.q = e.target.value; list(); };
      $('#cs').onchange = e => { F.s = e.target.value; list(); };
      root.onclick = e => {
        const f = e.target.closest('[data-f]'); if (f) { F.f = f.dataset.f; views.clientes.render(root); return; }
        const a = e.target.closest('[data-a]'), n = e.target.closest('[data-n]');
        if (a && a.dataset.a === 'new') return nuevo();
        if (a && n) return ({ abono: () => abono(n.dataset.n), stmt: () => stmt(n.dataset.n), wa: () => cobrar(n.dataset.n) })[a.dataset.a]();
        if (n) detalle(n.dataset.n);
      };
      list();
    }
  };

  function list() {
    const q = F.q.toLowerCase();
    L = Object.values(ST).filter(o => (o.n + ' ' + o.tel).toLowerCase().includes(q) && ({
      'Todos': true, 'Con saldo': o.saldo > 0, 'Sin saldo': o.saldo <= 0,
      'Activos': o.last && days(o.last) <= 30, 'Inactivos': !o.last || days(o.last) > 30 })[F.f]);
    L.sort(({ 'Nombre': (a, b) => a.n.localeCompare(b.n), 'Mayor saldo': (a, b) => b.saldo - a.saldo, 'Compró más recientemente': (a, b) => b.last - a.last, 'Mayor compra total': (a, b) => b.compras - a.compras })[F.s]);
    $('#cn').textContent = L.length + ' cliente(s)';
    $('#cl').innerHTML = L.slice(0, 150).map(o => `<div class="card cli" data-n="${esc(o.n)}">
      <div class="chead"><div class="cav" style="background:${hue(o.n)}">${esc(o.n[0] || '?')}</div>
        <div style="flex:1;min-width:0"><b>${esc(o.n)}</b><div class="mu">${esc(o.tel) || 'Sin teléfono'}</div></div>
        <span class="tag ${o.saldo > 0 ? '' : 'ok'}">${o.saldo > 0 ? 'Debe ' + money(o.saldo) : 'Sin saldo'}</span></div>
      <div class="mu" style="margin:10px 0">${ago(o.last)} · ${o.tk} compra(s) · ${money(o.compras)} en total</div>
      <div class="cact">${o.saldo > 0 ? `<button class="btn sm primary" data-a="abono" data-n="${esc(o.n)}">Abonar</button>` : ''}
        ${o.saldo > 0 && o.tel ? `<button class="btn sm ghost" data-a="wa" data-n="${esc(o.n)}">Recordar saldo</button>` : ''}
        <button class="btn sm ghost" data-a="stmt" data-n="${esc(o.n)}">Estado de cuenta</button></div></div>`).join('')
      || '<p class="mu">No hay clientes con estos filtros.</p>';
  }

  function nuevo() {
    modal(`<h2>Nuevo cliente</h2><input id="nn" placeholder="Nombre *" aria-label="Nombre"><input id="nt" placeholder="Teléfono (10 dígitos)" inputmode="tel" aria-label="Teléfono"><input id="ne" placeholder="Correo (opcional)" aria-label="Correo">
      <button class="btn primary" id="nok">Guardar cliente</button><button class="btn ghost" id="nno">Cancelar</button>`);
    $('#nn').focus(); $('#nno').onclick = closeM;
    $('#nok').onclick = async () => {
      const n = up($('#nn').value);
      if (!n) return toast('Escribe el nombre del cliente.', true);
      if (ST[n] && S.clients.some(c => up(c.nombre) === n)) return toast('Ya existe un cliente con ese nombre.', true);
      await api('saveClient', { nombre: n, tel: $('#nt').value, email: $('#ne').value });
      closeM(); toast('Cliente agregado'); load();
    };
  }

  function detalle(n) {
    const o = ST[n]; if (!o) return;
    const T = tickets().filter(t => up(t.cliente) === n).slice(0, 8), A = (S.abonos || []).filter(a => up(a.cliente) === n).sort((a, b) => b.fecha - a.fecha).slice(0, 5);
    modal(`<div class="chead"><div class="cav" style="background:${hue(n)}">${esc(n[0])}</div><div style="flex:1"><h2>${esc(n)}</h2><div class="mu">${esc(o.tel) || 'Sin teléfono'}${o.email ? ' · ' + esc(o.email) : ''}</div></div><button class="btn sm ghost" id="dx" aria-label="Cerrar">✕</button></div>
      <div class="kpis" style="margin:0;grid-template-columns:1fr 1fr"><div class="card kpi"><span class="mu">Saldo</span><b>${money(Math.max(0, o.saldo))}</b></div><div class="card kpi"><span class="mu">Compras totales</span><b>${money(o.compras)}</b></div></div>
      <b>Últimas compras</b>${T.map(t => `<div class="tl mu"><span>${fdate(t.fecha)} · ${esc(t.folio)} · ${esc(t.estado)}</span><b>${money(t.total)}</b></div>`).join('') || '<p class="mu">Sin compras registradas.</p>'}
      ${A.length ? `<b>Últimos abonos</b>${A.map(a => `<div class="tl mu"><span>${fdate(a.fecha)} · ${esc(a.metodo)}</span><b>${money(a.monto)}</b></div>`).join('')}` : ''}
      <div class="cact">${o.saldo > 0 ? '<button class="btn primary" id="da">Registrar abono</button>' : ''}<button class="btn" id="ds">Estado de cuenta</button></div>`);
    $('#dx').onclick = closeM; $('#ds').onclick = () => stmt(n); if ($('#da')) $('#da').onclick = () => abono(n);
  }

  function cobrar(n) {
    const o = ST[n]; wa(o, `Hola ${n}, te recordamos que tienes un saldo pendiente de ${money(o.saldo)} en Café Sierra Escondida. ¡Gracias!`);
  }

  function abono(n) {
    const s = ST[n] ? ST[n].saldo : 0;
    modal(`<h2>Abono de ${esc(n)}</h2><p class="mu">Saldo actual: <b>${money(s)}</b></p>
      <input id="am" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Monto del abono" aria-label="Monto del abono" value="${s > 0 ? s.toFixed(2) : ''}">
      <select id="ap" aria-label="Método"><option>Efectivo</option><option value="Débito">Tarjeta</option><option>Transferencia</option></select>
      <button class="btn primary" id="aok">Guardar abono</button><button class="btn ghost" id="ano">Cancelar</button>`);
    $('#am').focus(); $('#ano').onclick = closeM;
    $('#aok').onclick = async () => {
      const m = +$('#am').value;
      if (!(m > 0)) return toast('El abono debe ser mayor a cero.', true);
      await api('addPayment', n, '', m, $('#ap').value, '', ''); closeM(); toast('Abono guardado'); load();
    };
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
})();
