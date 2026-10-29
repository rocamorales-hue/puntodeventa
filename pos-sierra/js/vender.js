'use strict';
/* ===== Pantalla Vender: catálogo, ticket y cobro rápido ===== */
(() => {
  const V = { cart: [], cat: 'Todas', q: '', cli: '', tipo: 'Aquí', nota: '', edit: -1, busy: false, ed: null, cot: null, favs: store.get('favs', []) };
  const total = () => V.cart.reduce((s, i) => s + i.cant * i.precio, 0);
  const count = () => V.cart.reduce((s, i) => s + i.cant, 0);
  const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return `hsl(${h} 40% 38%)`; };

  function popularity() {
    const m = {}; S.ventas.forEach(v => m[v.producto] = (m[v.producto] || 0) + v.cant); return m;
  }

  views.vender = {
    render(root) {
      root.innerHTML = `<div class="pos">
        <section class="catalog">
          <input id="q" type="search" placeholder="Buscar producto" aria-label="Buscar producto" value="${esc(V.q)}">
          <div class="chips" id="chips"></div>
          <div class="grid" id="grid"></div>
        </section>
        <aside class="ticket" id="ticket" aria-label="Ticket actual">
          <div class="t-head"><h2 id="ttl">Ticket actual</h2>
            <span><button class="btn sm ghost" data-a="clear">Vaciar</button> <button class="btn sm ghost t-close" data-a="close">Cerrar</button></span></div>
          <div class="t-fields">
            <input id="cli" list="cl" placeholder="Cliente (opcional)" aria-label="Cliente" value="${esc(V.cli)}" autocomplete="off">
            <datalist id="cl">${S.clients.map(c => `<option value="${esc(c.nombre)}">`).join('')}</datalist>
            <div class="seg" role="group" aria-label="Tipo de servicio">${['Aquí', 'Para llevar', 'Domicilio'].map(t =>
              `<button data-a="tipo" data-v="${t}" aria-pressed="${t === V.tipo}">${t}</button>`).join('')}</div>
            <input id="nota" placeholder="Nota del pedido (dirección, mesa…)" aria-label="Nota del pedido" value="${esc(V.nota)}">
          </div>
          <div class="items" id="items"></div>
          <div class="t-foot">
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
      $('#cli').oninput = e => V.cli = e.target.value;
      $('#nota').oninput = e => V.nota = e.target.value;
      chips(); grid(); cart();
    }
  };

  function chips() {
    const cats = ['Todas', ...new Set(S.prods.map(p => p.cat))];
    $('#chips').innerHTML = cats.map(c => `<button class="chip" data-a="cat" data-v="${esc(c)}" aria-pressed="${c === V.cat}">${esc(c)}</button>`).join('');
  }

  function grid() {
    const pop = popularity(), q = V.q.toLowerCase();
    const list = S.prods.filter(p => (V.cat === 'Todas' || p.cat === V.cat) && p.nombre.toLowerCase().includes(q))
      .sort((a, b) => (V.favs.includes(b.nombre) - V.favs.includes(a.nombre)) || ((pop[b.nombre] || 0) - (pop[a.nombre] || 0))).slice(0, 120);
    $('#grid').innerHTML = list.map(p => `<div class="prod">
      <button class="add" data-a="add" data-v="${esc(p.nombre)}"><div class="av" style="background:${hue(p.cat)}">${esc(p.nombre[0] || '?')}</div><b>${esc(p.nombre)}</b><span class="pr">${money(p.precio)}</span>${p.stock == null ? '' : `<span class="stk ${p.stock <= 0 ? 'out' : p.stock <= p.min ? 'low' : ''}">${p.stock <= 0 ? 'Agotado' : p.stock + ' disponibles'}</span>`}</button>
      <button class="fav" data-a="fav" data-v="${esc(p.nombre)}" aria-pressed="${V.favs.includes(p.nombre)}" aria-label="Marcar favorito">${V.favs.includes(p.nombre) ? '★' : '☆'}</button></div>`).join('')
      || '<p class="mu">No hay productos con ese nombre. Prueba con otra búsqueda o categoría.</p>';
  }

  function cart() {
    $('#items').innerHTML = V.cart.map((c, i) => `<div class="line">
      <div class="nm">${esc(c.nombre)}</div><div class="sub">${money(c.cant * c.precio)}</div>
      <div class="qty"><button data-a="dec" data-i="${i}" aria-label="Quitar uno">−</button><b>${c.cant}</b><button data-a="inc" data-i="${i}" aria-label="Agregar uno">+</button></div>
      <div style="text-align:right">${V.edit === i
        ? `<input class="price-in" type="number" min="0" step="any" inputmode="decimal" value="${c.precio}" aria-label="Precio unitario" data-i="${i}">`
        : `<button class="btn sm ghost" data-a="edit" data-i="${i}">${money(c.precio)} c/u ✎</button>`}</div></div>`).join('')
      || '<div class="empty">El ticket está vacío.<br>Toca un producto para agregarlo.</div>';
    const p = $('.price-in'); if (p) { p.focus(); p.select(); p.onchange = e => { V.cart[+e.target.dataset.i].precio = Math.max(0, +e.target.value || 0); V.edit = -1; cart(); }; p.onblur = () => { V.edit = -1; cart(); }; }
    $('#ttl').textContent = V.ed ? 'Editando ' + V.ed.folio : V.cot ? 'Desde ' + V.cot : 'Ticket actual';
    $('#tot').textContent = money(total()); $('#ccount').textContent = count() + ' artículo(s)';
    $('#bcount').textContent = '🛒 ' + count() + ' artículo(s) · Ver ticket'; $('#btot').textContent = money(total());
  }

  function warn(n) { const p = S.prods.find(x => x.nombre === n), c = V.cart.find(x => x.nombre === n); if (p && p.stock != null && c && c.cant > p.stock) toast('Solo hay ' + p.stock + ' en existencia de ' + p.nombre + '.', true); }

  const H = {
    add(_, b) { const p = S.prods.find(x => x.nombre === b.dataset.v), x = V.cart.find(c => c.nombre === p.nombre); x ? x.cant++ : V.cart.push({ nombre: p.nombre, cant: 1, precio: p.precio, costo: p.costo }); warn(p.nombre); cart(); },
    inc(i) { V.cart[i].cant++; warn(V.cart[i].nombre); cart(); },
    dec(i) { if (--V.cart[i].cant <= 0) V.cart.splice(i, 1); cart(); },
    edit(i) { V.edit = i; cart(); },
    fav(_, b) { const n = b.dataset.v, k = V.favs.indexOf(n); k < 0 ? V.favs.push(n) : V.favs.splice(k, 1); store.set('favs', V.favs); grid(); },
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
      const f = await api('saveQuote', { cliente: n, tel: c ? c.tel : '', total: total(), items: V.cart });
      toast('Cotización ' + f + ' guardada'); reset(); await load();
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

  function reset() { V.cart = []; V.cli = ''; V.nota = ''; V.edit = -1; V.ed = null; V.cot = null; }

  async function save(estado, metodo) {
    if (V.busy) return;
    if (!V.cart.length) return toast('El ticket está vacío. Agrega un producto.', true);
    if (metodo === 'Crédito cliente' && !V.cli.trim()) return toast('Escribe el nombre del cliente para registrar el crédito.', true);
    V.busy = true;
    try {
      const cot = V.cot;
      const folio = await api('saveSale', { folio: V.ed ? V.ed.folio : undefined, fecha: V.ed ? V.ed.fecha : undefined, cliente: V.cli.trim().toUpperCase(), tipo: V.tipo, nota: V.nota, estado, metodo: estado === 'Pagado' ? metodo : 'Sin registrar', items: V.cart });
      if (cot) await api('setQuote', cot, 'Convertida');
      toast('Venta ' + folio + ' guardada'); reset(); await load();
    } finally { V.busy = false; }
  }

  /* API para otras pantallas: cargar un ticket o cotización en el carrito */
  window.Vender = {
    load(items, m) {
      V.cart = items.map(x => ({ nombre: x.nombre || x.producto, cant: +x.cant || 1, precio: +x.precio || 0, costo: +x.costo || 0 }));
      V.cli = m.cli || ''; V.nota = m.nota || ''; V.tipo = m.tipo || 'Aquí'; V.ed = m.ed || null; V.cot = m.cot || null; V.edit = -1;
      go('vender'); H.open();
    }
  };
})();
