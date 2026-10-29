'use strict';
/* ===== Pantalla Productos ===== */
(() => {
  let q = '';
  views.productos = {
    render(root) {
      root.innerHTML = `<h2>Productos</h2>
        <div class="card" style="margin:14px 0"><div class="form">
          <input id="pc" list="pcl" placeholder="Categoría" aria-label="Categoría"><input id="pn" placeholder="Nombre del producto" aria-label="Nombre">
          <input id="pp" type="number" min="0" step="any" inputmode="decimal" placeholder="Precio de venta" aria-label="Precio"><input id="pk" type="number" min="0" step="any" inputmode="decimal" placeholder="Costo" aria-label="Costo">
          <button class="btn primary" id="add">Agregar producto</button></div>
          <datalist id="pcl">${[...new Set(S.prods.map(p => p.cat))].map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
        <input id="pq" type="search" placeholder="Buscar producto" aria-label="Buscar producto" value="${esc(q)}"><div class="list" id="pl"></div>`;
      $('#add').onclick = add;
      $('#pq').oninput = e => { q = e.target.value; list(); };
      list();
    }
  };
  function list() {
    $('#pl').innerHTML = S.prods.filter(p => (p.nombre + p.cat).toLowerCase().includes(q.toLowerCase())).slice(0, 150).map(p => {
      const m = p.precio > 0 ? Math.round((p.precio - p.costo) / p.precio * 100) : 0;
      return `<div class="card"><b>${esc(p.nombre)}</b><div class="mu">${esc(p.cat)}</div>
        <div class="tl" style="margin-top:6px"><span>Precio <b class="amt">${money(p.precio)}</b></span><span class="mu">Costo ${money(p.costo)} · Margen ${m}%</span></div></div>`;
    }).join('') || '<p class="mu">No hay productos con ese nombre.</p>';
  }
  async function add() {
    const n = $('#pn').value.trim();
    if (!n) return toast('Escribe el nombre del producto.', true);
    if (!(+$('#pp').value > 0)) return toast('Escribe un precio de venta mayor a cero.', true);
    await api('saveProduct', { cat: $('#pc').value.trim() || 'Otros', nombre: n, precio: +$('#pp').value, costo: +$('#pk').value || 0 });
    toast('Producto agregado'); load();
  }
})();
