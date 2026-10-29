'use strict';
/* ===== Pantalla Vender: catálogo, ticket y cobro rápido ===== */
(() => {
  const V = { cart: [], cat: 'Todas', q: '', cli: '', tipo: 'Aquí', nota: '', edit: -1, busy: false, ed: null, cot: null, dsc: { t: '$', v: 0 }, favs: store.get('favs', []), mode: store.get('mode', 'lista'), flash: null, vis: [] };
  const sub = () => V.cart.reduce((s, i) => s + i.cant * i.precio, 0);
  const dsc = () => { const s = sub(), d = V.dsc.t === '%' ? s * V.dsc.v / 100 : V.dsc.v; return Math.min(s, Math.max(0, Math.round(d * 100) / 100)); };
  const total = () => Math.round((sub() - dsc()) * 100) / 100;
  const count = () => V.cart.reduce((s, i) => s + i.cant, 0);
  const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 40% 38%)`; };

  function popularity() {
    const m = {}; S.ventas.forEach(v => m[v.producto] = (m[v.producto] || 0) + v.cant); return m;
  }

  views.vender = {
    render(root) {
      root.innerHTML = `<div class="pos">
        <section class="catalog">
          <div class="catbar"><input id="q" type="search" placeholder="Buscar producto… (ej. 3x café y Enter)" aria-label="Buscar producto" value="${esc(V.q)}" autocomplete="off">
            <div class="vmode" role="group" aria-label="Vista del catálogo"><button data-a="mode" data-v="lista" aria-pressed="${V.mode === 'lista'}" aria-label="Vista de lista">${ICONS.lista}</button><button data-a="mode" data-v="mosaico" aria-pressed="${V.mode === 'mosaico'}" aria-label="Vista de mosaico">${ICONS.mas}</button></div></div>
          <div class="chips" id="chips"></div>
          <div class="grid ${V.mode === 'lista' ? 'rows' : ''}" id="grid"></div>
        </section>
        <aside class="ticket" id="ticket" aria-label="Ticket actual">
          <div class="t-head"><div><h2 id="ttl">Ticket actual</h2><div class="mu" id="tsub"></div></div>
            <span><button class="btn sm ghost" data-a="clear">Vaciar</button> <button class="btn sm ghost t-close" data-a="close">Cerrar</button></span></div>
          <div class="t-fields">
            <input id="cli" list="cl" placeholder="Cliente (opcional)" aria-label="Cliente" value="${esc(V.cli)}" autocomplete="off">
            <datalist id="cl">${S.clients.map(c => `<option value="${esc(c.nombre)}">`).join('')}</datalist>
            <div class="seg" role="group" aria-label="Tipo de servicio">${['Aquí', 'Para llevar', 'Domicilio'].map(t =>
              `<button data-a="tipo" data-v="${t}" aria-pressed="${t === V.tipo}">${t}</button>`).join('')}</div>
            <button class="linkbtn" data-a="note" id="nbtn" ${V.nota ? 'hidden' : ''}>＋ Agregar nota al pedido</button>
            <input id="nota" placeholder="Nota del pedido (dirección, mesa…)" aria-label="Nota del pedido" value="${esc(V.nota)}" ${V.nota ? '' : 'hidden'}>
          </div>
          <div class="items" id="items"></div>
          <div class="t-foot">
            <div class="tl"><button class="btn sm ghost" data-a="disc" id="dbtn">Descuento</button><span class="mu" id="dline"></span></div>
            <div class="total"><span class="mu" id="ccount"></span><b id="tot"></b></div>
            <div class="quick">
              <button class="btn primary" data-a="pay" data-m="Efectivo">Efectivo exacto</button>
              <button class="btn primary" data-a="pay" data-m="Débito">Tarjeta</button>
              <button class="btn primary" data-a="pay" data-m="Transferencia">Transferencia</button>
            </div>
            <div class="row2 r3">
              <button class="btn" data-a="cash">Efectivo + cambio</button>
              <button class="btn" data-a="split">Dividir pago</button>
              <button class="btn" data-a="credit">A crédito</button>
            </div>
            <div class="row2"><button class="btn ghost" data-a="pend">Dejar pendiente</button><button class="btn ghost" data-a="quote">Guardar cotización</button></div>
          </div>
        </aside>
        <button class="totalbar" data-a="open"><span id="bcount"></span><span id="btot"></span></button>
      </div>`;
      root.onclick = onClick;
      $('#q').oninput = e => { V.q = e.target.value; grid(); };
      $('#q').onkeydown = e => {
        if (e.key === 'Escape') { V.q = ''; e.target.value = ''; grid(); }
        if (e.key === 'Enter' && V.vis.length) { const k = parse(); H.add(null, { dataset: { v: V.vis[0].nombre } }, k.n); V.q = ''; e.target.value = ''; grid(); }
      };
      if (window.innerWidth > 1000) $('#q').focus();
      $('#cli').oninput = e => V.cli = e.target.value;
      $('#nota').oninput = e => V.nota = e.target.value;
      chips(); grid(); cart();
    }
  };

  function chips() {
    const cats = ['Todas', ...(V.favs.length ? ['★ Favoritos'] : []), ...new Set(S.prods.map(p => p.cat))];
    $('#chips').innerHTML = cats.map(c => `<button class="chip" data-a="cat" data-v="${esc(c)}" aria-pressed="${c === V.cat}">${esc(c)}</button>`).join('');
  }

  /* "3x café" agrega 3 piezas del primer resultado al presionar Enter */
  function parse() { const m = V.q.match(/^\s*(\d+)\s*[x*]\s*(.*)$/i); return m ? { n: Math.max(1, +m[1]), t: m[2] } : { n: 1, t: V.q }; }
  const inCart = n => { const c = V.cart.find(x => x.nombre === n); return c ? c.cant : 0; };

  function grid() {
    const pop = popularity(), q = parse().t.toLowerCase().trim();
    const list = S.prods.filter(p => (V.cat === 'Todas' || (V.cat === '★ Favoritos' ? V.favs.includes(p.nombre) : p.cat === V.cat)) && p.nombre.toLowerCase().includes(q))
      .sort((a, b) => (V.favs.includes(b.nombre) - V.favs.includes(a.nombre)) || ((pop[b.nombre] || 0) - (pop[a.nombre] || 0))).slice(0, 150);
    V.vis = list;
    const stk = p => p.stock == null ? '' : `<span class="stk ${p.stock <= 0 ? 'out' : p.stock <= p.min ? 'low' : ''}">${p.stock <= 0 ? 'Agotado' : p.stock + ' disp.'}</span>`;
    const fav = p => `<button class="fav" data-a="fav" data-v="${esc(p.nombre)}" aria-pressed="${V.favs.includes(p.nombre)}" aria-label="Marcar favorito">${V.favs.includes(p.nombre) ? '★' : '☆'}</button>`;
    const badge = p => inCart(p.nombre) ? `<span class="qb">×${inCart(p.nombre)}</span>` : '';
    $('#grid').innerHTML = list.map(p => V.mode === 'lista'
      ? `<div class="prow"><button class="add" data-a="add" data-v="${esc(p.nombre)}"><span class="pn"><b>${esc(p.nombre)}</b><small>${esc(p.cat)} ${stk(p)}</small></span>${badge(p)}<span class="pr">${money(p.precio)}</span></button>${fav(p)}</div>`
      : `<div class="prod"><button class="add" data-a="add" data-v="${esc(p.nombre)}"><div class="av" style="background:${hue(p.cat)}">${esc(p.nombre[0] || '?')}</div><b>${esc(p.nombre)}</b><span class="pr">${money(p.precio)}</span>${stk(p)}${badge(p)}</button>${fav(p)}</div>`).join('')
      || '<p class="mu">No hay productos con ese nombre. Prueba con otra búsqueda o categoría.</p>';
  }

  function cart() {
    $('#items').innerHTML = V.cart.map((c, i) => `<div class="line${c.nombre === V.flash ? ' flash' : ''}">
      <div class="nm">${esc(c.nombre)}</div><div class="sub">${money(c.cant * c.precio)}</div>
      <div class="qty"><button data-a="dec" data-i="${i}" aria-label="Quitar uno">−</button><b>${c.cant}</b><button data-a="inc" data-i="${i}" aria-label="Agregar uno">+</button></div>
      <div style="text-align:right">${V.edit === i
        ? `<input class="price-in" type="number" min="0" step="any" inputmode="decimal" value="${c.precio}" aria-label="Precio unitario" data-i="${i}">`
        : `<button class="btn sm ghost" data-a="edit" data-i="${i}">${money(c.precio)} c/u ✎</button>`}</div></div>`).join('')
      || '<div class="empty">El ticket está vacío.<br>Toca un producto para agregarlo.</div>';
    const p = $('.price-in'); if (p) { p.focus(); p.select(); p.onchange = e => { V.cart[+e.target.dataset.i].precio = Math.max(0, +e.target.value || 0); V.edit = -1; cart(); }; p.onblur = () => { V.edit = -1; cart(); }; }
    $('#tsub').textContent = count() ? count() + ' artículo(s) · ' + V.cart.length + ' producto(s)' : '';
    const fl = document.querySelector('.line.flash'); if (fl) fl.scrollIntoView({ block: 'nearest' }); V.flash = null;
    $('#ttl').textContent = V.ed ? 'Editando ' + V.ed.folio : V.cot ? 'Desde ' + V.cot : 'Ticket actual';
    $('#dline').textContent = dsc() > 0 ? 'Subtotal ' + money(sub()) + ' · Descuento −' + money(dsc()) : '';
    $('#dbtn').textContent = dsc() > 0 ? 'Editar descuento' : 'Descuento';
    $('#tot').textContent = money(total()); $('#ccount').textContent = count() + ' artículo(s)';
    $('#bcount').textContent = count() + ' artículo(s) · Ver ticket'; $('#btot').textContent = money(total());
  }

  function warn(n) { const p = S.prods.find(x => x.nombre === n), c = V.cart.find(x => x.nombre === n); if (p && p.stock != null && c && c.cant > p.stock) toast('Solo hay ' + p.stock + ' en existencia de ' + p.nombre + '.', true); }

  const H = {
    add(_, b, n) { n = n || 1; const p = S.prods.find(x => x.nombre === b.dataset.v), x = V.cart.find(c => c.nombre === p.nombre); x ? x.cant += n : V.cart.push({ nombre: p.nombre, cant: n, precio: p.precio, costo: p.costo }); V.flash = p.nombre; warn(p.nombre); cart(); grid(); },
    note() { $('#nbtn').hidden = true; $('#nota').hidden = false; $('#nota').focus(); },
    mode(_, b) { V.mode = b.dataset.v; store.set('mode', V.mode); views.vender.render($('#app')); },
    inc(i) { V.cart[i].cant++; warn(V.cart[i].nombre); cart(); grid(); },
    dec(i) { if (--V.cart[i].cant <= 0) V.cart.splice(i, 1); cart(); grid(); },
    edit(i) { V.edit = i; cart(); },
    fav(_, b) { const n = b.dataset.v, k = V.favs.indexOf(n); k < 0 ? V.favs.push(n) : V.favs.splice(k, 1); store.set('favs', V.favs); if (!V.favs.length && V.cat === '★ Favoritos') V.cat = 'Todas'; chips(); grid(); },
    cat(_, b) { V.cat = b.dataset.v; chips(); grid(); },
    tipo(_, b) { V.tipo = b.dataset.v; document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', x === b)); },
    clear() { reset(); go('vender'); },
    open() { $('#ticket').classList.add('open'); },
    close() { $('#ticket').classList.remove('open'); },
    pay(_, b) { save('Pagado', b.dataset.m); },
    pend() { save('Pendiente'); },
    async quote() {
      if (!V.cart.length) return toast('El ticket está vacío. Agrega un producto.', true);
      const n = V.cli.trim().toUpperCase();
      if (!n) return toast('Escribe el nombre del cliente para guardar la cotización.', true);
      const c = S.clients.find(c => c.nombre.toUpperCase() === n);
      const f = await api('saveQuote', { cliente: n, tel: c ? c.tel : '', total: total(), descuento: dsc(), items: V.cart });
      toast('Cotización ' + f + ' guardada'); reset(); await load();
    },
    disc() {
      if (!V.cart.length) return toast('Agrega productos antes de aplicar un descuento.', true);
      let t = V.dsc.t;
      modal(`<h2>Descuento</h2><div class="seg" id="dt" style="grid-template-columns:1fr 1fr"><button data-t="%" aria-pressed="${t === '%'}">Porcentaje (%)</button><button data-t="$" aria-pressed="${t === '$'}">Monto ($)</button></div>
        <input id="dv" type="number" min="0" step="any" inputmode="decimal" placeholder="Cantidad" aria-label="Cantidad del descuento" value="${V.dsc.v || ''}"><div class="mu" id="dp" aria-live="polite"></div>
        <button class="btn primary" id="dok">Aplicar descuento</button><button class="btn ghost" id="dno">Quitar descuento</button>`);
      const calc = () => { const v = +$('#dv').value || 0; return t === '%' ? sub() * v / 100 : v; };
      const prev = () => { const d = calc(); $('#dp').textContent = d > sub() + 0.001 ? 'El descuento no puede ser mayor al subtotal.' : 'Total con descuento: ' + money(sub() - Math.min(d, sub())); };
      $('#dv').oninput = prev; $('#dv').focus(); prev();
      $('#dt').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; t = b.dataset.t; $('#dt').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); prev(); };
      $('#dno').onclick = () => { V.dsc = { t: '$', v: 0 }; closeM(); cart(); };
      $('#dok').onclick = () => { const v = +$('#dv').value || 0; if (v < 0 || (t === '%' && v > 100) || calc() > sub() + 0.001) return toast('Revisa la cantidad del descuento.', true); V.dsc = { t, v }; closeM(); cart(); };
    },
    credit() { save('Pagado', 'Crédito cliente'); },
    split() {
      if (!V.cart.length) return toast('El ticket está vacío. Agrega un producto.', true);
      const R = [{ m: 'Efectivo', v: total() }], M = ['Efectivo', 'Débito', 'Transferencia'];
      const diff = () => Math.round((R.reduce((s, r) => s + (+r.v || 0), 0) - total()) * 100) / 100;
      const hint = () => {
        const d = diff(), ok = d === 0 && R.every(r => +r.v > 0);
        $('#sh').textContent = d === 0 ? '✓ Los montos cuadran con el total.' : d < 0 ? 'Falta por repartir ' + money(-d) : 'Se pasa por ' + money(d);
        $('#sh').style.color = d === 0 ? 'var(--ok)' : 'var(--bad)'; $('#sok').disabled = !ok;
      };
      const draw = () => {
        modal(`<h2>Dividir pago</h2><div class="big">${money(total())}</div>
          ${R.map((r, i) => `<div class="splitrow"><select data-i="${i}" aria-label="Método">${M.map(m => `<option value="${m}" ${m === r.m ? 'selected' : ''}>${m === 'Débito' ? 'Tarjeta' : m}</option>`).join('')}</select><input type="number" min="0" step="0.01" inputmode="decimal" data-v="${i}" value="${r.v}" aria-label="Monto"><button class="btn sm ghost" data-x="${i}" ${R.length === 1 ? 'disabled' : ''} aria-label="Quitar método">✕</button></div>`).join('')}
          <button class="btn ghost" id="sa">Agregar otro método</button><div id="sh" class="mu" aria-live="polite"></div>
          <button class="btn primary" id="sok">Confirmar cobro</button><button class="btn ghost" id="sno">Cancelar</button>`);
        hint(); $('#sno').onclick = closeM;
        $('#sa').onclick = () => { R.push({ m: M.find(m => !R.some(r => r.m === m)) || 'Efectivo', v: Math.max(0, -diff()) }); draw(); };
        $('#sok').onclick = () => { closeM(); save('Pagado', 'Multipagos: ' + R.map(r => r.m + ' ' + money(r.v)).join(' + ')); };
        $('#mbox').onclick = e => { const x = e.target.closest('[data-x]'); if (x) { R.splice(+x.dataset.x, 1); draw(); } };
        $('#mbox').oninput = e => { if (e.target.dataset.v !== undefined) { R[+e.target.dataset.v].v = Math.max(0, +e.target.value || 0); hint(); } };
        $('#mbox').onchange = e => { if (e.target.dataset.i !== undefined) R[+e.target.dataset.i].m = e.target.value; };
      };
      draw();
    },
    cash() {
      if (!V.cart.length) return toast('El ticket está vacío. Agrega un producto.', true);
      modal(`<h2>Efectivo con cambio</h2><div class="big">${money(total())}</div>
        <input id="rec" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Monto recibido" aria-label="Monto recibido">
        <div class="amounts">${[total(), 50, 100, 200, 500, 1000].map(v => `<button class="btn sm" data-q="${v}">${money(v)}</button>`).join('')}</div>
        <div id="change" aria-live="polite"></div>
        <button class="btn primary" id="okcash" disabled>Confirmar cobro</button><button class="btn ghost" id="nocash">Cancelar</button>`);
      const rec = $('#rec'), upd = () => { const r = +rec.value || 0; $('#change').textContent = r ? (r >= total() ? 'Cambio: ' + money(r - total()) : 'Faltan ' + money(total() - r)) : ''; $('#okcash').disabled = r < total(); };
      rec.oninput = upd; rec.focus();
      $('#mbox').onclick = e => { const q = e.target.closest('[data-q]'); if (q) { rec.value = q.dataset.q; upd(); } };
      $('#nocash').onclick = closeM; $('#okcash').onclick = () => { closeM(); save('Pagado', 'Efectivo'); };
    }
  };
  function onClick(e) { const b = e.target.closest('[data-a]'); if (b && H[b.dataset.a]) H[b.dataset.a](+b.dataset.i, b); }

  function reset() { V.cart = []; V.cli = ''; V.nota = ''; V.edit = -1; V.ed = null; V.cot = null; V.dsc = { t: '$', v: 0 }; }

  async function save(estado, metodo) {
    if (V.busy) return;
    if (!V.cart.length) return toast('El ticket está vacío. Agrega un producto.', true);
    if (metodo === 'Crédito cliente' && !V.cli.trim()) return toast('Escribe el nombre del cliente para registrar el crédito.', true);
    V.busy = true;
    try {
      const cot = V.cot;
      const folio = await api('saveSale', { descuento: dsc(), folio: V.ed ? V.ed.folio : undefined, fecha: V.ed ? V.ed.fecha : undefined, cliente: V.cli.trim().toUpperCase(), tipo: V.tipo, nota: V.nota, estado, metodo: estado === 'Pagado' ? metodo : 'Sin registrar', items: V.cart });
      if (cot) await api('setQuote', cot, 'Convertida');
      toast('Venta ' + folio + ' guardada'); reset(); await load();
    } finally { V.busy = false; }
  }

  /* API para otras pantallas: cargar un ticket o cotización en el carrito */
  window.Vender = {
    load(items, m) {
      V.cart = items.map(x => ({ nombre: x.nombre || x.producto, cant: +x.cant || 1, precio: +x.precio || 0, costo: +x.costo || 0 }));
      V.cli = m.cli || ''; V.nota = m.nota || ''; V.tipo = m.tipo || 'Aquí'; V.ed = m.ed || null; V.cot = m.cot || null; V.edit = -1; V.dsc = { t: '$', v: +m.desc > 0 ? +m.desc : 0 };
      go('vender'); H.open();
    }
  };
})();
