'use strict';
/* ===== Pantalla Cotizaciones ===== */
(() => {
  const fday = t => new Date(t).toLocaleDateString('es-MX');
  let L = [];

  views.cotizaciones = {
    render(root) {
      L = [...S.cots].reverse();
      root.innerHTML = `<h2>Cotizaciones</h2><div class="list" style="margin-top:14px">${L.map((c, i) => `<div class="card">
        <div class="tl"><b>${esc(c.folio)} · ${esc(c.cliente)}</b><span class="tag ${c.estado === 'Convertida' ? 'ok' : ''}">${esc(c.estado)}</span></div>
        <div class="mu">${fdate(c.fecha)} · vence ${fday(c.vigencia)}</div>
        <div class="mu" style="margin:4px 0">${c.items.map(x => x.cant + '× ' + esc(x.nombre || x.producto)).join(', ')}</div>
        <div class="tl"><b class="amt">${money(c.total)}</b><span>
          <button class="btn sm primary" data-a="load" data-i="${i}">Cargar</button>
          <button class="btn sm ghost" data-a="wa" data-i="${i}">WhatsApp</button>
          <button class="btn sm ghost" data-a="print" data-i="${i}">Imprimir</button>
          <button class="btn sm ghost danger" data-a="cancel" data-i="${i}" aria-label="Cancelar cotización">✕</button></span></div></div>`).join('')
        || '<p class="mu">Aún no hay cotizaciones. Guarda una desde la pantalla Vender.</p>'}</div>`;
      root.onclick = e => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const c = L[+b.dataset.i];
        ({ load: () => Vender.load(c.items, { cli: c.cliente, cot: c.folio }), wa: () => wa(c), print: () => printQ(c), cancel: () => cancel(c) })[b.dataset.a]();
      };
    }
  };

  function wa(c) {
    const t = `Cotización ${c.folio} - Café Sierra Escondida\n` + c.items.map(x => `${x.cant} x ${x.nombre || x.producto} - ${money(x.cant * x.precio)}`).join('\n') + `\nTotal: ${money(c.total)}\nVigencia: ${fday(c.vigencia)}`;
    window.open('https://wa.me/' + String(c.tel || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(t));
  }
  async function cancel(c) {
    if (!confirm('¿Cancelar la cotización ' + c.folio + '?')) return;
    await api('setQuote', c.folio, 'Cancelada'); toast('Cotización cancelada'); load();
  }
  async function printQ(c) {
    let k = {}; try { k = await api('getConfig'); } catch (e) {}
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Cotización ${esc(c.folio)}</title><style>@page{size:letter;margin:18mm}body{font:12px Arial;color:#1f2937}header{border-bottom:3px solid #a35d17;padding-bottom:14px;display:flex;justify-content:space-between}h1{font-size:24px;margin:0}table{width:100%;border-collapse:collapse;margin-top:25px}th{background:#f3ece3}td,th{border:1px solid #ddd;padding:10px;text-align:left}.num{text-align:right}.total{text-align:right;font-size:20px;margin-top:18px}</style></head><body>
      <header><div><h1>${esc(k.nombre || 'Café Sierra Escondida')}</h1><p>${esc(k.razonSocial || '')} ${esc(k.rfc || '')}<br>${esc(k.direccion || '')} ${esc(k.cp || '')}<br>${esc(k.telefono || '')} · ${esc(k.correo || '')}</p></div>
      <div><h1>COTIZACIÓN</h1><p>Folio: ${esc(c.folio)}<br>Fecha: ${fday(c.fecha)}<br>Vigencia: ${fday(c.vigencia)}</p></div></header>
      <h3>Cliente: ${esc(c.cliente)}</h3><table><tr><th>Cant.</th><th>Descripción</th><th class=num>Precio unitario</th><th class=num>Importe</th></tr>
      ${c.items.map(x => `<tr><td>${x.cant}</td><td>${esc(x.nombre || x.producto)}</td><td class=num>${money(x.precio)}</td><td class=num>${money(x.cant * x.precio)}</td></tr>`).join('')}</table>
      <div class=total><b>Total: ${money(c.total)}</b></div><p>Condiciones: ${esc(k.notas || 'Precios sujetos a la vigencia indicada.')}</p><p>Datos de pago: ${esc(k.datosBancarios || '')}</p><p>Gracias por su preferencia.</p></body></html>`);
    w.document.close(); w.print();
  }
})();
