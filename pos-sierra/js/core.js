'use strict';
/* ===== Núcleo: API, estado, navegación y utilidades ===== */
const URL_API = 'https://script.google.com/macros/s/AKfycbyZsbFkMYhcfYQ8mk9Ca5ani7by_i-cFpplgzcDJyaGlj0SZmC2AdS18WiG1ZdCzZBj/exec';

const $ = (s, r = document) => r.querySelector(s);
const money = n => '$' + (+n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

let toastTimer;
function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = err ? 'err' : ''; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 3200);
}
function modal(html) { $('#mbox').innerHTML = html; $('#modal').style.display = 'flex'; }
function closeM() { $('#modal').style.display = 'none'; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeM(); });

const net = { ok: true, last: null };

/* API: google.script.run si corre dentro de Apps Script; fetch POST si está alojado aparte */
async function api(fn, ...args) {
  try {
    if (window.google && google.script && google.script.run)
      return await new Promise((ok, no) => google.script.run.withSuccessHandler(ok).withFailureHandler(no)[fn](...args));
    let key = localStorage.getItem('pos_key') || '';
    if (!key) { key = prompt('Clave del POS') || ''; localStorage.setItem('pos_key', key); }
    const r = await (await fetch(URL_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn, args, key }) })).json();
    if (!r.ok) { if (/Clave/.test(r.error)) localStorage.removeItem('pos_key'); throw new Error(r.error); }
    net.ok = true; return r.data;
  } catch (e) { net.ok = false; renderStatus(); toast(e.message || 'Sin conexión. Revisa tu internet e inténtalo de nuevo.', true); throw e; }
}

/* Estado compartido y router */
const S = { prods: [], clients: [], ventas: [], cots: [] };
const views = {};
let view = 'vender';
const NAV = [['vender', '🧾', 'Vender'], ['ventas', '📋', 'Ventas'], ['clientes', '👥', 'Clientes'], ['mas', '⋯', 'Más']];
const MORE = [['cotizaciones', 'Cotizaciones'], ['productos', 'Productos'], ['corte', 'Corte'], ['reportes', 'Reportes'], ['configuracion', 'Configuración']];

function go(v) {
  view = v;
  $('#nav').innerHTML = '<div class="logo">☕</div>' + NAV.map(n =>
    `<button data-go="${n[0]}" ${(n[0] === v || (n[0] === 'mas' && MORE.some(m => m[0] === v))) ? 'aria-current="page"' : ''}><i>${n[1]}</i>${n[2]}</button>`).join('');
  const root = $('#app'); root.innerHTML = '';
  if (views[v]) views[v].render(root);
  else if (v === 'mas') root.innerHTML = `<h2>Más opciones</h2><div class="menu" style="margin-top:14px">${MORE.map(m => `<button class="btn" data-go="${m[0]}">${m[1]}</button>`).join('')}</div>`;
  else root.innerHTML = `<div class="card"><h2>Esta sección llega en la siguiente etapa</h2><p class="mu">Mientras tanto, usa tu versión anterior del POS para esta pantalla.</p></div>`;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });

async function load() { Object.assign(S, await api('getData')); net.ok = true; net.last = new Date(); go(view); renderStatus(); }

/* Barra de estado discreta: conexión, última actualización, ventas de hoy y por cobrar */
function renderStatus() {
  const sb = $('#sb'); if (!sb) return;
  const k = t => new Date(t - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10), hoy = k(Date.now());
  const T = typeof tickets === 'function' ? tickets() : [];
  const h = T.filter(t => k(t.fecha) === hoy), pend = T.filter(t => t.estado !== 'Pagado');
  const on = net.ok && navigator.onLine;
  sb.innerHTML = `<span class="dot ${on ? 'on' : 'off'}"></span><span>${on ? 'Conectado' : 'Sin conexión'}</span>` +
    (net.last ? `<span>Actualizado ${net.last.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>` : '') +
    (T.length ? `<span>Hoy ${money(h.reduce((s, t) => s + t.total, 0))} · ${h.length} tickets</span><span>${pend.length} por cobrar</span>` : '') +
    '<button id="sbr" aria-label="Actualizar datos" title="Actualizar datos">↻</button>';
  $('#sbr').onclick = () => load();
}
window.addEventListener('online', renderStatus); window.addEventListener('offline', renderStatus);
