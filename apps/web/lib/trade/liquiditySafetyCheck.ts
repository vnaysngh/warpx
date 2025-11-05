/**
 * Safety checks before adding liquidity
 * Prevents common mistakes that could result in bad prices
 */

export type SafetyCheckResult = {
  safe: boolean;
  warnings: string[];
  errors: string[];
  priceDeviation?: number;
};

/**
 * Comprehensive safety check before adding liquidity
 */
export function validateLiquidityAddition(params: {
  amountA: bigint;
  amountB: bigint;
  decimalsA: number;
  decimalsB: number;
  referenceReserveA?: bigint;
  referenceReserveB?: bigint;
  symbolA: string;
  symbolB: string;
}): SafetyCheckResult {
  const {
    amountA,
    amountB,
    decimalsA,
    decimalsB,
    referenceReserveA,
    referenceReserveB,
    symbolA,
    symbolB
  } = params;

  const warnings: string[] = [];
  const errors: string[] = [];

  // Check 1: Amounts are positive
  if (amountA <= 0n || amountB <= 0n) {
    errors.push('Both amounts must be greater than zero');
  }

  // Check 2: Amounts aren't suspiciously small or large
  const minAmount = 10n ** BigInt(decimalsA - 6); // At least 0.000001 tokens
  const maxAmount = 10n ** BigInt(decimalsA + 12); // Not more than 1 trillion tokens

  if (amountA < minAmount || amountB < minAmount) {
    warnings.push('Amounts are very small - may result in low liquidity');
  }

  if (amountA > maxAmount || amountB > maxAmount) {
    warnings.push('Amounts are very large - please double-check the values');
  }

  // Check 3: Decimal places match expected (no copy-paste errors)
  const amountAStr = amountA.toString();
  const amountBStr = amountB.toString();

  if (amountAStr.length !== decimalsA + 1 && amountAStr.length < decimalsA) {
    warnings.push(`${symbolA} amount may have wrong decimals (expected ${decimalsA}, got ${amountAStr.length - 1})`);
  }

  if (amountBStr.length !== decimalsB + 1 && amountBStr.length < decimalsB) {
    warnings.push(`${symbolB} amount may have wrong decimals (expected ${decimalsB}, got ${amountBStr.length - 1})`);
  }

  // Check 4: Price deviation from reference (if provided)
  let priceDeviation: number | undefined;

  if (referenceReserveA && referenceReserveB && referenceReserveA > 0n && referenceReserveB > 0n) {
    // Calculate your price ratio
    const yourRatioScaled = (amountA * 10000n * 10n**18n) / amountB;
    const refRatioScaled = (referenceReserveA * 10000n * 10n**18n) / referenceReserveB;

    // Calculate absolute deviation
    const deviation = yourRatioScaled > refRatioScaled
      ? yourRatioScaled - refRatioScaled
      : refRatioScaled - yourRatioScaled;

    priceDeviation = Number((deviation * 10000n) / refRatioScaled) / 100; // As percentage

    // More than 0.1% deviation
    if (priceDeviation > 0.1) {
      warnings.push(
        `Price deviates ${priceDeviation.toFixed(3)}% from reference AMM. ` +
        `This may create arbitrage opportunities.`
      );
    }

    // More than 1% is concerning
    if (priceDeviation > 1) {
      errors.push(
        `Price deviates ${priceDeviation.toFixed(2)}% from reference AMM! ` +
        `This will cause immediate arbitrage and loss of funds. ` +
        `Please recalculate using the exact reserves.`
      );
    }

    // More than 5% is critical
    if (priceDeviation > 5) {
      errors.push(
        '🚨 CRITICAL: Price deviation > 5%! DO NOT PROCEED! ' +
        'You likely have a decimal error or used wrong values.'
      );
    }
  }

  // Check 5: Ratio sanity check
  const ratioAtoB = Number(amountA * 10000n / amountB) / 10000;
  const ratioBtoA = Number(amountB * 10000n / amountA) / 10000;

  // Extremely skewed ratios (>1000000:1) suggest an error
  if (ratioAtoB > 1000000 || ratioBtoA > 1000000) {
    warnings.push(
      'Extreme price ratio detected. Please verify your amounts. ' +
      `Ratio: 1 ${symbolA} = ${ratioAtoB.toFixed(6)} ${symbolB}`
    );
  }

  return {
    safe: errors.length === 0,
    warnings,
    errors,
    priceDeviation
  };
}

/**
 * Format safety check result for display
 */
export function formatSafetyCheckResult(result: SafetyCheckResult): string {
  let output = '';

  if (result.errors.length > 0) {
    output += '❌ ERRORS:\n';
    result.errors.forEach(err => {
      output += `  • ${err}\n`;
    });
    output += '\n';
  }

  if (result.warnings.length > 0) {
    output += '⚠️  WARNINGS:\n';
    result.warnings.forEach(warn => {
      output += `  • ${warn}\n`;
    });
    output += '\n';
  }

  if (result.safe && result.errors.length === 0) {
    output += '✅ All safety checks passed!\n';
    if (result.priceDeviation !== undefined) {
      output += `📊 Price deviation: ${result.priceDeviation.toFixed(4)}%\n`;
    }
  }

  return output;
}

/**
 * Quick validation before transaction
 */
export function quickValidate(
  amountA: bigint,
  amountB: bigint,
  referenceReserveA: bigint,
  referenceReserveB: bigint
): boolean {
  // Must be exact match (no remainder from division)
  const calculatedB = (amountA * referenceReserveB) / referenceReserveA;

  if (calculatedB !== amountB) {
    console.error('❌ Amount B does not match the exact ratio!');
    console.error(`Expected: ${calculatedB.toString()}`);
    console.error(`Got:      ${amountB.toString()}`);
    return false;
  }

  // Verify constant product
  const leftSide = amountA * referenceReserveB;
  const rightSide = amountB * referenceReserveA;

  if (leftSide !== rightSide) {
    console.error('❌ Constant product formula not satisfied!');
    return false;
  }

  return true;
}
