/**
 * Web MIDI 适配器。
 *
 * 只负责浏览器 API：请求权限、枚举输入、监听 onmidimessage、热插拔。
 * 所有消息都交给 MidiService.ingest 规范化，不在这里做判分或 UI。
 */

import { parseMidiMessage } from './midi-normalizer.js';

export class WebMidiAdapter {
  constructor({ service, onStatusChange, onError } = {}) {
    this.id = 'web-midi';
    this.service = service;
    this.onStatusChange = onStatusChange || (() => {});
    this.onError = onError || (() => {});
    this.access = null;
    this._handler = null;
    this._stateHandler = null;
    this._supported = typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
  }

  static isSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
  }

  attach(handler) {
    this._handler = handler;
  }

  async connect() {
    if (!this._supported) {
      this.service.status = 'unsupported';
      this.onStatusChange();
      return { ok: false, reason: 'unsupported' };
    }
    if (typeof window !== 'undefined' && !window.isSecureContext && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      this.service.status = 'error';
      this.service.error = 'Web MIDI 需要安全来源（HTTPS 或 localhost）。';
      this.onStatusChange();
      return { ok: false, reason: 'insecure-context' };
    }
    this.service.status = 'connecting';
    this.onStatusChange();
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.access.onstatechange = () => this._syncInputs();
      this.service.access = this.access;
      this.service.status = 'ready';
      this._syncInputs();
      this.onStatusChange();
      return { ok: true };
    } catch (error) {
      const denied = error && (error.name === 'SecurityError' || error.name === 'NotAllowedError');
      this.service.status = denied ? 'denied' : 'error';
      this.service.error = denied ? null : (error?.message || String(error));
      this.onError(error);
      this.onStatusChange();
      return { ok: false, reason: denied ? 'denied' : 'error', error };
    }
  }

  _syncInputs() {
    if (!this.access) return;
    const inputs = Array.from(this.access.inputs.values());
    // 先把设备列表同步给服务，让 selectInput 能校验状态。
    const previousSelected = this.service.selectedId;
    this.service.setInputs(inputs.map(input => ({
      id: input.id,
      name: input.name,
      manufacturer: input.manufacturer,
      state: input.state,
      connection: input.connection
    })));
    if (!this.service.selectedId && inputs.length) {
      const firstConnected = inputs.find(input => input.state === 'connected');
      if (firstConnected) this.service.selectInput(firstConnected.id, { reason: 'auto' });
    } else if (this.service.selectedId && previousSelected === this.service.selectedId) {
      // 选中设备仍存在：确保消息处理器挂在正确的 input 上。
      this.selectInput(this.service.selectedId);
    }
  }

  /** 只监听选中的输入，避免多设备同时输入造成混淆；切换时清理旧处理器。 */
  selectInput(id) {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      if (input.id === id && input.state === 'connected') {
        input.onmidimessage = message => this._handleMessage(message, input);
      } else {
        input.onmidimessage = null;
      }
    }
  }

  _handleMessage(message, input) {
    const event = parseMidiMessage(message.data, {
      source: 'webmidi',
      deviceId: input.id,
      deviceName: input.name || 'MIDI 输入',
      channel: 1
    });
    if (event) {
      event.receivedAt = typeof message.timeStamp === 'number' ? message.timeStamp : Date.now();
      this._handler?.(event);
    }
  }

  dispose() {
    if (this.access) {
      for (const input of this.access.inputs.values()) input.onmidimessage = null;
      this.access.onstatechange = null;
    }
    this.access = null;
    this.service.access = null;
  }
}
