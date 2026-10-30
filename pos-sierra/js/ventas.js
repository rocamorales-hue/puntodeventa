'use strict';
/* ===== Pantalla Ventas: por defecto las del día, con filtros por periodo, estado, método y tipo ===== */
function tickets() {
  const m = {};
  S.ventas.forEach(v => {
    const t = m[v.folio] = m[v.folio] || { folio: v.folio, fecha: v.fecha, cliente: v.cliente, estado: v.estado, metodo: v.metodo, tipo: v.tipo, nota: v.nota, items: [], total: 0, desc: 0 };
    t.items.push(v); t.total += v.total; t.desc += v.desc || 0;
  });
  /* Abonos aplicados a cada ticket pendiente: resta = total - abonado */
  const ab = {}; (S.abonos || []).forEach(a => { if (a.folio) ab[String(a.folio)] = (ab[String(a.folio)] || 0) + a.monto; });
  Object.values(m).forEach(t => {
    const pend = t.estado !== 'Pagado';
    t.abonado = pend ? Math.round((ab[t.folio] || 0) * 100) / 100 : 0;
    t.resta = pend ? Math.max(0, Math.round((t.total - t.abonado) * 100) / 100) : 0;
  });
  return Object.values(m).sort((a, b) => b.fecha - a.fecha);
}
const fdate = t => new Date(t).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

