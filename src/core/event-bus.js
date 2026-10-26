/**
 * 极简事件总线。
 *
 * 用途：让 MIDI 服务、适配器和界面解耦。监听器抛出的异常不会阻断其他监听器。
 */
export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(type, handler) {
    if (typeof handler !== 'function') throw new TypeError('handler 必须是函数');
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(handler);
    return () => this.off(type, handler);
  }

  once(type, handler) {
    const unsubscribe = this.on(type, payload => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  off(type, handler) {
    const listeners = this._listeners.get(type);
    if (!listeners) return;
    listeners.delete(handler);
    if (listeners.size === 0) this._listeners.delete(type);
  }

  emit(type, payload) {
    const listeners = this._listeners.get(type);
    if (!listeners) return;
    for (const listener of Array.from(listeners)) {
      try {
        listener(payload);
      } catch (error) {
        // 单个订阅者失败不应影响 MIDI 事件继续分发。
        if (typeof console !== 'undefined') console.error(`[EventBus] ${type} 监听器出错`, error);
      }
    }
  }

  clear(type) {
    if (type === undefined) this._listeners.clear();
    else this._listeners.delete(type);
  }

  listenerCount(type) {
    if (type === undefined) {
      let count = 0;
      for (const listeners of this._listeners.values()) count += listeners.size;
      return count;
    }
    return this._listeners.get(type)?.size || 0;
  }
}
