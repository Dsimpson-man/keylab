/** 通用格式化与 DOM 小工具。 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function formatTimeOfDay(date = new Date(), { withMs = false } = {}) {
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  const base = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return withMs ? `${base}.${pad(date.getMilliseconds(), 3)}` : base;
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${formatTimeOfDay(date)}`;
}

export function signed(value, unit = '') {
  const number = Math.round(Number(value) || 0);
  return `${number > 0 ? '+' : ''}${number}${unit}`;
}

export function toggleClass(element, className, force) {
  if (element) element.classList.toggle(className, Boolean(force));
}

export function setText(selector, text) {
  const element = typeof selector === 'string' ? $(selector) : selector;
  if (element) element.textContent = text;
}

export function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function timestampForFilename(prefix) {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/** 一小段安全的 HTML 文本列表。 */
export function joinPills(items, className = 'note-pill') {
  return items.map(item => `<span class="${className}">${escapeHtml(item)}</span>`).join('');
}
