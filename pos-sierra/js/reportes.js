'use strict';
/* ===== Reportes: ventas, productos, clientes, cotizaciones y proyección ===== */
(() => {
  const dk = t => new Date(t - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const DAY = 864e5, today = () => dk(Date.now());
  const R = { tab: 'ventas', a: today().slice(0, 8) + '01', b: today() };
  const TABS = [['ventas', 'Ventas'], ['productos', 'Productos'], ['clientes', 'Clientes'], ['cotiz', 'Cotizaciones'], ['inv', 'Inventario'], ['proy', 'Proyección']];
  const metodo = m => String(m || 'Sin registrar').startsWith('Multipagos') ? 'Multipagos' : (m || 'Sin registrar');
  const nombre = c => c || 'Mostrador';
  const n0 = v => Math.round(v).toLocaleString('es-MX');
  const days = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY) + 1;

  /* --- Ayudantes de presentación --- */
  const box = (t, h) => `<div class="card"><b>${t}</b><div style="margin-top:8px">${h}</div></div>`;
  const kpi = (l, v, x) => `<div class="card kpi"><span class="mu">${l}</span><b>${v}</b>${x ? `<span class="mu">${x}</span>` : ''}</div>`;
  const bars = (rows, f = money) => { const mx = Math.max(1, ...rows.map(r => r[1])); return rows.length ? rows.map(([l, v]) => `<div class="bar"><span title="${esc(l)}">${esc(l)}</span><i style="width:${Math.max(2, v / mx * 100)}%"></i><b>${f(v)}</b></div>`).join('') : '<p class="mu">Sin datos en este periodo.</p>'; };
  const table = (head, rows) => rows.length ? `<div style="overflow-x:auto"><table class="rtable"><tr>${head.map((h, i) => `<th class="${i ? 'n' : ''}">${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'n' : ''}">${c}</td>`).join('')}</tr>`).join('')}</table></div>` : '<p class="mu">Sin datos en este periodo.</p>';
  const group = (arr, key, val) => { const m = {}; arr.forEach(x => { const k = key(x); m[k] = (m[k] || 0) + val(x); }); return Object.entries(m); };
  const desc = rows => rows.sort((x, y) => y[1] - x[1]);
  const pct = (a, b) => b ? ((a - b) / b * 100) : null;
  const delta = (a, b) => { const p = pct(a, b); return p === null ? 'Sin periodo anterior para comparar' : `<span class="${p >= 0 ? 'up' : 'dn'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}%</span> vs periodo anterior`; };
  const range = (T, a, b) => T.filter(t => { const k = dk(t.fecha); return k >= a && k <= b; });
  const lines = T => T.flatMap(t => t.items.map(x => ({ ...x, cliente: t.cliente, tipo: t.tipo })));

  views.reportes = {
    render(root) {
      root.innerHTML = `<h2>Reportes</h2>
        <div class="rfilters"><div class="chips" id="rt">${TABS.map(([k, l]) => `<button class="chip" data-t="${k}" aria-pressed="${k === R.tab}">${l}</button>`).join('')}</div>
        <div class="chips">${[['hoy', 'Hoy'], ['7', '7 días'], ['mes', 'Este mes'], ['anio', 'Este año']].map(([k, l]) => `<button class="chip" data-p="${k}">${l}</button>`).join('')}</div>
        <div class="row2"><input type="date" id="ra" value="${R.a}" aria-label="Desde"><input type="date" id="rb" value="${R.b}" aria-label="Hasta"></div></div>
        <div id="rr"></div>
        <button class="btn" id="rx" style="margin-top:14px">Exportar ventas del periodo (CSV)</button>`;
      root.onclick = e => {
        const t = e.target.closest('[data-t]'), p = e.target.closest('[data-p]');
        if (t) { R.tab = t.dataset.t; views.reportes.render(root); }
        if (p) { preset(p.dataset.p); views.reportes.render(root); }
      };
      $('#ra').onchange = e => { R.a = e.target.value; body(); };
      $('#rb').onchange = e => { R.b = e.target.value; body(); };
      $('#rx').onclick = csv;
      body();
    }
  };

  function preset(p) {
    const t = today(), d = new Date();
    R.b = t;
    R.a = p === 'hoy' ? t : p === '7' ? dk(Date.now() - 6 * DAY) : p === 'mes' ? t.slice(0, 8) + '01' : d.getFullYear() + '-01-01';
  }
  function body() {
    if (!R.a || !R.b || R.a > R.b) { $('#rr').innerHTML = '<p class="mu">Elige un periodo válido: "Desde" debe ser anterior a "Hasta".</p>'; return; }
    $('#rr').innerHTML = ({ ventas, productos, clientes, cotiz, inv, proy })[R.tab]();
  }

  /* --- Ventas --- */
  function ventas() {
    const all = tickets(), T = range(all, R.a, R.b), n = days(R.a, R.b);
    const pa = dk(new Date(R.a) - n * DAY + 6 * 36e5), pb = dk(new Date(R.a) - DAY + 6 * 36e5), P = range(all, pa, pb);
    const tot = T.reduce((s, t) => s + t.total, 0), ptot = P.reduce((s, t) => s + t.total, 0);
    const porDia = group(T, t => dk(t.fecha), t => t.total).sort((x, y) => x[0] < y[0] ? -1 : 1).slice(-31);
    const hora = group(T, t => String(new Date(t.fecha).getHours()).padStart(2, '0') + ':00', t => t.total).sort((x, y) => x[0] < y[0] ? -1 : 1);
    const DS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'], sem = DS.map((d, i) => [d, T.filter(t => new Date(t.fecha).getDay() === i).reduce((s, t) => s + t.total, 0)]);
    const cortes = (S.cortes || []).slice(-8).reverse().map(c => [new Date(c.fecha).toLocaleDateString('es-MX'), money(c.total)]);
    return `<div class="kpis">${kpi('Ventas del periodo', money(tot), delta(tot, ptot))}${kpi('Tickets', T.length, delta(T.length, P.length))}${kpi('Ticket promedio', money(T.length ? tot / T.length : 0))}${kpi('Promedio por día', money(tot / n))}</div>
      <div class="list">${box('Ventas por día', bars(porDia))}${box('Por hora del día', bars(hora))}${box('Por día de la semana', bars(sem))}
      ${box('Por método de pago', bars(desc(group(T, t => metodo(t.metodo), t => t.total))))}${box('Por tipo de servicio', bars(desc(group(T, t => t.tipo || 'Aquí', t => t.total))))}
      ${box('Historial de cortes semanales', table(['Fecha', 'Cobrado'], cortes))}
      ${box('Tickets borrados en el periodo', table(['Fecha', 'Folio', 'Cliente', 'Total'], (S.borrados || []).filter(b => dk(b.fecha) >= R.a && dk(b.fecha) <= R.b).reverse().map(b => [new Date(b.fecha).toLocaleDateString('es-MX'), esc(b.folio), esc(b.cliente || 'Mostrador'), money(b.total)])))}</div>`;
  }

  /* --- Productos --- */
  function productos() {
    const L = lines(range(tickets(), R.a, R.b)), cat = {}; S.prods.forEach(p => cat[p.nombre] = p.cat);
    const q = desc(group(L, x => x.producto, x => x.cant)), imp = desc(group(L, x => x.producto, x => x.total));
    const ut = desc(group(L, x => x.producto, x => x.total - x.cant * x.costo)), ing = Object.fromEntries(imp);
    const sold = new Set(L.map(x => x.producto)), sin = S.prods.filter(p => !sold.has(p.nombre)).map(p => esc(p.nombre));
    const margen = ut.slice(0, 10).map(([k, v]) => [esc(k), money(v), (ing[k] ? v / ing[k] * 100 : 0).toFixed(0) + '%']);
    const totI = imp.reduce((s, r) => s + r[1], 0); let acc = 0; const abc = { A: [], B: [], C: [] };
    imp.forEach(([k, v]) => { acc += v; abc[acc / totI <= .8 || !abc.A.length ? 'A' : acc / totI <= .95 ? 'B' : 'C'].push(k); });
    const cu = desc(group(L, x => cat[x.producto] || 'Otros', x => x.total - x.cant * x.costo)), ci = Object.fromEntries(group(L, x => cat[x.producto] || 'Otros', x => x.total));
    return `<div class="list">${box('Más vendidos (cantidad)', bars(q.slice(0, 10), n0))}${box('Más vendidos (importe)', bars(imp.slice(0, 10)))}
      ${box('Utilidad y margen por producto', table(['Producto', 'Utilidad', 'Margen'], margen))}
      ${box('Utilidad por categoría', table(['Categoría', 'Utilidad', 'Margen'], cu.map(([k, v]) => [esc(k), money(v), (ci[k] ? v / ci[k] * 100 : 0).toFixed(0) + '%'])))}
      ${box('Análisis ABC (por importe)', table(['Grupo', 'Productos'], [['A · 80% del ingreso', abc.A.length], ['B · siguiente 15%', abc.B.length], ['C · último 5%', abc.C.length]]))}
      ${box('Sin movimiento en el periodo (' + sin.length + ')', sin.length ? `<p class="mu">${sin.slice(0, 40).join(', ')}${sin.length > 40 ? '…' : ''}</p>` : '<p class="mu">Todos los productos tuvieron ventas.</p>')}</div>`;
  }

  /* --- Clientes --- */
  function clientes() {
    const all = tickets(), T = range(all, R.a, R.b), now = Date.now();
    const pend = all.filter(t => t.estado !== 'Pagado'), ab = (S.abonos || []).reduce((s, a) => s + a.monto, 0);
    const B = [['0-7 días', 0, 7], ['8-15 días', 8, 15], ['16-30 días', 16, 30], ['Más de 30 días', 31, 1e9]].map(([l, lo, hi]) => [l, pend.filter(t => { const d = (now - t.fecha) / DAY; return d >= lo && d < hi + 1; }).reduce((s, t) => s + t.total, 0)]);
    const mejores = desc(group(T, t => nombre(t.cliente), t => t.total)).slice(0, 10);
    const freq = {}; T.forEach(t => freq[nombre(t.cliente)] = (freq[nombre(t.cliente)] || 0) + 1);
    const last = {}, first = {}; all.forEach(t => { const c = nombre(t.cliente); last[c] = Math.max(last[c] || 0, t.fecha); first[c] = Math.min(first[c] || 1e15, t.fecha); });
    const inact = Object.entries(last).filter(([c, f]) => c !== 'Mostrador' && (now - f) / DAY > 30).sort((x, y) => x[1] - y[1]).slice(0, 12).map(([c, f]) => [esc(c), Math.floor((now - f) / DAY) + ' días']);
    const act = Object.keys(freq).filter(c => c !== 'Mostrador'), nuevos = act.filter(c => dk(first[c]) >= R.a).length;
    return `<div class="list">${box('Antigüedad de saldos' + (ab ? ' <span class="mu">(sin descontar abonos: ' + money(ab) + ')</span>' : ''), bars(B))}
      ${box('Mejores clientes (importe)', table(['Cliente', 'Compra', 'Tickets'], mejores.map(([c, v]) => [esc(c), money(v), freq[c]])))}
      ${box('Clientes nuevos vs. recurrentes', table(['Tipo', 'Clientes'], [['Nuevos en el periodo', nuevos], ['Recurrentes', act.length - nuevos]]))}
      ${box('Inactivos (más de 30 días sin comprar)', table(['Cliente', 'Sin comprar'], inact))}</div>`;
  }

  /* --- Cotizaciones --- */
  function cotiz() {
    const now = Date.now(), C = S.cots.filter(c => dk(c.fecha) >= R.a && dk(c.fecha) <= R.b);
    const est = c => c.estado === 'Vigente' && c.vigencia < now ? 'Vencida' : c.estado;
    const g = desc(group(C, est, () => 1)), conv = C.filter(c => c.estado === 'Convertida').length;
    const prox = S.cots.filter(c => c.estado === 'Vigente' && c.vigencia >= now && c.vigencia - now <= 7 * DAY).map(c => [esc(c.folio + ' · ' + c.cliente), Math.ceil((c.vigencia - now) / DAY) + ' días', money(c.total)]);
    return `<div class="kpis">${kpi('Emitidas', C.length)}${kpi('Convertidas en venta', conv)}${kpi('Conversión', (C.length ? conv / C.length * 100 : 0).toFixed(0) + '%')}${kpi('Importe cotizado', money(C.reduce((s, c) => s + c.total, 0)))}</div>
      <div class="list">${box('Embudo por estado', bars(g, n0))}${box('Por vencer en 7 días', table(['Cotización', 'Vence en', 'Total'], prox))}</div>`;
  }

  /* --- Inventario: alertas, rotación y reabasto --- */
  function inv() {
    const C = S.prods.filter(p => p.stock != null);
    if (!C.length) return '<div class="card"><b>Aún no hay productos con control de existencia.</b><p class="mu">Ve a Más > Inventario y toca "Activar control" en los productos que quieras vigilar.</p></div>';
    const L = lines(range(tickets(), dk(Date.now() - 29 * DAY), today())), vend = Object.fromEntries(group(L, x => x.producto, x => x.cant));
    const rows = C.map(p => { const d = (vend[p.nombre] || 0) / 30; return { p, d, cob: d > 0 ? p.stock / d : Infinity, sug: Math.max(0, Math.ceil(d * 15 - p.stock)) }; });
    const alerta = rows.filter(r => r.p.stock <= r.p.min).sort((a, b) => a.p.stock - b.p.stock).map(r => [esc(r.p.nombre), r.p.stock <= 0 ? 'Agotado' : r.p.stock, r.p.min]);
    const rot = rows.filter(r => r.d > 0).sort((a, b) => a.cob - b.cob).slice(0, 12).map(r => [esc(r.p.nombre), r.d.toFixed(2) + '/día', Math.floor(r.cob) + ' días']);
    const sug = rows.filter(r => r.sug > 0).sort((a, b) => b.sug - a.sug).slice(0, 15).map(r => [esc(r.p.nombre), r.p.stock, r.sug]);
    return `<p class="mu">Estos tres reportes usan las ventas de los últimos 30 días, sin importar el filtro de fechas.</p><div class="list">${box('Alertas de existencia baja o agotado', table(['Producto', 'Existencia', 'Mínimo'], alerta))}
      ${box('Rotación y días de cobertura', table(['Producto', 'Venta promedio', 'Alcanza para'], rot))}${box('Sugerencia de reabasto (cubrir 15 días)', table(['Producto', 'Hay', 'Pedir'], sug))}</div>`;
  }

  /* --- Proyección --- */
  function proy() {
    const all = tickets(), d = new Date(), ym = dk(d).slice(0, 7), dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), dd = d.getDate();
    const mes = group(all, t => dk(t.fecha).slice(0, 7), t => t.total), m = Object.fromEntries(mes), actual = m[ym] || 0;
    const prev = mes.filter(([k]) => k < ym), prom = prev.length ? prev.reduce((s, r) => s + r[1], 0) / prev.length : 0;
    const meses = []; for (let i = 11; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1), k = dk(x.getTime() + 6 * 36e5).slice(0, 7), ky = (x.getFullYear() - 1) + k.slice(4); meses.push([k, m[k] || 0, m[ky] || 0]); }
    const L = lines(range(all, dk(Date.now() - 27 * DAY), today())), sem = desc(group(L, x => x.producto, x => x.cant / 4)).slice(0, 10);
    return `<div class="kpis">${kpi('Ventas del mes en curso', money(actual), 'Día ' + dd + ' de ' + dim)}${kpi('Proyección al cierre del mes', money(actual / dd * dim), 'Al ritmo actual por día')}${kpi('Promedio mensual histórico', money(prom), prev.length + ' meses con ventas')}</div>
      <div class="list">${box('Tendencia mensual (12 meses)', table(['Mes', 'Ventas', 'Año anterior'], meses.map(([k, v, y]) => [k, money(v), y ? money(y) : '—'])))}
      ${box('Demanda estimada por semana (según las últimas 4 semanas)', bars(sem, v => v.toFixed(1)))}</div>`;
  }

  function csv() {
    const T = range(tickets(), R.a, R.b), rows = [['Folio', 'Fecha', 'Cliente', 'Estado', 'Método', 'Total'], ...T.map(t => [t.folio, new Date(t.fecha).toLocaleString('es-MX'), t.cliente, t.estado, t.metodo, t.total])];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'ventas-' + R.a + '_' + R.b + '.csv'; a.click(); URL.revokeObjectURL(a.href);
  }
})();
