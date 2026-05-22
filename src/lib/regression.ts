// A tiny linear-regression model trained with gradient descent.
// This is the "learning" core of the smart estimate: instead of hand-picked
// multipliers, the weights are fit to the user's own past tasks.
// Pure math — no React, no dependencies.

export interface LinearModel {
  /** weights[0] is the intercept; weights[j + 1] multiplies feature j. */
  weights: number[]
  /** Per-feature mean, used to standardize inputs before predicting. */
  featureMean: number[]
  /** Per-feature standard deviation (0s replaced with 1 to avoid /0). */
  featureStd: number[]
}

interface FitOptions {
  iterations?: number
  learningRate?: number
  /** L2 regularization strength — keeps weights small when data is scarce. */
  l2?: number
}

/**
 * Fit `target ≈ w0 + w1·x1 + w2·x2 + …` by gradient descent.
 *
 * Features are standardized internally (shifted and scaled to mean 0,
 * std 1) so every input is on a comparable scale — that makes gradient
 * descent converge reliably and the L2 penalty fair across features.
 */
export function fitLinearRegression(
  rows: number[][],
  targets: number[],
  options: FitOptions = {},
): LinearModel {
  const iterations = options.iterations ?? 4000
  const learningRate = options.learningRate ?? 0.05
  const l2 = options.l2 ?? 0.02

  const n = rows.length
  const d = n > 0 ? rows[0].length : 0

  // --- standardize each feature column ---
  const featureMean: number[] = []
  const featureStd: number[] = []
  for (let j = 0; j < d; j++) {
    let sum = 0
    for (let i = 0; i < n; i++) sum += rows[i][j]
    const mean = sum / n
    let variance = 0
    for (let i = 0; i < n; i++) variance += (rows[i][j] - mean) ** 2
    const std = Math.sqrt(variance / n)
    featureMean.push(mean)
    // A constant column has std 0 — use 1 so we never divide by zero.
    featureStd.push(std === 0 ? 1 : std)
  }

  const standardized: number[][] = rows.map((row) =>
    row.map((value, j) => (value - featureMean[j]) / featureStd[j]),
  )

  // --- gradient descent ---
  const weights = new Array<number>(d + 1).fill(0) // weights[0] = intercept
  for (let step = 0; step < iterations; step++) {
    const grad = new Array<number>(d + 1).fill(0)
    for (let i = 0; i < n; i++) {
      let prediction = weights[0]
      for (let j = 0; j < d; j++) {
        prediction += weights[j + 1] * standardized[i][j]
      }
      const error = prediction - targets[i]
      grad[0] += error
      for (let j = 0; j < d; j++) grad[j + 1] += error * standardized[i][j]
    }
    weights[0] -= learningRate * (grad[0] / n)
    for (let j = 0; j < d; j++) {
      // Mean gradient plus the L2 penalty (the intercept is left unpenalized).
      const penalized = grad[j + 1] / n + l2 * weights[j + 1]
      weights[j + 1] -= learningRate * penalized
    }
  }

  return { weights, featureMean, featureStd }
}

/** Predict a target value for one raw (un-standardized) feature vector. */
export function predict(model: LinearModel, features: number[]): number {
  let result = model.weights[0]
  for (let j = 0; j < features.length; j++) {
    const standardized =
      (features[j] - model.featureMean[j]) / model.featureStd[j]
    result += model.weights[j + 1] * standardized
  }
  return result
}

/**
 * How much the prediction changes per one raw unit of feature `index`.
 * Useful for surfacing an interpretable number (e.g. minutes per page).
 */
export function effectPerUnit(model: LinearModel, index: number): number {
  return model.weights[index + 1] / model.featureStd[index]
}
