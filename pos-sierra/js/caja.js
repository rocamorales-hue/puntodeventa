'use strict';
/* ===== Caja: efectivo esperado, apertura, entradas/salidas, cortes y ajustes =====
   Principio: el efectivo esperado se CALCULA, no se captura.
   esperado(T) = último "inicio de control" + ventas en efectivo + abonos en efectivo
                 + entradas − salidas ± ajustes, todo lo ocurrido hasta T.
   Los conteos (apertura / corte / cierre) comparan lo contado contra ese esperado y,
   si hay diferencia, generan un ajuste con su motivo. Nada se borra: solo se anula. */
(() => {
  const DEN = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];
  const CAT_IN = ['Cambio / fondo adicional', 'Aportación del dueño', 'Cobro no registrado en ventas', 'Préstamo de otra caja', 'Otro'];
  const CAT_OUT = ['Pago a proveedor', 'Compra de insumos', 'Gasto operativo', 'Retiro del dueño', 'Depósito a banco', 'Propina entregada', 'Cambio a otra caja', 'Otro'];
  const CONTEOS = ['inicio', 'apertura', 'corte', 'cierre'];
  const NOMBRE = { inicio: 'Inicio de control', apertura: 'Apertura de caja', corte: 'Corte de caja', cierre: 'Cierre de caja', entrada: 'Entrada de efectivo', salida: 'Salida de efectivo', ajuste: 'Ajuste' };

  const r2 = n => Math.round((+n || 0) * 100) / 100;
  const dk = t => new Date(t - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const hhmm = t => new Date(t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const fdt = t => new Date(t).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const dtl = t => new Date(t - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  const tsOf = v => typeof v === 'number' ? v : (+v || Date.parse(v) || 0);
  const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));
  const newId = () => 'C' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const dayRange = k => { const [y, m, d] = k.split('-').map(Number); return [new Date(y, m - 1, d).getTime(), new Date(y, m - 1, d + 1).getTime() - 1]; };
  const denLbl = d => d === 0.5 ? '50¢' : '$' + d;

  let tab = 'mov', day = dk(Date.now()), flt = 'todo', err = null, qConsulta = null;

  /* ---------- Datos ---------- */
  const norm = L => (Array.isArray(L) ? L : []).map(r => {
    let den = r.den; if (typeof den === 'string') { try { den = JSON.parse(den); } catch (e) { den = null; } }
    const n = v => v === '' || v == null ? null : +v;
    return { id: String(r.id), fecha: tsOf(r.fecha), tipo: r.tipo, monto: +r.monto || 0, categoria: r.categoria || '', motivo: r.motivo || '', quien: r.quien || '',
      esperado: n(r.esperado), contado: n(r.contado), dif: n(r.dif), den: den && typeof den === 'object' ? den : null, ref: r.ref || '',
      anulado: r.anulado === true || r.anulado === 1 || r.anulado === '1' || String(r.anulado).toUpperCase() === 'TRUE', anuladoMotivo: r.anuladoMotivo || '' };
  }).sort((a, b) => a.fecha - b.fecha);
  const allRows = () => S.caja || [];
  const rows = () => allRows().filter(r => !r.anulado);

  /* Efectivo que entró por un ticket pagado. Los abonos en efectivo ya cuentan aparte (por su propia fecha),
     así que se restan del ticket para no contarlos dos veces cuando el ticket se liquidó con "Multipagos". */
  function cashOfTicket(t, abonos) {
    if (t.estado !== 'Pagado') return 0;
    const m = String(t.metodo || ''); let c = 0;
    if (m === 'Efectivo') c = t.total;
    else if (m.startsWith('Multipagos')) { const x = m.match(/Efectivo\s*\$\s*([\d,]*\.?\d+)/); c = x ? parseFloat(x[1].replace(/,/g, '')) : 0; }
    if (c > 0) c -= abonos.filter(a => String(a.folio) === String(t.folio) && a.metodo === 'Efectivo').reduce((s, a) => s + (+a.monto || 0), 0);
    return Math.max(0, r2(c));
  }
  function efecto(r) { if (r.anulado) return 0; return r.tipo === 'entrada' ? r.monto : r.tipo === 'salida' ? -r.monto : r.tipo === 'ajuste' ? r.monto : 0; }

  /* Línea de tiempo única: todo lo que mueve (o documenta) el efectivo */
  function items() {
    const out = [], A = S.abonos || [];
    tickets().forEach(t => { const c = cashOfTicket(t, A); if (c > 0) out.push({ ts: tsOf(t.fecha), k: 'venta', ef: c, txt: 'Venta ' + t.folio + (t.cliente ? ' · ' + t.cliente : ''), det: 'Cobro en efectivo' }); });
    A.forEach(a => { if (a.metodo === 'Efectivo' && +a.monto > 0) out.push({ ts: tsOf(a.fecha), k: 'abono', ef: +a.monto, txt: 'Abono · ' + (a.cliente || 'Cuenta general') + (a.folio ? ' (' + a.folio + ')' : ''), det: 'Abono de cliente en efectivo' }); });
    allRows().forEach(r => out.push({ ts: r.fecha, k: 'mov', r, ef: efecto(r) }));
    return out.sort((a, b) => a.ts - b.ts);
  }
  /* Efectivo esperado en el momento T (null si aún no se inicia el control) */
  function saldoA(T, its) {
    its = its || items();
    let base = null; its.forEach(i => { if (i.k === 'mov' && i.r.tipo === 'inicio' && !i.r.anulado && i.ts <= T) base = i; });
    if (!base) return null;
    return r2(base.r.monto + its.reduce((s, i) => s + (i.ts > base.ts && i.ts <= T ? i.ef : 0), 0));
  }
  /* Cómo se llegó al esperado: parte del último conteo y suma lo que pasó después */
  function desglose(T, its) {
    its = its || items();
    const c = rows().filter(r => CONTEOS.includes(r.tipo) && r.fecha <= T).pop(); if (!c) return null;
    const from = c.fecha + 1, d = { conteo: c, fondo: saldoA(from, its), ventas: 0, abonos: 0, entradas: 0, salidas: 0, ajustes: 0, total: saldoA(T, its) };
    its.forEach(i => {
      if (i.ts <= from || i.ts > T) return;
      if (i.k === 'venta') d.ventas += i.ef; else if (i.k === 'abono') d.abonos += i.ef;
      else if (i.k === 'mov') { const t = i.r.tipo; if (t === 'entrada') d.entradas += i.ef; else if (t === 'salida') d.salidas += -i.ef; else if (t === 'ajuste') d.ajustes += i.ef; }
    });
    ['ventas', 'abonos', 'entradas', 'salidas', 'ajustes'].forEach(k => d[k] = r2(d[k]));
    return d;
  }
  /* Estado de la caja: sin iniciar / abierta / cerrada */
  function estado() {
    const s = rows().filter(r => ['inicio', 'apertura', 'cierre'].includes(r.tipo)).pop();
    if (!s) return { s: 'nuevo' };
    return { s: s.tipo === 'cierre' ? 'cerrada' : 'abierta', r: s, vieja: s.tipo !== 'cierre' && dk(s.fecha) !== dk(Date.now()) };
  }
  /* Un movimiento manual solo se anula si no hay un conteo posterior (si no, se alteraría un corte ya hecho) */
  const anulable = r => !r.anulado && (r.tipo === 'entrada' || r.tipo === 'salida') && !rows().some(c => CONTEOS.includes(c.tipo) && c.fecha > r.fecha);

  window.Caja = { esperado: () => S.caja ? saldoA(Date.now()) : undefined, _t: { cashOfTicket, saldoA, desglose, items, norm } };

  /* ---------- Pantalla ---------- */
  views.caja = {
    async render(root) {
      root.onchange = null;
      root.innerHTML = '<h2>Caja</h2><p class="mu">Cargando caja…</p>';
      try { S.caja = norm(await api('getCaja')); err = null; } catch (e) { err = e; }
      if (view !== 'caja') return;
      draw(root);
    }
  };

  function draw(root) {
    if (err) {
      root.innerHTML = `<h2>Caja</h2><div class="card" style="margin-top:14px"><b>No se pudo cargar la caja</b><p class="mu">${esc(err.message || err)}</p>
        <p class="mu">Si es la primera vez, falta pegar <b>caja.gs</b> en tu Apps Script y publicar una versión nueva (ver instrucciones).</p><button class="btn" data-a="refresh">Reintentar</button></div>`;
      root.onclick = e => { if (e.target.closest('[data-a="refresh"]')) views.caja.render(root); };
      return;
    }
    const now = Date.now(), its = items(), est = estado(), saldo = saldoA(now, its), dg = desglose(now, its);
    const who = est.r && est.r.quien ? ' · ' + esc(est.r.quien) : '';
    const hero = est.s === 'nuevo'
      ? `<div class="card cj-hero"><b>Caja sin iniciar</b><p class="mu" style="margin:0">Cuenta el efectivo que hay hoy en caja para empezar. Desde ese momento el sistema calcula cuánto debería haber en cualquier fecha: ventas en efectivo, abonos, entradas y salidas.</p></div>`
      : `<div class="card cj-hero"><span class="mu">Efectivo esperado en caja ahora</span><div class="cj-big">${money(saldo)}</div>
          <div><span class="tag ${est.s === 'abierta' ? 'ok' : ''}">${est.s === 'abierta' ? 'Caja abierta' : 'Caja cerrada'}</span> <span class="mu">${est.s === 'abierta' ? 'desde ' + fdt(est.r.fecha) : 'desde ' + fdt(est.r.fecha)}${who}</span></div>
          ${est.vieja ? '<div class="cj-warn">La caja sigue abierta desde otro día. Haz el cierre para que el corte quede por jornada.</div>' : ''}
          ${dg ? `<div class="cj-brk">
            <div class="tl"><span class="mu">Al ${NOMBRE[dg.conteo.tipo].toLowerCase()} de ${fdt(dg.conteo.fecha)}</span><span>${money(dg.fondo)}</span></div>
            <div class="tl"><span class="mu">+ Ventas en efectivo</span><span>${money(dg.ventas)}</span></div>
            <div class="tl"><span class="mu">+ Abonos de clientes</span><span>${money(dg.abonos)}</span></div>
            <div class="tl"><span class="mu">+ Entradas</span><span>${money(dg.entradas)}</span></div>
            <div class="tl"><span class="mu">− Salidas</span><span>${money(dg.salidas)}</span></div>
            ${dg.ajustes ? `<div class="tl"><span class="mu">± Ajustes</span><span>${sgn(dg.ajustes)}</span></div>` : ''}
            <div class="tl tot"><span>= Esperado</span><span>${money(dg.total)}</span></div></div>` : ''}</div>`;
    const acts = est.s === 'nuevo' ? '<div class="cj-acts"><button class="btn primary" data-a="inicio">Iniciar control de caja</button></div>'
      : `<div class="cj-acts"><button class="btn primary" data-a="entrada">Meter dinero</button><button class="btn primary" data-a="salida">Sacar dinero</button><button class="btn" data-a="corte">Corte / comprobar</button>${est.s === 'abierta' ? '<button class="btn" data-a="cierre">Cerrar caja</button>' : '<button class="btn" data-a="apertura">Abrir caja</button>'}</div>`;
    root.innerHTML = `<div class="pagehead"><h2>Caja</h2><button class="btn sm" data-a="refresh">Actualizar</button></div>${hero}${acts}
      ${est.s === 'nuevo' ? '' : `<div class="chips">${[['mov', 'Movimientos'], ['cortes', 'Cortes'], ['consulta', 'Consultar saldo']].map(([k, l]) => `<button class="chip" data-t="${k}" aria-pressed="${k === tab}">${l}</button>`).join('')}</div><div id="cj"></div>`}`;
    root.onclick = e => {
      const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; draw(root); return; }
      const a = e.target.closest('[data-a]'); if (!a) return;
      const id = a.dataset.id, r = id && allRows().find(x => x.id === id);
      ({ refresh: () => load(), inicio: () => conteo('inicio'), apertura: () => conteo('apertura'), corte: () => conteo('corte'), cierre: () => conteo('cierre'),
        entrada: () => mov('entrada'), salida: () => mov('salida'), det: () => detalle(r), anular: () => anular(r), reinicio: () => conteo('inicio', true) })[a.dataset.a]();
    };
    if (est.s !== 'nuevo') ({ mov: tMov, cortes: tCortes, consulta: tConsulta })[tab]($('#cj'), its);
  }

  /* ---------- Pestaña: Movimientos del día ---------- */
  function tMov(c, its) {
    const [ds, de] = dayRange(day);
    let run = saldoA(ds - 1, its);
    const L = [];
    its.forEach(i => {
      if (i.ts > de) return;
      if (i.k === 'mov' && i.r.tipo === 'inicio' && !i.r.anulado) run = i.r.monto; else if (run != null) run = r2(run + i.ef);
      if (i.ts >= ds) L.push({ ...i, run });
    });
    const sum = f => r2(L.filter(f).reduce((s, i) => s + i.ef, 0));
    const vis = L.filter(i => flt === 'todo' || (flt === 'man' ? i.k === 'mov' : i.k !== 'mov'));
    const lab = i => i.k !== 'mov' ? i.txt : i.r.tipo === 'entrada' || i.r.tipo === 'salida' ? (i.r.categoria || NOMBRE[i.r.tipo]) : NOMBRE[i.r.tipo];
    const det = i => {
      if (i.k !== 'mov') return i.det;
      const r = i.r, x = [];
      if (CONTEOS.includes(r.tipo)) { x.push('Contado ' + money(r.contado)); if (r.esperado != null) x.push('esperado ' + money(r.esperado)); if (r.dif) x.push((r.dif > 0 ? 'sobra ' : 'falta ') + money(Math.abs(r.dif))); else if (r.esperado != null) x.push('cuadra'); }
      if (r.motivo) x.push(r.motivo);
      if (r.quien) x.push(r.quien);
      if (r.anulado) x.push('ANULADO: ' + (r.anuladoMotivo || 'sin motivo'));
      return x.join(' · ');
    };
    c.innerHTML = `<div class="rfilters"><div class="row2"><input type="date" id="cjd" value="${day}" aria-label="Día" max="${dk(Date.now())}">
        <select id="cjf" aria-label="Filtro">${[['todo', 'Todo'], ['man', 'Solo movimientos de caja'], ['ven', 'Solo ventas y abonos']].map(([v, l]) => `<option value="${v}" ${flt === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <div class="kpis" style="margin-top:0"><div class="card kpi"><span class="mu">Ventas y abonos en efectivo</span><b>${money(sum(i => i.k !== 'mov'))}</b></div>
        <div class="card kpi"><span class="mu">Entradas</span><b>${money(sum(i => i.k === 'mov' && i.r.tipo === 'entrada'))}</b></div>
        <div class="card kpi"><span class="mu">Salidas</span><b>${money(-sum(i => i.k === 'mov' && i.r.tipo === 'salida'))}</b></div>
        <div class="card kpi"><span class="mu">Saldo al final del día</span><b>${run == null ? '—' : money(run)}</b></div></div>
      <div class="card" style="padding:6px 14px">${vis.length ? vis.map(i => {
        const r = i.k === 'mov' ? i.r : null, clic = r && CONTEOS.includes(r.tipo), neg = i.ef < 0;
        return `<div class="cj-row ${r && r.anulado ? 'void' : ''} ${clic ? 'clic' : ''}" ${clic ? `data-a="det" data-id="${esc(r.id)}" role="button" tabindex="0"` : ''}>
          <span class="mu">${hhmm(i.ts)}</span><div><b>${esc(lab(i))}</b><div class="mu">${esc(det(i))}</div>${r && anulable(r) ? `<button class="btn sm ghost" data-a="anular" data-id="${esc(r.id)}" style="margin-top:6px">Anular</button>` : ''}</div>
          <div style="text-align:right"><b class="${i.ef > 0 ? 'up' : neg ? 'dn' : ''}">${i.ef ? sgn(i.ef) : ''}</b><div class="mu">${i.run == null ? '' : money(i.run)}</div></div></div>`;
      }).join('') : '<p class="mu" style="margin:14px 0">No hay movimientos de efectivo este día.</p>'}</div>
      <p class="mu" style="margin-top:12px"><button class="btn sm ghost" data-a="reinicio">Reiniciar control desde cero</button></p>`;
    $('#cjd').onchange = e => { if (e.target.value) { day = e.target.value; draw($('#app')); } };
    $('#cjf').onchange = e => { flt = e.target.value; draw($('#app')); };
  }

  /* ---------- Pestaña: Cortes ---------- */
  function tCortes(c) {
    const C = rows().filter(r => CONTEOS.includes(r.tipo)).reverse(), con = C.filter(r => r.dif != null), acum = r2(con.reduce((s, r) => s + r.dif, 0));
    c.innerHTML = `<div class="kpis" style="margin-top:0"><div class="card kpi"><span class="mu">Conteos registrados</span><b>${C.length}</b></div>
      <div class="card kpi"><span class="mu">Con diferencia</span><b>${con.filter(r => r.dif).length}</b></div>
      <div class="card kpi"><span class="mu">Diferencia acumulada</span><b class="${acum > 0 ? 'up' : acum < 0 ? 'dn' : ''}">${acum ? sgn(acum) : money(0)}</b></div></div>
      <div class="list">${C.map(r => `<div class="card cj-c" data-a="det" data-id="${esc(r.id)}" role="button" tabindex="0"><div class="tl"><b>${NOMBRE[r.tipo]}</b>
        <span class="tag ${r.dif ? '' : 'ok'}">${r.esperado == null ? 'Saldo inicial' : r.dif ? (r.dif > 0 ? 'Sobra ' : 'Falta ') + money(Math.abs(r.dif)) : 'Cuadra'}</span></div>
        <div class="mu">${fdt(r.fecha)}${r.quien ? ' · ' + esc(r.quien) : ''}</div>
        <div class="tl" style="margin-top:6px"><span class="mu">Contado</span><b>${money(r.contado)}</b></div>${r.esperado != null ? `<div class="tl"><span class="mu">Esperado</span><span>${money(r.esperado)}</span></div>` : ''}</div>`).join('') || '<p class="mu">Aún no hay conteos.</p>'}</div>`;
  }

  /* ---------- Pestaña: Consultar saldo a una fecha ---------- */
  function tConsulta(c, its) {
    const now = Date.now(); let T = qConsulta == null ? now : Math.min(qConsulta, now);
    const d = desglose(T, its), s = saldoA(T, its);
    const ayer = (() => { const [a] = dayRange(dk(now)); return a - 1; })();
    c.innerHTML = `<div class="card"><b>¿Cuánto debería haber en caja?</b><p class="mu" style="margin:2px 0 10px">Elige una fecha y hora. El sistema reconstruye el efectivo con lo registrado hasta ese momento.</p>
      <div class="row2"><input type="datetime-local" id="cq" value="${dtl(T)}" max="${dtl(now)}" aria-label="Fecha y hora"><div class="row2"><button class="btn sm" data-q="${now}">Ahora</button><button class="btn sm" data-q="${ayer}">Cierre de ayer</button></div></div>
      ${s == null ? '<p class="mu">En esa fecha la caja aún no estaba iniciada.</p>' : `<div class="big" style="margin-top:12px">${money(s)}</div>
        ${d ? `<div class="cj-brk"><div class="tl"><span class="mu">Último conteo antes: ${NOMBRE[d.conteo.tipo].toLowerCase()} del ${fdt(d.conteo.fecha)}</span><span>${money(d.fondo)}</span></div>
          <div class="tl"><span class="mu">+ Ventas en efectivo</span><span>${money(d.ventas)}</span></div><div class="tl"><span class="mu">+ Abonos</span><span>${money(d.abonos)}</span></div>
          <div class="tl"><span class="mu">+ Entradas</span><span>${money(d.entradas)}</span></div><div class="tl"><span class="mu">− Salidas</span><span>${money(d.salidas)}</span></div>
          ${d.ajustes ? `<div class="tl"><span class="mu">± Ajustes</span><span>${sgn(d.ajustes)}</span></div>` : ''}</div>` : ''}`}</div>
      <div class="card" style="margin-top:14px"><b>Comprobación rápida (sin guardar)</b><p class="mu" style="margin:2px 0 10px">Cuenta lo que hay ahorita y compáralo contra lo esperado. Si quieres que quede registrado, haz un corte.</p>
        <input id="cqc" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Efectivo que cuento ahora" aria-label="Efectivo contado"><div class="cj-dif" id="cqd" aria-live="polite"></div>
        <button class="btn" data-a="corte">Guardar como corte</button></div>`;
    $('#cq').onchange = e => { qConsulta = e.target.value ? new Date(e.target.value).getTime() : null; tConsulta(c, its); };
    c.onclick = e => { const q = e.target.closest('[data-q]'); if (q) { qConsulta = +q.dataset.q; tConsulta(c, its); } };
    $('#cqc').oninput = e => {
      const v = e.target.value, hoy = saldoA(now, its); if (v === '' || hoy == null) { $('#cqd').textContent = ''; return; }
      const df = r2(+v - hoy); $('#cqd').className = 'cj-dif ' + (df === 0 ? 'up' : 'dn');
      $('#cqd').textContent = df === 0 ? '✓ La caja cuadra' : df > 0 ? 'Sobran ' + money(df) + ' (esperado ' + money(hoy) + ')' : 'Faltan ' + money(-df) + ' (esperado ' + money(hoy) + ')';
    };
  }

  /* ---------- Modales ---------- */
  const mb = () => $('#mbox');
  const bye = () => { const m = mb(); m.onclick = m.oninput = m.onchange = null; closeM(); };
  const quien = () => store.get('caja_quien', '');
  const lbl = (t, h) => `<label class="cj-f">${t}${h}</label>`;
  async function guardar(R, msg) {
    try { await api('saveCaja', R); store.set('caja_quien', (R[0].quien || '').trim()); bye(); toast(msg); await load(); } catch (e) { /* api ya avisó */ }
  }

  /* Conteo de efectivo: inicio, apertura, corte o cierre */
  function conteo(kind, reinicio) {
    const now = Date.now(), esp = kind === 'inicio' ? null : saldoA(now);
    if (kind !== 'inicio' && esp == null) return toast('Primero inicia el control de caja.', true);
    const X = {
      inicio: [reinicio ? 'Reiniciar control de caja' : 'Iniciar control de caja', 'Cuenta el efectivo que hay en caja ahora. Desde este momento el sistema lleva la cuenta; las ventas anteriores ya no se consideran.', 'Iniciar'],
      apertura: ['Abrir caja', 'Cuenta el efectivo con el que arrancas el día. Si no coincide con el cierre anterior, anota el motivo.', 'Abrir caja'],
      corte: ['Corte de caja', 'Cuenta el efectivo y compáralo contra lo que debería haber.', 'Guardar corte'],
      cierre: ['Cerrar caja', 'Cuenta todo el efectivo al terminar el día. Después puedes retirar lo que no se queda de fondo.', 'Cerrar caja']
    }[kind];
    modal(`<h2>${X[0]}</h2><p class="mu" style="margin:0">${X[1]}</p>
      ${esp != null ? `<div class="tl"><span class="mu">Esperado en caja</span><b>${money(esp)}</b></div>` : ''}
      <div class="cj-den">${DEN.map(d => `<label>${denLbl(d)}<input type="number" min="0" step="1" inputmode="numeric" data-cj data-d="${d}" placeholder="0"></label>`).join('')}</div>
      ${lbl('Total contado ($)', '<input id="ct" data-cj type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00">')}
      <div class="cj-dif" id="cd" aria-live="polite"></div>
      ${kind === 'inicio' ? '' : `<div id="cdx" hidden>${lbl('Motivo de la diferencia', '<input id="cn" data-cj placeholder="Ej. cambio mal dado, gasto sin registrar…" maxlength="120">')}
        <label class="cj-chk"><input type="checkbox" id="ca" data-cj checked> Ajustar la caja para que coincida con lo contado</label><div class="mu" id="cah"></div></div>`}
      ${kind === 'cierre' ? `<div>${lbl('Fondo que se queda para mañana ($)', '<input id="cf" data-cj type="number" min="0" step="0.01" inputmode="decimal">')}<div class="mu" id="cfh"></div></div>` : ''}
      ${kind === 'inicio' ? lbl('Nota (opcional)', '<input id="cn" data-cj placeholder="Ej. Fondo inicial" maxlength="120">') : ''}
      ${lbl('Responsable', `<input id="cw" data-cj value="${esc(quien())}" placeholder="Quién cuenta" maxlength="40">`)}
      <button class="btn primary" id="cok" disabled>${X[2]}</button><button class="btn ghost" id="cno">Cancelar</button>`);
    const m = mb(); let manual = false, fondoTocado = false;
    const contado = () => $('#ct').value === '' ? null : r2(+$('#ct').value);
    const upd = () => {
      const c = contado(), df = c == null || esp == null ? 0 : r2(c - esp), hay = esp != null && df !== 0;
      $('#cd').className = 'cj-dif ' + (esp == null || c == null ? '' : df === 0 ? 'up' : 'dn');
      $('#cd').textContent = c == null || esp == null ? '' : df === 0 ? '✓ La caja cuadra' : df > 0 ? 'Sobran ' + money(df) : 'Faltan ' + money(-df);
      if ($('#cdx')) $('#cdx').hidden = !hay;
      if (hay) $('#cah').textContent = $('#ca').checked ? 'Se registrará un ajuste de ' + sgn(df) + ' con ese motivo.' : 'La diferencia seguirá apareciendo en el siguiente corte.';
      let ok = c != null && c >= 0 && (!hay || $('#cn').value.trim().length >= 3);
      if (kind === 'cierre') {
        if (!fondoTocado && c != null) $('#cf').value = c.toFixed(2);
        const f = r2(+$('#cf').value), ret = c == null ? 0 : r2(c - f);
        $('#cfh').textContent = ret > 0 ? 'Se registrará una salida de ' + money(ret) + ' (retiro al cierre).' : ret < 0 ? 'El fondo no puede ser mayor a lo contado.' : '';
        ok = ok && ret >= 0 && $('#cf').value !== '';
      }
      $('#cok').disabled = !ok;
    };
    m.oninput = e => {
      if (!e.target.closest('[data-cj]')) return;
      if (e.target.dataset.d !== undefined) { let s = 0; m.querySelectorAll('[data-d]').forEach(i => { s += Math.max(0, Math.floor(+i.value || 0)) * +i.dataset.d; }); $('#ct').value = s ? r2(s).toFixed(2) : ''; manual = false; }
      else if (e.target.id === 'ct') manual = true;
      else if (e.target.id === 'cf') fondoTocado = true;
      upd();
    };
    m.onchange = e => { if (e.target.id === 'ca') upd(); };
    $('#cno').onclick = bye;
    $('#cok').onclick = async () => {
      const ts = Date.now(), c = contado(), qn = $('#cw').value.trim(), nota = $('#cn') ? $('#cn').value.trim() : '', id = newId();
      let den = null;
      if (!manual) { den = {}; m.querySelectorAll('[data-d]').forEach(i => { const q = Math.floor(+i.value || 0); if (q > 0) den[i.dataset.d] = q; }); if (!Object.keys(den).length) den = null; }
      const R = [];
      if (kind === 'inicio') R.push({ id, fecha: ts, tipo: 'inicio', monto: c, contado: c, den, quien: qn, motivo: nota || 'Saldo inicial' });
      else {
        const e2 = saldoA(ts), df = r2(c - e2);
        R.push({ id, fecha: ts, tipo: kind, monto: 0, esperado: e2, contado: c, dif: df, den, quien: qn, motivo: df ? nota : '' });
        if (df && $('#ca').checked) R.push({ id: newId(), fecha: ts + 1, tipo: 'ajuste', monto: df, categoria: df > 0 ? 'Sobrante' : 'Faltante', motivo: nota, quien: qn, ref: id });
        if (kind === 'cierre') { const ret = r2(c - r2(+$('#cf').value)); if (ret > 0) R.push({ id: newId(), fecha: ts + 2, tipo: 'salida', monto: ret, categoria: 'Retiro al cierre', motivo: 'Retiro al cierre. Fondo para mañana: ' + money(c - ret), quien: qn, ref: id }); }
      }
      guardar(R, X[0] + ': guardado');
    };
    upd();
  }

  /* Meter / sacar dinero con su motivo */
  function mov(tipo) {
    const ent = tipo === 'entrada', cats = ent ? CAT_IN : CAT_OUT;
    modal(`<h2>${ent ? 'Meter dinero a la caja' : 'Sacar dinero de la caja'}</h2>
      ${lbl('Monto ($)', '<input id="mm" data-cj type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00">')}
      ${lbl('Categoría', `<select id="mc" data-cj>${cats.map(c => `<option>${c}</option>`).join('')}</select>`)}
      ${lbl('¿Por qué? (obligatorio)', `<input id="mt" data-cj placeholder="${ent ? 'Ej. Cambio en monedas del banco' : 'Ej. Pago de hielo a proveedor'}" maxlength="120">`)}
      ${lbl('Responsable', `<input id="mq" data-cj value="${esc(quien())}" placeholder="Quién lo hace" maxlength="40">`)}
      <button class="btn primary" id="mok" disabled>${ent ? 'Registrar entrada' : 'Registrar salida'}</button><button class="btn ghost" id="mno">Cancelar</button>`);
    const upd = () => { $('#mok').disabled = !(+$('#mm').value > 0 && $('#mt').value.trim().length >= 3); };
    mb().oninput = e => { if (e.target.closest('[data-cj]')) upd(); };
    $('#mno').onclick = bye; $('#mm').focus();
    $('#mok').onclick = () => {
      const m = r2(+$('#mm').value), esp = saldoA(Date.now());
      if (!ent && esp != null && m > esp && !confirm('Esta salida (' + money(m) + ') es mayor al efectivo esperado (' + money(esp) + '). ¿Registrarla de todos modos?')) return;
      guardar([{ id: newId(), fecha: Date.now(), tipo, monto: m, categoria: $('#mc').value, motivo: $('#mt').value.trim(), quien: $('#mq').value.trim() }], (ent ? 'Entrada' : 'Salida') + ' de ' + money(m) + ' registrada');
    };
  }

  function anular(r) {
    if (!r || !anulable(r)) return toast('Este movimiento ya no se puede anular porque hay un conteo posterior.', true);
    modal(`<h2>Anular movimiento</h2><p class="mu" style="margin:0">${NOMBRE[r.tipo]} de <b>${money(r.monto)}</b> · ${esc(r.motivo)}. Seguirá visible en el historial, marcado como anulado.</p>
      ${lbl('Motivo de la anulación', '<input id="am2" data-cj maxlength="120" placeholder="Ej. Se capturó dos veces">')}
      <button class="btn primary" id="aok" disabled>Anular</button><button class="btn ghost" id="ano">Cancelar</button>`);
    mb().oninput = e => { if (e.target.closest('[data-cj]')) $('#aok').disabled = $('#am2').value.trim().length < 3; };
    $('#ano').onclick = bye;
    $('#aok').onclick = async () => { try { await api('voidCaja', r.id, $('#am2').value.trim()); bye(); toast('Movimiento anulado'); await load(); } catch (e) { /* api ya avisó */ } };
  }

  function detalle(r) {
    if (!r) return;
    const aj = allRows().find(x => x.tipo === 'ajuste' && x.ref === r.id && !x.anulado), den = r.den ? DEN.filter(d => r.den[d]).map(d => [d, r.den[d]]) : [];
    modal(`<h2>${NOMBRE[r.tipo]}</h2><div class="mu">${new Date(r.fecha).toLocaleString('es-MX')}${r.quien ? ' · ' + esc(r.quien) : ''}</div>
      ${r.esperado != null ? `<div class="tl"><span class="mu">Esperado</span><b>${money(r.esperado)}</b></div>` : ''}<div class="tl"><span class="mu">Contado</span><b>${money(r.contado)}</b></div>
      ${r.dif != null ? `<div class="tl"><span class="mu">Diferencia</span><b class="${r.dif > 0 ? 'up' : r.dif < 0 ? 'dn' : ''}">${r.dif ? sgn(r.dif) : 'Cuadra'}</b></div>` : ''}
      ${r.motivo ? `<div><span class="mu">Motivo / nota</span><div>${esc(r.motivo)}</div></div>` : ''}
      ${aj ? `<div class="mu">Se registró un ajuste de ${sgn(aj.monto)} para igualar la caja con lo contado.</div>` : r.dif ? '<div class="mu">No se ajustó: la diferencia sigue pendiente.</div>' : ''}
      ${den.length ? `<table class="rtable"><tr><th>Denominación</th><th class="n">Piezas</th><th class="n">Importe</th></tr>${den.map(([d, q]) => `<tr><td>${denLbl(d)}</td><td class="n">${q}</td><td class="n">${money(d * q)}</td></tr>`).join('')}</table>` : '<div class="mu">Total capturado sin desglose de billetes y monedas.</div>'}
      <button class="btn" id="dpr">Imprimir</button><button class="btn ghost" id="dno">Cerrar</button>`);
    $('#dno').onclick = bye; $('#dpr').onclick = () => imprimir(r, aj, den);
  }

  function imprimir(r, aj, den) {
    const w = window.open('', '_blank'); if (!w) return toast('Permite las ventanas emergentes para imprimir.', true);
    const n = (S.config || {}).nombre || 'Café Sierra Escondida';
    w.document.write(`<html><head><title>${NOMBRE[r.tipo]}</title><style>body{font:14px Arial;margin:28px;color:#1f2937}table{width:100%;border-collapse:collapse;margin:10px 0 22px}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3ece3}.n{text-align:right}h1{font-size:22px;margin:0}.f{display:flex;gap:40px;margin-top:60px}.f div{flex:1;border-top:1px solid #444;padding-top:6px;text-align:center}</style></head><body>
      <h1>${esc(NOMBRE[r.tipo])} — ${esc(n)}</h1><p>${new Date(r.fecha).toLocaleString('es-MX')}${r.quien ? ' · Responsable: ' + esc(r.quien) : ''}</p>
      <table>${r.esperado != null ? `<tr><th>Esperado</th><td class="n">${money(r.esperado)}</td></tr>` : ''}<tr><th>Contado</th><td class="n">${money(r.contado)}</td></tr>${r.dif != null ? `<tr><th>Diferencia</th><td class="n">${r.dif ? sgn(r.dif) : 'Cuadra'}</td></tr>` : ''}${r.motivo ? `<tr><th>Motivo</th><td>${esc(r.motivo)}</td></tr>` : ''}${aj ? `<tr><th>Ajuste</th><td>${sgn(aj.monto)}</td></tr>` : ''}</table>
      ${den.length ? `<table><tr><th>Denominación</th><th class="n">Piezas</th><th class="n">Importe</th></tr>${den.map(([d, q]) => `<tr><td>${denLbl(d)}</td><td class="n">${q}</td><td class="n">${money(d * q)}</td></tr>`).join('')}</table>` : ''}
      <div class="f"><div>Entrega</div><div>Recibe / Revisa</div></div></body></html>`);
    w.document.close(); setTimeout(() => w.print(), 300);
  }
})();
