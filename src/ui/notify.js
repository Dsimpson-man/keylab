/** Toast 与模态框。模态框替代 window.confirm，支持键盘 Esc 与焦点管理。 */

import { $, escapeHtml } from './format.js';

let toastTimer = null;

export function showToast(message, { tone = 'default', duration = 2800 } = {}) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
  element.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => element.classList.remove('show'), duration);
}

let modalResolver = null;

export function closeModal(result = null) {
  const root = $('#modal-root');
  if (!root || root.hidden) return;
  root.hidden = true;
  document.body.classList.remove('modal-open');
  const resolver = modalResolver;
  modalResolver = null;
  if (resolver) resolver(result);
}

/** 打开一个模态框，返回 Promise：点击主按钮 resolve(true)，取消 / Esc resolve(false)。 */
export function openModal({ title, bodyHtml = '', confirmLabel = '确定', cancelLabel = '取消', tone = 'default', showCancel = true, wide = false } = {}) {
  const root = $('#modal-root');
  if (!root) return Promise.resolve(false);
  if (modalResolver) closeModal(false);
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  const actions = $('#modal-actions');
  actions.innerHTML = `
    ${showCancel ? `<button class="btn btn-ghost" data-action="cancel-modal">${escapeHtml(cancelLabel)}</button>` : ''}
    <button class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}" data-action="confirm-modal">${escapeHtml(confirmLabel)}</button>`;
  root.querySelector('.modal').classList.toggle('modal-wide', Boolean(wide));
  root.hidden = false;
  document.body.classList.add('modal-open');
  window.setTimeout(() => actions.querySelector('[data-action="confirm-modal"]')?.focus(), 30);
  return new Promise(resolve => { modalResolver = resolve; });
}

export function confirmDialog({ title, bodyHtml, confirmLabel = '确定', cancelLabel = '取消', tone = 'default' }) {
  return openModal({ title, bodyHtml, confirmLabel, cancelLabel, tone });
}

export function initModalBindings() {
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#modal-root')?.hidden) closeModal(false);
  });
}
