'use strict';
/* ===== Pantalla Corte ===== */
(() => {
  const dkey = t => new Date(t - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  let day = dkey(Date.now());

  views.corte = {
    render(root) {
      const now = new Date(), mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      root.innerHTML = `<h2>Corte</h2>
        <label class="mu" for="cd">Día a revisar</label><input type="date" id="cd" value="${day}" style="max-width:200px;margin-top:4px">
        <div id="cr"></div>
        <div class="card" style="margin-top:16px"><h2 style="font-size:16px;margin-bottom:10px">Cerrar corte semanal</h2>
          <div class="form"><input type="date" id="cs" value="${dkey(mon.getTime())}" aria-label="Inicio"><input type="date" id="ce" value="${dkey(now.getTime())}" aria-label="Fin"><input id="co" placeholder="Observaciones" aria-label="Observaciones"></div>
          <button class="btn primary" id="cg" style="margin-top:10px">Guardar corte semanal</button></div>`;
      $('#cd').onchange = e => { day = e.target.value; summary(); };
      $('#cg').onclick = cerrar;
      summary();
    }
  };

  function summary() {
    const all = tickets(), T = all.filter(t => dkey(t.fecha) === day), P = T.filter(t => t.estado === 'Pagado');
    const met = {}, prod = {};
    P.forEach(t => { const m = String(t.metodo).startsWith('Multipagos') ? 'Multipagos' : t.metodo; met[m] = (met[m] || 0) + t.total; });
    T.forEach(t => t.items.forEach(x => prod[x.producto] = (prod[x.producto] || 0) + x.cant));
    const cobrado = P.reduce((s, t) => s + t.total, 0);
    const util = P.reduce((s, t) => s + t.items.reduce((a, x) => a + x.total - x.cant * x.costo, 0), 0);
    const pend = all.filter(t => t.estado !== 'Pagado').reduce((s, t) => s + t.resta, 0);
    const top = Object.entries(prod).sort((a, b) => b[1] - a[1]).slice(0, 6);
    $('#cr').innerHTML = `<div class="kpis">
      <div class="card kpi"><span class="mu">Cobrado del día</span><b>${money(cobrado)}</b></div>
      <div class="card kpi"><span class="mu">Tickets del día</span><b>${T.length}</b></div>
      <div class="card kpi"><span class="mu">Utilidad bruta cobrada</span><b>${money(util)}</b></div>
      <div class="card kpi"><span class="mu">Por cobrar (todas las fechas)</span><b>${money(pend)}</b></div></div>
      <div class="list"><div class="card"><b>Por método de pago</b>${Object.keys(met).map(k => `<div class="tl"><span>${esc(k)}</span><b>${money(met[k])}</b></div>`).join('') || '<p class="mu">No hay cobros este día.</p>'}</div>
      <div class="card"><b>Más vendidos del día</b>${top.map(([k, v]) => `<div class="tl"><span>${esc(k)}</span><b>${v}</b></div>`).join('') || '<p class="mu">No hay ventas este día.</p>'}</div></div>`;
  }

  async function cerrar() {
    const a = $('#cs').value, b = $('#ce').value;
    if (!a || !b || a > b) return toast('Elige un periodo válido: la fecha de inicio debe ser anterior al fin.', true);
    if (!confirm('¿Confirmas que revisaste la caja y quieres cerrar este periodo?')) return;
    const r = await api('closeWeeklyCut', a, b, $('#co').value);
    toast('Corte guardado: ' + money(r.total)); load();
  }
})();
