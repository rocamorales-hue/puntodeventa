'use strict';
/* ===== Reporte ejecutivo: resumen de un periodo, listo para "Guardar como PDF" ===== */
const Ejecutivo = (() => {
  const D = 864e5, dk = t => new Date(t - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const at = s => new Date(s + 'T12:00:00');
  const long = s => at(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const m0 = n => '$' + Math.round(n).toLocaleString('es-MX');
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const inR = (t, a, b) => { const k = dk(t.fecha); return k >= a && k <= b; };
  const nDays = (a, b) => Math.round((at(b) - at(a)) / D) + 1;
  const metodo = m => String(m || 'Sin registrar').startsWith('Multipagos') ? 'Multipagos' : (m || 'Sin registrar');
  const group = (arr, key, val) => { const m = {}; arr.forEach(x => { const k = key(x); m[k] = (m[k] || 0) + val(x); }); return Object.entries(m).sort((x, y) => y[1] - x[1]); };
  const lines = T => T.flatMap(t => t.items);
  const delta = (a, b) => b ? (() => { const p = (a - b) / b * 100; return `<span class="${p >= 0 ? 'up' : 'dn'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}%</span> vs. periodo anterior`; })() : 'Sin periodo anterior para comparar';

  const hbars = (rows, fmt = m0) => { const mx = Math.max(1, ...rows.map(r => r[1])); return rows.length ? rows.map(([l, v]) => `<div class="hb"><span>${esc(l)}</span><div class="tr"><i style="width:${Math.max(2, v / mx * 100)}%"></i></div><b>${fmt(v)}</b></div>`).join('') : '<p class="mu">Sin datos.</p>'; };

  /* Gráfica de barras: por día (hasta 35 días), por semana (hasta 120) o por mes */
  function chart(T, a, b) {
    if (!T.length) return '<p class="mu">Sin ventas en el periodo.</p>';
    const nd = nDays(a, b), mode = nd <= 35 ? 'd' : nd <= 120 ? 'w' : 'm';
    const key = t => { const k = dk(t.fecha); if (mode === 'd') return k; if (mode === 'm') return k.slice(0, 7); const d = new Date(t.fecha); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dk(d.getTime()); };
    const g = Object.fromEntries(group(T, key, t => t.total));
    let keys = Object.keys(g).sort();
    if (mode === 'd') { keys = []; for (let d = at(a); dk(d.getTime()) <= b; d = new Date(d.getTime() + D)) keys.push(dk(d.getTime())); }
    if (!keys.length) return '<p class="mu">Sin ventas en el periodo.</p>';
    const lab = k => mode === 'm' ? at(k + '-15').toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }) : +k.slice(8) + '/' + +k.slice(5, 7);
    const W = 700, H = 150, L = 46, n = keys.length, step = (W - L) / n, bw = Math.max(2, step - Math.min(4, step * .25)), mx = Math.max(1, ...keys.map(k => g[k] || 0)), every = Math.ceil(n / 14);
    return `<svg viewBox="0 0 ${W} ${H + 22}" width="100%" role="img" aria-label="Ventas en el tiempo"><text x="0" y="10" font-size="9" fill="#667068">${m0(mx)}</text><line x1="${L}" y1="${H}" x2="${W}" y2="${H}" stroke="#d9dbd2"/>
      ${keys.map((k, i) => { const v = g[k] || 0, h = v / mx * (H - 18); return `<rect x="${L + i * step}" y="${H - h}" width="${bw}" height="${h}" rx="1.5" fill="#a35d17"/>${i % every === 0 ? `<text x="${L + i * step + bw / 2}" y="${H + 12}" font-size="8.5" text-anchor="middle" fill="#667068">${lab(k)}</text>` : ''}`; }).join('')}</svg>
      <div class="mu">Ventas por ${mode === 'd' ? 'día' : mode === 'w' ? 'semana (inicia lunes)' : 'mes'}</div>`;
  }

  function build(a, b) {
    const all = tickets(), T = all.filter(t => inR(t, a, b)), n = nDays(a, b);
    const pa = dk(at(a) - n * D), pb = dk(at(a) - D), P = all.filter(t => inR(t, pa, pb));
    const L = lines(T), cat = {}; [...S.prods, ...(S.inactivos || [])].forEach(p => cat[p.nombre] = p.cat);
    const ventas = sum(T, t => t.total), util = sum(L, x => x.total - x.cant * x.costo), margen = ventas ? util / ventas * 100 : 0;
    const pv = sum(P, t => t.total), pu = sum(lines(P), x => x.total - x.cant * x.costo);
    const cobrado = sum(T.filter(t => t.estado === 'Pagado'), t => t.total), desc = sum(T, t => t.desc || 0);
    const pend = all.filter(t => t.estado !== 'Pagado'), cartera = sum(pend, t => t.resta), now = Date.now();
    const abonos = sum((S.abonos || []).filter(x => { const k = dk(x.fecha); return k >= a && k <= b; }), x => x.monto);
    const edad = [['0-7 días', 0, 7], ['8-15 días', 8, 15], ['16-30 días', 16, 30], ['Más de 30 días', 31, 1e9]].map(([l, lo, hi]) => [l, sum(pend.filter(t => { const d = (now - t.fecha) / D; return d >= lo && d < hi + 1; }), t => t.resta)]);
    const prod = group(L, x => x.producto, x => x.total), pCant = Object.fromEntries(group(L, x => x.producto, x => x.cant)), pUtil = Object.fromEntries(group(L, x => x.producto, x => x.total - x.cant * x.costo));
    const porCat = group(L, x => cat[x.producto] || 'Otros', x => x.total), cUtil = Object.fromEntries(group(L, x => cat[x.producto] || 'Otros', x => x.total - x.cant * x.costo));
    const porMet = group(T.filter(t => t.estado === 'Pagado'), t => metodo(t.metodo), t => t.total);
    const cli = group(T.filter(t => t.cliente), t => t.cliente, t => t.total).slice(0, 5), deudores = group(pend.filter(t => t.cliente), t => t.cliente, t => t.resta).filter(r => r[1] > 0).slice(0, 5);
    const C = S.cots.filter(c => dk(c.fecha) >= a && dk(c.fecha) <= b), conv = C.filter(c => c.estado === 'Convertida').length;
    const vig = S.cots.filter(c => c.estado === 'Vigente' && c.vigencia >= now && c.vigencia - now <= 7 * D).length;
    const INV = S.prods.filter(p => p.stock != null), bajo = INV.filter(p => p.stock > 0 && p.stock <= p.min), ago = INV.filter(p => p.stock <= 0);
    const sinCosto = new Set(L.filter(x => !(x.costo > 0)).map(x => x.producto)).size;

    /* Puntos clave generados con los datos */
    const DS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], ins = [];
    const dia = group(T, t => dk(t.fecha), t => t.total)[0], dsem = group(T, t => new Date(t.fecha).getDay(), t => t.total)[0], hr = group(T, t => new Date(t.fecha).getHours(), t => t.total)[0];
    if (T.length) {
      ins.push(`Las ventas del periodo suman <b>${m0(ventas)}</b> en ${T.length} tickets, con una utilidad bruta de <b>${m0(util)}</b> (${margen.toFixed(0)}% de margen).`);
      if (pv) ins.push(`Frente al periodo anterior, las ventas ${ventas >= pv ? 'subieron' : 'bajaron'} <b>${Math.abs((ventas - pv) / pv * 100).toFixed(0)}%</b> (${m0(pv)} antes).`);
      if (dia) ins.push(`El mejor día fue el <b>${long(dia[0])}</b> con ${m0(dia[1])}. Se vende más los <b>${DS[+dsem[0]]}</b> y la hora más fuerte es alrededor de las <b>${String(hr[0]).padStart(2, '0')}:00</b>.`);
      if (prod[0]) ins.push(`Producto estrella: <b>${esc(prod[0][0])}</b>, con ${m0(prod[0][1])} (${(prod[0][1] / ventas * 100).toFixed(0)}% de la venta).`);
      let acc = 0, na = 0; for (const [, v] of prod) { na++; acc += v; if (acc / ventas >= .8) break; }
      ins.push(`<b>${na}</b> de ${prod.length} productos vendidos concentran el 80% de los ingresos.`);
      const bm = prod.slice(0, 8).filter(([k, v]) => v > 0 && pUtil[k] / v < .25 && pUtil[k] / v >= 0 && (L.find(x => x.producto === k) || {}).costo > 0)[0];
      if (bm) ins.push(`Atención: <b>${esc(bm[0])}</b> vende ${m0(bm[1])} con un margen de solo ${(pUtil[bm[0]] / bm[1] * 100).toFixed(0)}%.`);
    } else ins.push('No hay ventas registradas en este periodo.');
    if (cartera > 0) ins.push(`La cartera por cobrar es de <b>${m0(cartera)}</b>${edad[3][1] > 0 ? `; ${(edad[3][1] / cartera * 100).toFixed(0)}% tiene más de 30 días` : ''}.`);
    if (sinCosto) ins.push(`${sinCosto} producto(s) vendidos no tienen costo capturado, por lo que la utilidad real podría ser menor.`);
    if (bajo.length + ago.length) ins.push(`Inventario: ${ago.length} agotado(s) y ${bajo.length} por debajo del mínimo.`);

    const k = (l, v, x) => `<div class="k"><small>${l}</small><b>${v}</b>${x ? `<small>${x}</small>` : ''}</div>`;
    const tbl = (h, rows) => rows.length ? `<table><tr>${h.map((x, i) => `<th class="${i ? 'n' : ''}">${x}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'n' : ''}">${c}</td>`).join('')}</tr>`).join('')}</table>` : '<p class="mu">Sin datos.</p>';
    const nombre = esc((S.config && S.config.nombre) || 'Café Sierra Escondida');

    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Reporte ejecutivo ${a} a ${b}</title><style>
@page{size:letter;margin:13mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:11.5px/1.45 Arial,Helvetica,sans-serif;color:#1c2620;margin:0 auto;max-width:800px;padding:14px}
.bar{background:#fbf4e4;border:1px solid #f1e2c3;border-radius:8px;padding:10px 12px;margin-bottom:12px;display:flex;gap:12px;align-items:center;justify-content:space-between}
.bar button{background:#a35d17;color:#fff;border:0;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #a35d17;padding-bottom:8px}
h1{font-size:22px;margin:0;color:#1f3028}.sub{color:#667068}.mu{color:#667068;font-size:10.5px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.k{border:1px solid #e1e2da;border-radius:8px;padding:8px 10px}.k small{color:#667068;display:block;font-size:10px}.k b{font-size:18px;display:block}
h2{font-size:12.5px;margin:15px 0 6px;color:#1f3028;border-bottom:1px solid #e1e2da;padding-bottom:3px;text-transform:uppercase;letter-spacing:.05em}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}.sec{break-inside:avoid}
table{width:100%;border-collapse:collapse}th{text-align:left;color:#667068;font-size:9.5px;text-transform:uppercase}td,th{padding:4px 5px;border-bottom:1px solid #eee}.n{text-align:right}
.hb{display:grid;grid-template-columns:105px 1fr 62px;gap:6px;align-items:center;margin:3px 0}.hb span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hb b{text-align:right}.tr{background:#eef1ec;border-radius:4px;height:8px}.tr i{display:block;height:8px;border-radius:4px;background:#a35d17}
.up{color:#2f8056;font-weight:700}.dn{color:#b9473d;font-weight:700}ul{margin:4px 0 0 16px;padding:0}li{margin:3px 0}
.foot{margin-top:16px;color:#8a938c;font-size:9.5px;border-top:1px solid #e1e2da;padding-top:6px}
@media print{.bar{display:none}body{padding:0;max-width:none}}
</style></head><body>
<div class="bar"><span>Para guardar el PDF, en el cuadro de impresión elige <b>«Guardar como PDF»</b> como destino.</span><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
<header><div><h1>Reporte ejecutivo</h1><div class="sub">${nombre}</div></div><div style="text-align:right"><b>${long(a)} al ${long(b)}</b><div class="sub">${n} día(s) · generado el ${new Date().toLocaleDateString('es-MX')}</div></div></header>
<div class="kpis">${k('Ventas', m0(ventas), delta(ventas, pv))}${k('Utilidad bruta', m0(util), margen.toFixed(0) + '% de margen · ' + delta(util, pu))}${k('Tickets', T.length, 'Ticket promedio ' + m0(T.length ? ventas / T.length : 0))}${k('Descuentos otorgados', m0(desc), ventas + desc ? (desc / (ventas + desc) * 100).toFixed(1) + '% sobre venta bruta' : '')}
${k('Cobrado del periodo', m0(cobrado), ventas ? (cobrado / ventas * 100).toFixed(0) + '% de lo vendido' : '')}${k('Abonos recibidos', m0(abonos), 'Pagos a cuentas de clientes')}${k('Cartera por cobrar', m0(cartera), pend.length + ' ticket(s) pendientes en total')}${k('Productos vendidos', prod.length, 'de ' + S.prods.length + ' activos')}</div>
<div class="sec"><h2>Puntos clave</h2><ul>${ins.map(x => `<li>${x}</li>`).join('')}</ul></div>
<div class="sec"><h2>Ventas en el tiempo</h2>${chart(T, a, b)}</div>
<div class="cols sec"><div><h2>Cobrado por método de pago</h2>${hbars(porMet)}</div><div><h2>Ventas por categoría</h2>${hbars(porCat.slice(0, 7))}</div></div>
<div class="sec"><h2>Productos principales</h2>${tbl(['Producto', 'Cant.', 'Venta', 'Utilidad', 'Margen'], prod.slice(0, 10).map(([p, v]) => [esc(p), +(+pCant[p]).toFixed(2), m0(v), m0(pUtil[p]), v ? (pUtil[p] / v * 100).toFixed(0) + '%' : '—']))}</div>
<div class="cols sec"><div><h2>Mejores clientes</h2>${tbl(['Cliente', 'Compras'], cli.map(([c, v]) => [esc(c), m0(v)]))}</div>
<div><h2>Cartera por antigüedad</h2>${hbars(edad)}${deudores.length ? `<div class="mu" style="margin-top:6px">Mayores saldos: ${deudores.map(([c, v]) => esc(c) + ' ' + m0(v)).join(' · ')}</div>` : ''}</div></div>
<div class="cols sec"><div><h2>Cotizaciones</h2>${tbl(['Concepto', ''], [['Emitidas en el periodo', C.length], ['Convertidas en venta', conv], ['Tasa de conversión', C.length ? (conv / C.length * 100).toFixed(0) + '%' : '—'], ['Importe cotizado', m0(sum(C, c => c.total))], ['Vigentes que vencen en 7 días', vig]])}</div>
<div><h2>Inventario</h2>${INV.length ? tbl(['Concepto', ''], [['Productos con control', INV.length], ['Valor a costo', m0(sum(INV, p => Math.max(0, p.stock) * p.costo))], ['Agotados', ago.length], ['Bajo el mínimo', bajo.length]]) + ((ago.length + bajo.length) ? `<div class="mu" style="margin-top:6px">Reponer: ${[...ago, ...bajo].slice(0, 8).map(p => esc(p.nombre)).join(', ')}</div>` : '') : '<p class="mu">Aún no hay productos con control de existencia.</p>'}</div></div>
<div class="foot">Notas: ventas = tickets del periodo con descuentos aplicados. Utilidad bruta = venta menos costo capturado de cada producto. Cobrado = tickets pagados del periodo. Cartera = saldo pendiente de todos los periodos, descontando abonos. Cifras redondeadas a pesos.</div>
</body></html>`;
  }

  function abrir(a, b) {
    if (!a || !b || a > b) return toast('Elige un periodo válido: "Desde" debe ser anterior a "Hasta".', true);
    const w = window.open('', '_blank');
    if (!w) return toast('El navegador bloqueó la ventana. Permite las ventanas emergentes de esta página e inténtalo de nuevo.', true);
    w.document.write(build(a, b)); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 700);
  }
  return { abrir, build };
})();