(() => {
  const D = 864e5, dk = t => new Date(t - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const F = { per: 'Hoy', est: 'Todos', met: 'Todos', tipo: 'Todos', ord: 'Más recientes', q: '', a: dk(Date.now()), b: dk(Date.now()), lim: 40 };
  const PER = ['Hoy', 'Ayer', '7 días', 'Este mes', 'Últimas 30', 'Todo', 'Rango'];
  const SEL = [
    ['est', 'Estado', [['Todos', 'Todos'], ['Pendiente', 'Pendientes'], ['Pagado', 'Pagados']]],
    ['met', 'Método de pago', [['Todos', 'Todos'], ['Efectivo', 'Efectivo'], ['Débito', 'Tarjeta'], ['Transferencia', 'Transferencia'], ['Multipagos', 'Multipagos'], ['Crédito cliente', 'Crédito cliente'], ['Sin registrar', 'Sin registrar']]],
    ['tipo', 'Tipo de servicio', [['Todos', 'Todos'], ['Aquí', 'Aquí'], ['Para llevar', 'Para llevar'], ['Domicilio', 'Domicilio']]],
    ['ord', 'Orden', [['Más recientes', 'Más recientes'], ['Mayor monto', 'Mayor monto']]]
  ];
  let TK = [];
  const met = m => String(m || 'Sin registrar').startsWith('Multipagos') ? 'Multipagos' : (m || 'Sin registrar');

  function inPer(t) {
    const k = dk(t.fecha), h = dk(Date.now());
    switch (F.per) {
      case 'Hoy': return k === h;
      case 'Ayer': return k === dk(Date.now() - D);
      case '7 días': return k >= dk(Date.now() - 6 * D);
      case 'Este mes': return k.slice(0, 7) === h.slice(0, 7);
      case 'Rango': return k >= F.a && k <= F.b;
      default: return true;
    }
  }
  function filtered() {
    const q = F.q.toLowerCase();
    let L = tickets().filter(t => inPer(t) && (F.est === 'Todos' || t.estado === F.est) && (F.met === 'Todos' || met(t.metodo) === F.met) && (F.tipo === 'Todos' || (t.tipo || 'Aquí') === F.tipo)
      && (t.folio + ' ' + t.cliente + ' ' + t.items.map(x => x.producto).join(' ')).toLowerCase().includes(q));
    if (F.ord === 'Mayor monto') L.sort((a, b) => b.total - a.total);
    return F.per === 'Últimas 30' ? L.slice(0, 30) : L;
  }

  views.ventas = {
    render(root) {
      root.innerHTML = `<h2>Ventas</h2>
        <input id="fq" type="search" placeholder="Buscar cliente, folio o producto" aria-label="Buscar" value="${esc(F.q)}" style="margin-top:14px">
        <div class="chips">${PER.map(p => `<button class="chip" data-p="${p}" aria-pressed="${p === F.per}">${p}</button>`).join('')}</div>
        ${F.per === 'Rango' ? `<div class="row2" style="margin-bottom:10px"><input type="date" id="va" value="${F.a}" aria-label="Desde"><input type="date" id="vb" value="${F.b}" aria-label="Hasta"></div>` : ''}
        <div class="form" style="margin-bottom:12px">${SEL.map(([k, l, o]) => `<select data-f="${k}" aria-label="${l}">${o.map(([v, t]) => `<option value="${v}" ${F[k] === v ? 'selected' : ''}>${l}: ${t}</option>`).join('')}</select>`).join('')}</div>
        <div class="mu" id="vs" aria-live="polite"></div><div class="list" id="vl"></div><div id="vm" style="margin-top:12px"></div>`;
      $('#fq').oninput = e => { F.q = e.target.value; F.lim = 40; list(); };
      if ($('#va')) { $('#va').onchange = e => { F.a = e.target.value; list(); }; $('#vb').onchange = e => { F.b = e.target.value; list(); }; }
      root.onchange = e => { const k = e.target.dataset.f; if (k) { F[k] = e.target.value; F.lim = 40; list(); } };
      root.onclick = e => {
        const p = e.target.closest('[data-p]'); if (p) { F.per = p.dataset.p; F.lim = 40; views.ventas.render(root); return; }
        if (e.target.closest('[data-more]')) { F.lim += 40; list(); return; }
        const b = e.target.closest('[data-a]'); if (!b) return;
        const t = TK[+b.dataset.i];
        ({ edit: () => Vender.load(t.items, { cli: t.cliente, nota: t.nota, tipo: t.tipo, desc: t.desc, ed: { folio: t.folio, fecha: t.fecha } }), cobrar: () => cobrar(t), print: () => printT(t), del: () => del(t) })[b.dataset.a]();
      };
      list();
    }
  };

  function list() {
    TK = filtered();
    const tot = TK.reduce((s, t) => s + t.total, 0), pend = TK.reduce((s, t) => s + t.resta, 0);
    $('#vs').textContent = TK.length + ' ticket(s) · ' + money(tot) + (pend ? ' · por cobrar ' + money(pend) : '');
    $('#vl').innerHTML = TK.slice(0, F.lim).map((t, i) => `<div class="card">
      <div class="tl"><b>${esc(t.folio)} · ${esc(t.cliente || 'Mostrador')}</b><span class="tag ${t.estado === 'Pagado' ? 'ok' : ''}">${t.abonado > 0 ? 'Resta ' + money(t.resta) : esc(t.estado)}</span></div>
      <div class="mu">${fdate(t.fecha)} · ${esc(t.tipo || '')}${t.metodo && t.metodo !== 'Sin registrar' ? ' · ' + esc(t.metodo) : ''}</div>
      <div class="mu" style="margin:4px 0">${t.items.map(x => x.cant + '× ' + esc(x.producto)).join(', ')}${t.desc > 0 ? ' · Descuento −' + money(t.desc) : ''}${t.abonado > 0 ? ' · Abonado ' + money(t.abonado) : ''}</div>
      <div class="tl"><b class="amt">${money(t.total)}</b><span>
        ${t.estado !== 'Pagado' ? `<button class="btn sm primary" data-a="cobrar" data-i="${i}">Cobrar / abonar</button> ` : ''}
        <button class="btn sm ghost" data-a="edit" data-i="${i}">Editar</button>
        <button class="btn sm ghost" data-a="print" data-i="${i}">Imprimir</button>
        <button class="btn sm ghost danger" data-a="del" data-i="${i}">Borrar</button></span></div></div>`).join('')
      || `<p class="mu">No hay ventas con estos filtros.</p>${F.per === 'Hoy' ? '<button class="btn" data-p="Últimas 30">Ver las últimas 30 ventas</button>' : ''}`;
    $('#vm').innerHTML = TK.length > F.lim ? `<button class="btn ghost" data-more="1">Mostrar más (${TK.length - F.lim} restantes)</button>` : '';
  }

  /* Cobrar un ticket pendiente: completo o solo una parte (abono) */
  function cobrar(t) {
    const pagos = (S.abonos || []).filter(a => a.folio && String(a.folio) === t.folio), resta = t.resta;
    modal(`<h2>Cobrar ${esc(t.folio)}</h2>
      <div class="tl"><span class="mu">Total del ticket</span><b>${money(t.total)}</b></div>
      ${t.abonado > 0 ? `<div class="tl"><span class="mu">Ya abonado</span><b>${money(t.abonado)}</b></div>` : ''}
      <div class="tl"><span>Por cobrar</span><b class="amt">${money(resta)}</b></div>
      <label class="fl">Monto a cobrar ahora<input id="cm" type="number" min="0" step="0.01" inputmode="decimal" value="${resta.toFixed(2)}"></label>
      <div class="amounts"><button class="btn sm" data-q="${resta.toFixed(2)}">Todo (${money(resta)})</button><button class="btn sm" data-q="${(resta / 2).toFixed(2)}">La mitad</button></div>
      <div class="mu" id="ch" aria-live="polite"></div>
      <div class="quick">${['Efectivo', 'Débito', 'Transferencia'].map(m => `<button class="btn primary" data-m="${m}">${m === 'Débito' ? 'Tarjeta' : m}</button>`).join('')}</div>
      <button class="btn ghost" id="nc">Cancelar</button>`);
    const monto = () => Math.round((+$('#cm').value || 0) * 100) / 100;
    const hint = () => { const m = monto(); $('#ch').textContent = !(m > 0) ? '' : m > resta + 0.004 ? 'El monto es mayor a lo que resta.' : m >= resta - 0.004 ? 'Se liquida el ticket completo.' : 'Quedarán por cobrar ' + money(resta - m) + '.'; };
    $('#cm').oninput = hint; hint(); $('#nc').onclick = closeM;
    $('#mbox').onclick = async e => {
      const q = e.target.closest('[data-q]'); if (q) { $('#cm').value = q.dataset.q; hint(); return; }
      const b = e.target.closest('[data-m]'); if (!b) return;
      const m = monto(), met = b.dataset.m;
      if (!(m > 0)) return toast('Escribe el monto que vas a cobrar.', true);
      if (m > resta + 0.004) return toast('El monto no puede ser mayor a lo que resta: ' + money(resta) + '.', true);
      if (m >= resta - 0.004) {
        let metodo = met;
        if (pagos.length) { /* si hubo abonos previos, el método queda como pago dividido con el desglose real */
          const por = {}; pagos.forEach(a => por[a.metodo] = (por[a.metodo] || 0) + a.monto); por[met] = (por[met] || 0) + resta;
          metodo = 'Multipagos: ' + Object.entries(por).map(([k, v]) => k + ' ' + money(v)).join(' + ');
        }
        await api('setPaid', t.folio, metodo); closeM(); toast('Ticket ' + t.folio + ' liquidado');
      } else {
        await api('addPayment', t.cliente || '', t.folio, m, met, '', 'Abono a ' + t.folio); closeM(); toast('Abono de ' + money(m) + ' registrado. Resta ' + money(resta - m));
      }
      load();
    };
  }
  async function del(t) {
    if (!confirm('¿Borrar el ticket ' + t.folio + '? Esta acción no se puede deshacer.' + (t.abonado > 0 ? '\n\nOjo: tiene abonos por ' + money(t.abonado) + ' que no se devuelven automáticamente.' : ''))) return;
    await api('deleteSale', t.folio); toast('Ticket ' + t.folio + ' borrado'); load();
  }
  function printT(t) {
    const w = window.open('', '', 'width=320,height=600');
    w.document.write(`<pre style="font:13px monospace;width:260px">☕ CAFÉ SIERRA ESCONDIDA\nTicket ${esc(t.folio)}\n${fdate(t.fecha)}\nCliente: ${esc(t.cliente || '-')}\n------------------------\n` +
      t.items.map(x => `${x.cant} x ${esc(x.producto)}\n     ${money(x.cant * x.precio)}`).join('\n') +
      `\n------------------------\n${t.desc > 0 ? 'Descuento: -' + money(t.desc) + '\n' : ''}TOTAL: ${money(t.total)}\nPago: ${esc(t.metodo || '')}\n¡Gracias!</pre>`);
    w.document.close(); w.print();
  }
})();
