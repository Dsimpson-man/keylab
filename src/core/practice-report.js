/**
 * 练习报告分析器（纯逻辑，可单测）。
 *
 * 输入一次练习中「正确按键」的记录序列（note / velocity / timestamp），
 * 输出力度均匀度与节奏稳定度的量化结果。
 *
 * 这是「从弹对到弹好」的基础：课程只判正确性，这里进一步衡量演奏质量。
 */

/**
 * @param {Array<{note:number, velocity:number, timestamp:number}>} records 按时间排序的正确按键记录。
 * @param {object} options
 * @param {number} options.tempoBpm 期望速度，用于把间隔换算成节拍偏差（可选）。
 */
export function analyzePractice(records, { tempoBpm = null } = {}) {
  const valid = (records || []).filter(r => r && Number.isFinite(r.velocity) && Number.isFinite(r.timestamp));
  if (!valid.length) return null;

  const velocities = valid.map(r => r.velocity);
  const mean = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
  const variance = velocities.reduce((sum, v) => sum + (v - mean) ** 2, 0) / velocities.length;
  const stddev = Math.sqrt(variance);

  // 力度均匀度：标准差相对均值的比例，越低越均匀。
  const evenness = mean > 0 ? Math.max(0, Math.min(100, Math.round((1 - stddev / mean) * 100))) : 100;

  // 节奏稳定度：相邻按键间隔的标准差。
  let meanIntervalMs = null;
  let tempoStabilityMs = null;
  if (valid.length >= 2) {
    const intervals = [];
    for (let i = 1; i < valid.length; i += 1) {
      intervals.push(valid[i].timestamp - valid[i - 1].timestamp);
    }
    const meanInterval = intervals.reduce((sum, iv) => sum + iv, 0) / intervals.length;
    meanIntervalMs = Math.round(meanInterval);
    const intervalVariance = intervals.reduce((sum, iv) => sum + (iv - meanInterval) ** 2, 0) / intervals.length;
    tempoStabilityMs = Math.round(Math.sqrt(intervalVariance));
  }

  const report = {
    noteCount: valid.length,
    meanVelocity: Math.round(mean),
    velocityStddev: Math.round(stddev),
    evennessPercent: evenness,
    meanIntervalMs,
    tempoStabilityMs
  };

  // 若有期望速度，给出期望间隔与平均偏差（毫秒）。
  if (tempoBpm && Number.isFinite(tempoBpm) && tempoBpm > 0 && valid.length >= 2) {
    const expectedInterval = 60000 / tempoBpm;
    const intervals = [];
    for (let i = 1; i < valid.length; i += 1) {
      intervals.push(valid[i].timestamp - valid[i - 1].timestamp);
    }
    const meanInterval = intervals.reduce((s, iv) => s + iv, 0) / intervals.length;
    report.expectedIntervalMs = Math.round(expectedInterval);
    report.meanTempoErrorMs = Math.round(meanInterval - expectedInterval);
  }

  return report;
}

/** 把报告转成中文反馈文本（用于完成后的提示）。 */
export function describePractice(report) {
  if (!report) return '还没有可分析的按键记录。';
  const lines = [];
  lines.push(`共 ${report.noteCount} 个音，平均力度 ${report.meanVelocity}（127 为满）。`);
  if (report.velocityStddev !== undefined) {
    lines.push(report.evennessPercent >= 90
      ? `力度非常均匀（均匀度 ${report.evennessPercent}%）。`
      : report.evennessPercent >= 75
        ? `力度比较均匀（均匀度 ${report.evennessPercent}%），可再稳定一些。`
        : `力度波动较大（均匀度 ${report.evennessPercent}%），建议放慢速度控制触键。`);
  }
  if (report.tempoStabilityMs !== null) {
    lines.push(report.tempoStabilityMs <= 60
      ? `节奏稳定（间隔波动约 ±${report.tempoStabilityMs} 毫秒）。`
      : `节奏有些起伏（间隔波动约 ±${report.tempoStabilityMs} 毫秒），建议跟着节拍器练。`);
  }
  if (report.meanTempoErrorMs !== undefined) {
    const err = report.meanTempoErrorMs;
    if (Math.abs(err) <= 40) lines.push('整体速度与目标一致。');
    else lines.push(err > 0 ? `整体偏慢约 ${err} 毫秒。` : `整体偏快约 ${Math.abs(err)} 毫秒。`);
  }
  return lines.join(' ');
}
