'use strict';
/* ===== Pantalla Vender: catálogo, ticket y cobro rápido ===== */
(() => {
  const V = { cart: [], cat: 'Todas', q: '', cli: '', tipo: 'Aquí', nota: '', edit: -1, busy: false, favs: store.get('favs', []) };
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
          <div class="t-head"><h2>Ticket actual</h2>
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
            <div class="row2">
              <button class="btn" data-a="cash">Efectivo con cambio</button>
              <button class="btn" data-a="credit">A crédito</button>
            </div>
            <button class="btn ghost" data-a="pend">Dejar pendiente</button>
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
      <button class="add" data-a="add" data-v="${esc(p.nombre)}"><div class="av" style="background:${hue(p.cat)}">${esc(p.nombre[0] || '?')}</div><b>${esc(p.nombre)}</b><span class="pr">${money(p.precio)}</span></button>
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
    $('#tot').textContent = money(total()); $('#ccount').textContent = count() + ' artículo(s)';
    $('#bcount').textContent = '🛒 ' + count() + ' artículo(s) · Ver ticket'; $('#btot').textContent = money(total());
  }

  const H = {
    add(_, b) { const p = S.prods.find(x => x.nombre === b.dataset.v), x = V.cart.find(c => c.nombre === p.nombre); x ? x.cant++ : V.cart.push({ nombre: p.nombre, cant: 1, precio: p.precio, costo: p.costo }); cart(); },
    inc(i) { V.cart[i].cant++; cart(); },
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
    credit() { save('Pagado', 'Crédito cliente'); },
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

  function reset() { V.cart = []; V.cli = ''; V.nota = ''; V.edit = -1; }

  async function save(estado, metodo) {
    if (V.busy) return;
    if (!V.cart.length) return toast('El ticket está vacío. Agrega un producto.', true);
    if (metodo === 'Crédito cliente' && !V.cli.trim()) return toast('Escribe el nombre del cliente para registrar el crédito.', true);
    V.busy = true;
    try {
      const folio = await api('saveSale', { cliente: V.cli.trim().toUpperCase(), tipo: V.tipo, nota: V.nota, estado, metodo: estado === 'Pagado' ? metodo : 'Sin registrar', items: V.cart });
      toast('Venta ' + folio + ' guardada'); reset(); await load();
    } finally { V.busy = false; }
  }
})();
