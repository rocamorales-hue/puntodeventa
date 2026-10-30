'use strict';
/* ===== Núcleo: API, estado, navegación y utilidades ===== */
const URL_API = 'https://script.google.com/macros/s/AKfycbyZsbFkMYhcfYQ8mk9Ca5ani7by_i-cFpplgzcDJyaGlj0SZmC2AdS18WiG1ZdCzZBj/exec';

const VERSION = '1.12';
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

const net = { ok: true, last: null, err: 0, loading: false };

/* Aviso de "Procesando…": bloquea toques repetidos mientras se guarda */
const LABELS = { saveSale: 'Guardando venta…', setPaid: 'Registrando cobro…', deleteSale: 'Borrando ticket…', saveQuote: 'Guardando cotización…', addPayment: 'Guardando abono…', closeWeeklyCut: 'Guardando corte…', adjustStock: 'Actualizando inventario…', setMinStock: 'Guardando mínimo…', saveClient: 'Guardando cliente…', saveProduct: 'Guardando producto…', saveConfig: 'Guardando configuración…', setQuote: 'Actualizando cotización…' };
const SILENT = { getData: 1, getConfig: 1 };
let busyN = 0, busyT;
function busy(d, label) {
  busyN += d;
  let el = $('#busy');
  if (!el) { el = document.createElement('div'); el.id = 'busy'; el.setAttribute('role', 'status'); el.hidden = true; el.innerHTML = '<div class="busybox"><span class="spin"></span><span id="busytxt"></span></div>'; document.body.appendChild(el); }
  clearTimeout(busyT);
  if (busyN > 0) { $('#busytxt').textContent = label || 'Procesando…'; busyT = setTimeout(() => el.hidden = false, 120); } else el.hidden = true;
  renderStatus();
}
async function api(fn, ...args) {
  const loud = !SILENT[fn]; if (loud) busy(1, LABELS[fn]);
  try { return await rawApi(fn, ...args); } finally { if (loud) busy(-1); }
}

/* API: google.script.run si corre dentro de Apps Script; fetch POST si está alojado aparte */
async function rawApi(fn, ...args) {
  try {
    if (window.google && google.script && google.script.run)
      return await new Promise((ok, no) => google.script.run.withSuccessHandler(ok).withFailureHandler(no)[fn](...args));
    let key = localStorage.getItem('pos_key') || '';
    if (!key) { key = prompt('Clave del POS') || ''; localStorage.setItem('pos_key', key); }
    const r = await (await fetch(URL_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn, args, key }) })).json();
    if (!r.ok) { if (/Clave/.test(r.error)) localStorage.removeItem('pos_key'); throw new Error(r.error); }
    net.ok = true; return r.data;
  } catch (e) { net.ok = !(e && e.name === 'TypeError'); net.err = Date.now(); renderStatus(); setTimeout(renderStatus, 4100); toast(e.message || 'Sin conexión. Revisa tu internet e inténtalo de nuevo.', true); throw e; }
}

/* Estado compartido y router */
const S = { prods: [], clients: [], ventas: [], cots: [] };
const views = {};
let view = 'vender';
/* Íconos de línea (estilo Lucide), heredan el color del texto */
const svg = p => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
const ICONS = {
  vender: svg('<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>'),
  ventas: svg('<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>'),
  clientes: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  mas: svg('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
  cotizaciones: svg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'),
  inventario: svg('<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
  productos: svg('<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>'),
  corte: svg('<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/><path d="M16 18h.01"/>'),
  reportes: svg('<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>'),
  configuracion: svg('<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>'),
  cafe: svg('<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>'),
  lista: svg('<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>')
};
const NAV = [['vender', 'vender', 'Vender'], ['ventas', 'ventas', 'Ventas'], ['clientes', 'clientes', 'Clientes'], ['mas', 'mas', 'Más']];
const MORE = [['cotizaciones', 'Cotizaciones'], ['inventario', 'Inventario'], ['productos', 'Productos'], ['corte', 'Corte'], ['reportes', 'Reportes'], ['configuracion', 'Configuración']];

function go(v) {
  view = v;
  $('#nav').innerHTML = '<div class="logo" aria-hidden="true">' + ICONS.cafe + '</div>' + NAV.map(n =>
    `<button data-go="${n[0]}" ${(n[0] === v || (n[0] === 'mas' && MORE.some(m => m[0] === v))) ? 'aria-current="page"' : ''}><i>${ICONS[n[1]]}</i><span>${n[2]}</span></button>`).join('');
  const root = $('#app'); root.innerHTML = '';
  if (views[v]) views[v].render(root);
  else if (v === 'mas') root.innerHTML = `<h2>Más opciones</h2><div class="menu" style="margin-top:14px">${MORE.map(m => `<button class="btn" data-go="${m[0]}">${ICONS[m[0]]}<span>${m[1]}</span></button>`).join('')}</div>`;
  else root.innerHTML = `<div class="card"><h2>Esta sección llega en la siguiente etapa</h2><p class="mu">Mientras tanto, usa tu versión anterior del POS para esta pantalla.</p></div>`;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });

async function load() {
  net.loading = true; renderStatus();
  try { Object.assign(S, await api('getData')); net.ok = true; net.last = new Date(); } finally { net.loading = false; }
  go(view); renderStatus();
}

/* Indicador flotante: verde = activo, ámbar = procesando, azul = actualizando, naranja = error, rojo = sin conexión */
function renderStatus() {
  const el = $('#sb'); if (!el) return;
  const off = !net.ok || !navigator.onLine;
  const st = off ? 'off' : Date.now() - net.err < 4000 ? 'err' : busyN > 0 ? 'busy' : net.loading ? 'sync' : 'ok';
  const lbl = { off: 'Sin conexión', err: 'Error', busy: 'Procesando…', sync: 'Actualizando…', ok: 'Activo' }[st];
  const k = t => new Date(t - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10), hoy = k(Date.now());
  const T = typeof tickets === 'function' ? tickets() : [];
  const h = T.filter(t => k(t.fecha) === hoy), pend = T.filter(t => t.estado !== 'Pagado');
  const tip = 'POS v' + VERSION + ' · ' + lbl + (net.last ? ' · actualizado ' + net.last.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '') +
    (T.length ? ' · hoy ' + money(h.reduce((s, t) => s + t.total, 0)) + ' · ' + pend.length + ' por cobrar' : '') + ' (toca para actualizar)';
  el.dataset.s = st; el.title = tip; el.setAttribute('aria-label', tip);
  el.innerHTML = '<span class="dot"></span><span class="lbl">' + lbl + '</span>';
}
$('#sb').addEventListener('click', () => { if (!busyN) load(); });
window.addEventListener('online', renderStatus); window.addEventListener('offline', renderStatus);
