'use strict';
/* ===== Documento de cotización profesional (se abre listo para "Guardar como PDF") ===== */
const Cotizacion = (() => {
  const m2 = n => '$' + (+n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dl = t => new Date(t).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  /* Número a letra (pesos mexicanos) */
  const U = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const T = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  const ap = s => s.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
  const b100 = n => n < 30 ? U[n] : T[Math.floor(n / 10)] + (n % 10 ? ' y ' + U[n % 10] : '');
  const b1000 = n => n === 100 ? 'cien' : (C[Math.floor(n / 100)] + (n >= 100 && n % 100 ? ' ' : '') + (n % 100 ? b100(n % 100) : '')).trim();
  function words(n) {
    n = Math.floor(n); if (n === 0) return 'cero';
    const mill = Math.floor(n / 1e6), mil = Math.floor(n % 1e6 / 1e3), r = n % 1e3, p = [];
    if (mill) p.push(mill === 1 ? 'un millón' : ap(words(mill)) + ' millones');
    if (mil) p.push(mil === 1 ? 'mil' : ap(words(mil)) + ' mil');
    if (r) p.push(b1000(r));
    return p.join(' ');
  }
  function letra(total) {
    const t = Math.round((+total || 0) * 100) / 100, e = Math.floor(t), c = String(Math.round((t - e) * 100)).padStart(2, '0');
    return '(SON: ' + ap(words(e)).toUpperCase() + (e >= 1e6 && e % 1e6 === 0 ? ' DE' : '') + (e === 1 ? ' PESO ' : ' PESOS ') + c + '/100 M.N.)';
  }

  /* Totales según la configuración de IVA */
  function calc(c, k) {
    k = k || S.config || {};
    const modo = k.ivaModo || 'ninguno', tasa = (+k.ivaTasa || 16) / 100;
    const bruto = (c.items || []).reduce((s, x) => s + (+x.cant || 0) * (+x.precio || 0), 0), desc = Math.min(+c.descuento || 0, bruto), neto = bruto - desc;
    let sub = neto, iva = 0, total = neto;
    if (modo === 'sumar') { iva = neto * tasa; total = neto + iva; } else if (modo === 'incluido') { sub = neto / (1 + tasa); iva = neto - sub; }
    return { modo, tasa: Math.round(tasa * 100), bruto, desc, sub, iva, total };
  }

  function build(c) {
    const k = S.config || {}, col = brand(), t = calc(c, k);
    const cl = (S.clients || []).find(z => String(z.nombre).toUpperCase() === String(c.cliente || '').toUpperCase()) || {};
    const logo = /^data:image\//.test(k.logo || '') ? `<img src="${k.logo}" alt="Logo" style="max-height:62px;max-width:200px;margin-bottom:6px">` : '';
    const nom = esc(k.nombre || 'Café Sierra Escondida');
    const line = (a, b) => b ? `<div>${a}${esc(b)}</div>` : '';
    const rows = (c.items || []).map((x, i) => `<tr><td class="c">${i + 1}</td><td class="c">${+x.cant}</td><td>${esc(x.nombre || x.producto)}</td><td class="n">${m2(x.precio)}</td><td class="n">${m2((+x.cant || 0) * (+x.precio || 0))}</td></tr>`).join('');
    const tot = (l, v, cls) => `<tr class="${cls || ''}"><td>${l}</td><td class="n">${v}</td></tr>`;
    const notaPrecio = t.modo === 'incluido' ? 'Precios con IVA incluido.' : t.modo === 'sumar' ? 'Precios antes de IVA.' : '';
    const dias = c.fecha && c.vigencia ? Math.max(1, Math.round((c.vigencia - c.fecha) / 864e5)) : (+k.vigenciaDias || 15);
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Cotización ${esc(c.folio)}</title><style>
@page{size:letter;margin:14mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:12px/1.42 Arial,Helvetica,sans-serif;color:#1f2937;margin:0 auto;max-width:800px;padding:16px;position:relative}
.bar{background:#fbf4e4;border:1px solid #f1e2c3;border-radius:8px;padding:10px 12px;margin-bottom:14px;display:flex;gap:12px;align-items:center;justify-content:space-between}
.bar button{background:${col};color:#fff;border:0;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer}
header{display:flex;justify-content:space-between;gap:20px;padding-bottom:10px;border-bottom:4px solid ${col}}
.emp{font-size:11px;color:#4b5563}.emp b{font-size:16px;color:#111827;display:block}
.ttl{text-align:right}.ttl h1{margin:0;font-size:26px;letter-spacing:.06em;color:${col}}.ttl .f{font-size:13px;margin-top:4px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:12px 0}.box{border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px}.box h3{margin:0 0 5px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280}
table{width:100%;border-collapse:collapse}.items th{background:${col};color:#fff;text-align:left;padding:8px;font-size:11px}.items td{padding:6px 8px;border-bottom:1px solid #e5e7eb}.items tr:nth-child(even) td{background:#f9fafb}
.n{text-align:right}.c{text-align:center;width:46px}.items th.n{text-align:right}.items th.c{text-align:center}
.tots{width:290px;margin:10px 0 0 auto}.tots td{padding:5px 8px}.tots .g td{font-size:15px;font-weight:700;border-top:2px solid ${col};color:${col}}
.letra{text-align:right;font-size:10.5px;color:#4b5563;margin-top:4px}
.cond{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0 4px}
h4{margin:10px 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#374151}.txt{white-space:pre-line;color:#374151}
.blk{break-inside:avoid}.dos{display:grid;grid-template-columns:1fr 1fr;gap:16px}.txt{font-size:11px}.firmas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:22px;break-inside:avoid}.firmas div{border-top:1px solid #6b7280;padding-top:5px;text-align:center;font-size:11px;color:#4b5563}
.pie{margin-top:10px;text-align:center;color:#6b7280;font-size:10.5px;border-top:1px solid #e5e7eb;padding-top:8px}
.wm{position:fixed;top:38%;left:12%;font-size:110px;font-weight:800;color:rgba(185,71,61,.14);transform:rotate(-24deg);letter-spacing:.1em;pointer-events:none}
@media print{.bar{display:none}body{padding:0;max-width:none}}
</style></head><body>
${c.estado === 'Cancelada' ? '<div class="wm">CANCELADA</div>' : ''}
<div class="bar"><span>Para guardar el PDF, en el cuadro de impresión elige <b>«Guardar como PDF»</b> como destino.</span><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
<header><div class="emp">${logo}<b>${nom}</b>${line('', k.razonSocial)}${line('RFC: ', k.rfc)}${line('', [k.direccion, k.cp, k.ciudad].filter(Boolean).join(', '))}${line('Tel. ', k.telefono)}${line('', k.correo)}${line('', k.web)}</div>
<div class="ttl"><h1>COTIZACIÓN</h1><div class="f"><b>Folio:</b> ${esc(c.folio)}</div><div class="f"><b>Fecha:</b> ${dl(c.fecha)}</div><div class="f"><b>Vigencia:</b> ${dl(c.vigencia)}</div></div></header>
<div class="meta"><div class="box"><h3>Cliente</h3><b>${esc(c.cliente || 'Público en general')}</b>${line('Tel. ', c.tel || cl.tel)}${line('', cl.email)}</div>
<div class="box"><h3>Resumen</h3><div>${(c.items || []).length} concepto(s)</div><div>Moneda: pesos mexicanos (MXN)</div><div>Vigencia: ${dias} días naturales</div></div></div>
<table class="items"><tr><th class="c">#</th><th class="c">Cant.</th><th>Descripción</th><th class="n">Precio unitario</th><th class="n">Importe</th></tr>${rows}</table>
<table class="tots">${tot('Importe', m2(t.bruto))}${t.desc > 0 ? tot('Descuento', '−' + m2(t.desc)) : ''}${t.modo !== 'ninguno' ? tot('Subtotal', m2(t.sub)) + tot('IVA ' + t.tasa + '%', m2(t.iva)) : ''}${tot('Total', m2(t.total), 'g')}</table>
<div class="letra">${letra(t.total)}${notaPrecio ? '<br>' + notaPrecio : ''}</div>
<div class="cond"><div class="box"><h3>Forma de pago</h3>${esc(k.condPago || 'A convenir')}</div><div class="box"><h3>Tiempo de entrega</h3>${esc(k.tiempoEntrega || 'A convenir')}</div><div class="box"><h3>Válida hasta</h3>${dl(c.vigencia)}</div></div>
${c.notas ? `<div class="blk"><h4>Notas</h4><div class="txt">${esc(c.notas)}</div></div>` : ''}
<div class="dos">${k.notas ? `<div class="blk"><h4>Términos y condiciones</h4><div class="txt">${esc(k.notas)}</div></div>` : '<div></div>'}${k.datosBancarios ? `<div class="blk"><h4>Datos para pago</h4><div class="txt">${esc(k.datosBancarios)}</div></div>` : '<div></div>'}</div>
<div class="firmas"><div>${esc(k.firmaNombre || 'Atentamente')}<br>${esc(k.firmaPuesto || nom)}</div><div>Aceptación del cliente<br>Nombre, firma y fecha</div></div>
<div class="pie">Gracias por su preferencia · ${[k.telefono, k.correo, k.web].filter(Boolean).map(esc).join(' · ')}</div>
</body></html>`;
  }

  function abrir(c) {
    const w = window.open('', '_blank');
    if (!w) return toast('El navegador bloqueó la ventana. Permite las ventanas emergentes de esta página e inténtalo de nuevo.', true);
    w.document.write(build(c)); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 700);
  }
  const ejemplo = () => abrir({ folio: 'COT-EJEMPLO', fecha: Date.now(), vigencia: Date.now() + 15 * 864e5, cliente: 'Cliente de ejemplo', tel: '662 000 0000', estado: 'Vigente', descuento: 100, notas: 'Entrega en sucursal. Precios sujetos a cambio sin previo aviso.',
    items: [{ nombre: 'Café en grano Sierra 1 kg', cant: 5, precio: 480 }, { nombre: 'Café molido 250 g', cant: 10, precio: 140 }, { nombre: 'Servicio de entrega', cant: 1, precio: 120 }] });
  return { abrir, ejemplo, build, calc, letra };
})();
