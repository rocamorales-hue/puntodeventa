'use strict';
/* ===== Pantalla Ventas ===== */
function tickets() {
  const m = {};
  S.ventas.forEach(v => {
    const t = m[v.folio] = m[v.folio] || { folio: v.folio, fecha: v.fecha, cliente: v.cliente, estado: v.estado, metodo: v.metodo, tipo: v.tipo, items: [], total: 0 };
    t.items.push(v); t.total += v.total;
  });
  return Object.values(m).sort((a, b) => b.fecha - a.fecha);
}
const fdate = t => new Date(t).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

(() => {
  const F = { est: 'Pendiente', q: '' };
  let TK = [];

  views.ventas = {
    render(root) {
      root.innerHTML = `<h2>Ventas</h2>
        <input id="fq" type="search" placeholder="Buscar cliente, folio o producto" aria-label="Buscar" value="${esc(F.q)}" style="margin-top:14px">
        <div class="chips">${['Pendiente', 'Pagado', 'Todos'].map(e => `<button class="chip" data-e="${e}" aria-pressed="${e === F.est}">${e}</button>`).join('')}</div>
        <div class="list" id="vl"></div>`;
      $('#fq').oninput = e => { F.q = e.target.value; list(); };
      root.onclick = e => {
        const c = e.target.closest('[data-e]'); if (c) { F.est = c.dataset.e; views.ventas.render(root); return; }
        const b = e.target.closest('[data-a]'); if (!b) return;
        const t = TK[+b.dataset.i]; ({ cobrar: () => cobrar(t), print: () => printT(t), del: () => del(t) })[b.dataset.a]();
      };
      list();
    }
  };

  function list() {
    const q = F.q.toLowerCase(); TK = tickets();
    const rows = TK.map((t, i) => [t, i]).filter(([t]) => (F.est === 'Todos' || t.estado === F.est) && (t.folio + t.cliente + t.items.map(x => x.producto).join(' ')).toLowerCase().includes(q)).slice(0, 120);
    $('#vl').innerHTML = rows.map(([t, i]) => `<div class="card">
      <div class="tl"><b>${esc(t.folio)} · ${esc(t.cliente || 'Mostrador')}</b><span class="tag ${t.estado === 'Pagado' ? 'ok' : ''}">${esc(t.estado)}</span></div>
      <div class="mu">${fdate(t.fecha)} · ${esc(t.tipo || '')}${t.metodo && t.metodo !== 'Sin registrar' ? ' · ' + esc(t.metodo) : ''}</div>
      <div class="mu" style="margin:4px 0">${t.items.map(x => x.cant + '× ' + esc(x.producto)).join(', ')}</div>
      <div class="tl"><b class="amt">${money(t.total)}</b><span>
        ${t.estado !== 'Pagado' ? `<button class="btn sm primary" data-a="cobrar" data-i="${i}">Cobrar</button> ` : ''}
        <button class="btn sm ghost" data-a="print" data-i="${i}">Imprimir</button>
        <button class="btn sm ghost danger" data-a="del" data-i="${i}">Borrar</button></span></div></div>`).join('')
      || '<p class="mu">No hay ventas con ese filtro.</p>';
  }

  function cobrar(t) {
    modal(`<h2>Cobrar ${esc(t.folio)}</h2><div class="big">${money(t.total)}</div>
      <div class="quick">${['Efectivo', 'Débito', 'Transferencia'].map(m => `<button class="btn primary" data-m="${m}">${m === 'Débito' ? 'Tarjeta' : m}</button>`).join('')}</div>
      <button class="btn ghost" id="nc">Cancelar</button>`);
    $('#nc').onclick = closeM;
    $('#mbox').onclick = async e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      await api('setPaid', t.folio, b.dataset.m); closeM(); toast('Cobrado ' + t.folio); load();
    };
  }
  async function del(t) {
    if (!confirm('¿Borrar el ticket ' + t.folio + '? Esta acción no se puede deshacer.')) return;
    await api('deleteSale', t.folio); toast('Ticket ' + t.folio + ' borrado'); load();
  }
  function printT(t) {
    const w = window.open('', '', 'width=320,height=600');
    w.document.write(`<pre style="font:13px monospace;width:260px">☕ CAFÉ SIERRA ESCONDIDA\nTicket ${esc(t.folio)}\n${fdate(t.fecha)}\nCliente: ${esc(t.cliente || '-')}\n------------------------\n` +
      t.items.map(x => `${x.cant} x ${esc(x.producto)}\n     ${money(x.cant * x.precio)}`).join('\n') +
      `\n------------------------\nTOTAL: ${money(t.total)}\nPago: ${esc(t.metodo || '')}\n¡Gracias!</pre>`);
    w.document.close(); w.print();
  }
})();
