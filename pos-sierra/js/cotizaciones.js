'use strict';
/* ===== Pantalla Cotizaciones: filtros, vigencia, PDF profesional, WhatsApp ===== */
(() => {
  const F = { f: 'Todas', q: '' }, D = 864e5;
  const FILTROS = ['Todas', 'Vigentes', 'Convertidas', 'Vencidas', 'Canceladas'];
  const est = c => c.estado === 'Vigente' && c.vigencia < Date.now() ? 'Vencida' : c.estado;
  const fday = t => new Date(t).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  let L = [];

  views.cotizaciones = {
    render(root) {
      const todas = S.cots, vig = todas.filter(c => est(c) === 'Vigente');
      root.innerHTML = `<h2>Cotizaciones</h2>
        <div class="kpis"><div class="card kpi"><span class="mu">Vigentes</span><b>${vig.length}</b></div><div class="card kpi"><span class="mu">Importe vigente</span><b>${money(vig.reduce((s, c) => s + c.total, 0))}</b></div>
          <div class="card kpi"><span class="mu">Convertidas en venta</span><b>${todas.filter(c => c.estado === 'Convertida').length}</b></div></div>
        <input id="cq" type="search" placeholder="Buscar por folio, cliente o producto" aria-label="Buscar cotización" value="${esc(F.q)}">
        <div class="chips">${FILTROS.map(f => `<button class="chip" data-f="${f}" aria-pressed="${f === F.f}">${f}</button>`).join('')}</div>
        <div class="mu" id="cn"></div><div class="list" id="cl"></div>`;
      $('#cq').oninput = e => { F.q = e.target.value; list(); };
      root.onclick = e => {
        const f = e.target.closest('[data-f]'); if (f) { F.f = f.dataset.f; views.cotizaciones.render(root); return; }
        const b = e.target.closest('[data-a]'); if (!b) return;
        const c = L[+b.dataset.i];
        ({ load: () => Vender.load(c.items, { cli: c.cliente, cot: c.folio, desc: c.descuento, nota: c.notas }), wa: () => wa(c), print: () => Cotizacion.abrir(c), cancel: () => cancel(c) })[b.dataset.a]();
      };
      list();
    }
  };

  function list() {
    const q = F.q.toLowerCase(), map = { Vigentes: 'Vigente', Convertidas: 'Convertida', Vencidas: 'Vencida', Canceladas: 'Cancelada' };
    L = [...S.cots].reverse().filter(c => (F.f === 'Todas' || est(c) === map[F.f]) && (c.folio + ' ' + c.cliente + ' ' + c.items.map(x => x.nombre || x.producto).join(' ')).toLowerCase().includes(q));
    $('#cn').textContent = L.length + ' cotización(es)';
    $('#cl').innerHTML = L.map((c, i) => {
      const e = est(c), d = Math.ceil((c.vigencia - Date.now()) / D);
      return `<div class="card"><div class="tl"><b>${esc(c.folio)} · ${esc(c.cliente)}</b><span class="tag ${e === 'Convertida' ? 'ok' : e === 'Vigente' ? '' : 'x'}">${e}</span></div>
        <div class="mu">${fdate(c.fecha)} · ${e === 'Vigente' ? (d <= 0 ? 'vence hoy' : 'vence en ' + d + ' día(s)') : 'vigencia ' + fday(c.vigencia)}</div>
        <div class="mu" style="margin:4px 0">${c.items.map(x => x.cant + '× ' + esc(x.nombre || x.producto)).join(', ')}</div>
        <div class="tl"><b class="amt">${money(c.total)}</b><span>
          ${e === 'Convertida' || e === 'Cancelada' ? '' : `<button class="btn sm primary" data-a="load" data-i="${i}">Cargar al ticket</button>`}
          <button class="btn sm ghost" data-a="print" data-i="${i}">PDF</button>
          <button class="btn sm ghost" data-a="wa" data-i="${i}">WhatsApp</button>
          ${e === 'Convertida' || e === 'Cancelada' ? '' : `<button class="btn sm ghost danger" data-a="cancel" data-i="${i}" aria-label="Cancelar cotización">✕</button>`}</span></div></div>`;
    }).join('') || '<p class="mu">No hay cotizaciones con estos filtros. Guarda una desde la pantalla Vender.</p>';
  }

  function wa(c) {
    const k = S.config || {}, t = Cotizacion.calc(c, k), cl = (S.clients || []).find(z => String(z.nombre).toUpperCase() === String(c.cliente).toUpperCase()), tel = String(c.tel || (cl && cl.tel) || '').replace(/\D/g, '');
    const msg = `*Cotización ${c.folio}*\n${k.nombre || 'Café Sierra Escondida'}\nCliente: ${c.cliente}\n\n` + c.items.map(x => `• ${x.cant} x ${x.nombre || x.producto} — ${money(x.cant * x.precio)}`).join('\n') +
      (t.desc > 0 ? `\nDescuento: -${money(t.desc)}` : '') + (t.modo === 'sumar' ? `\nIVA ${t.tasa}%: ${money(t.iva)}` : '') + `\n\n*Total: ${money(t.total)}*${t.modo === 'incluido' ? ' (IVA incluido)' : ''}\nVigencia: hasta el ${fday(c.vigencia)}` + (k.condPago ? `\nForma de pago: ${k.condPago}` : '') + '\n\nQuedamos a sus órdenes.';
    window.open('https://wa.me/' + (tel.length === 10 ? '52' + tel : tel) + '?text=' + encodeURIComponent(msg));
  }
  async function cancel(c) {
    if (!confirm('¿Cancelar la cotización ' + c.folio + '?')) return;
    await api('setQuote', c.folio, 'Cancelada'); toast('Cotización cancelada'); load();
  }
})();
