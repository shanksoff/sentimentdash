/**
 * Technical indicator calculations.
 * All functions accept an array of closing prices (plain numbers)
 * and return an array of the same length.
 * Indices where there is insufficient history are returned as null.
 */

// ─── helpers ────────────────────────────────────────────────

function _ema(arr, period, startIdx = 0) {
  const n = arr.length
  const result = new Array(n).fill(null)
  if (startIdx + period > n) return result

  const k = 2 / (period + 1)
  let sum = 0
  for (let i = startIdx; i < startIdx + period; i++) sum += arr[i]
  result[startIdx + period - 1] = sum / period

  for (let i = startIdx + period; i < n; i++) {
    result[i] = arr[i] * k + result[i - 1] * (1 - k)
  }
  return result
}

// ─── Bollinger Bands (20-day, ±2σ) ─────────────────────────

/**
 * Returns an array of { mid, upper, lower } objects.
 * Values are null for the first `period - 1` indices.
 */
export function bollingerBands(closes, period = 20, mult = 2) {
  return closes.map((_, i) => {
    if (i < period - 1) return { mid: null, upper: null, lower: null }
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period
    const std = Math.sqrt(variance)
    return {
      mid:   +mean.toFixed(2),
      upper: +(mean + mult * std).toFixed(2),
      lower: +(mean - mult * std).toFixed(2),
    }
  })
}

// ─── RSI (14-day Wilder smoothing) ──────────────────────────

/**
 * Returns an array of RSI values (0–100).
 * First valid value is at index `period`.
 */
export function rsi(closes, period = 14) {
  const n = closes.length
  const result = new Array(n).fill(null)
  if (n < period + 1) return result

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) avgGain += d
    else avgLoss -= d
  }
  avgGain /= period
  avgLoss /= period

  const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss
  result[period] = +(100 - 100 / (1 + rs0)).toFixed(2)

  for (let i = period + 1; i < n; i++) {
    const d = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss
    result[i] = +(100 - 100 / (1 + rs)).toFixed(2)
  }
  return result
}

// ─── MACD (12, 26, 9) ───────────────────────────────────────

/**
 * Returns { macdLine, signalLine, histogram } — each an array of length n.
 * Values are null where there is insufficient history.
 */
export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const n = closes.length
  const emaFast = _ema(closes, fast)
  const emaSlow = _ema(closes, slow)

  // MACD line: valid from index slow - 1
  const macdLine = new Array(n).fill(null)
  for (let i = slow - 1; i < n; i++) {
    macdLine[i] = +(emaFast[i] - emaSlow[i]).toFixed(4)
  }

  // Signal: EMA(9) over the valid MACD slice
  const sigStart = slow - 1
  const macdSlice = macdLine.slice(sigStart)
  const sigK = 2 / (signal + 1)
  const sigArr = new Array(macdSlice.length).fill(null)

  let sum = 0
  for (let i = 0; i < signal; i++) sum += macdSlice[i]
  sigArr[signal - 1] = sum / signal
  for (let i = signal; i < macdSlice.length; i++) {
    sigArr[i] = macdSlice[i] * sigK + sigArr[i - 1] * (1 - sigK)
  }

  const signalLine = new Array(n).fill(null)
  for (let i = 0; i < sigArr.length; i++) {
    if (sigArr[i] != null) signalLine[sigStart + i] = +sigArr[i].toFixed(4)
  }

  const histogram = new Array(n).fill(null)
  for (let i = 0; i < n; i++) {
    if (macdLine[i] != null && signalLine[i] != null) {
      histogram[i] = +(macdLine[i] - signalLine[i]).toFixed(4)
    }
  }

  return { macdLine, signalLine, histogram }
}

// ─── Rolling annualised volatility (20-day) ─────────────────

/**
 * Returns an array of annualised volatility percentages.
 * First valid value is at index `period`.
 * Uses log returns, annualised by √252.
 */
export function rollingVolatility(closes, period = 20) {
  return closes.map((_, i) => {
    if (i < period) return null
    const slice = closes.slice(i - period + 1, i + 1)
    const logReturns = []
    for (let j = 1; j < slice.length; j++) {
      logReturns.push(Math.log(slice[j] / slice[j - 1]))
    }
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length
    const variance = logReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / logReturns.length
    return +(Math.sqrt(variance * 252) * 100).toFixed(2)
  })
}
