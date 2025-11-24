/**
 * Test to verify locale-specific decimal separator bug is fixed
 */

import { formatNumber, NumberType } from './formatNumbers';

describe('formatNumbers - Locale Bug Fix', () => {
  const testValue = 60738.7;

  test('TokenTx should always use period decimal separator regardless of locale', () => {
    // Test with German locale (uses comma as decimal separator)
    const germanFormatted = formatNumber({
      input: testValue,
      type: NumberType.TokenTx,
      locale: 'de-DE'
    });

    // Should use period (en-US style) not comma, to be compatible with parseUnits()
    expect(germanFormatted).not.toContain(',');
    expect(germanFormatted).toContain('.');
    console.log('German locale (de-DE):', germanFormatted);
  });

  test('TokenTx should use period for French locale', () => {
    const frenchFormatted = formatNumber({
      input: testValue,
      type: NumberType.TokenTx,
      locale: 'fr-FR'
    });

    expect(frenchFormatted).not.toContain(',');
    expect(frenchFormatted).toContain('.');
    console.log('French locale (fr-FR):', frenchFormatted);
  });

  test('TokenTx should use period for Spanish locale', () => {
    const spanishFormatted = formatNumber({
      input: testValue,
      type: NumberType.TokenTx,
      locale: 'es-ES'
    });

    expect(spanishFormatted).not.toContain(',');
    expect(spanishFormatted).toContain('.');
    console.log('Spanish locale (es-ES):', spanishFormatted);
  });

  test('LPToken should also use period decimal separator', () => {
    const germanFormatted = formatNumber({
      input: testValue,
      type: NumberType.LPToken,
      locale: 'de-DE'
    });

    expect(germanFormatted).not.toContain(',');
    expect(germanFormatted).toContain('.');
    console.log('LP Token German locale:', germanFormatted);
  });

  test('parseUnits compatibility check', () => {
    // Simulate the actual flow
    const formatted = formatNumber({
      input: 60738.7,
      type: NumberType.TokenTx,
      locale: 'de-DE'
    });

    // This should NOT throw an error
    const { parseUnits } = require('ethers');
    expect(() => {
      parseUnits(formatted, 18);
    }).not.toThrow();

    console.log('Formatted value:', formatted);
    console.log('parseUnits succeeded!');
  });

  test('Non-transaction types can still use locale-specific formatting', () => {
    // TokenNonTx should respect locale for display purposes
    const germanDisplay = formatNumber({
      input: 1234.56,
      type: NumberType.TokenNonTx,
      locale: 'de-DE'
    });

    // This is OK to have comma since it's just for display, not transactions
    console.log('Display format (non-tx, de-DE):', germanDisplay);
  });
});

// Manual test you can run in Node
if (require.main === module) {
  console.log('\n=== Manual Locale Test ===\n');

  const testLocales = ['en-US', 'de-DE', 'fr-FR', 'es-ES', 'it-IT'];
  const testValue = 60738.7;

  console.log('Testing value:', testValue);
  console.log('\n--- TokenTx (Transaction) Format ---');
  testLocales.forEach(locale => {
    const result = formatNumber({
      input: testValue,
      type: NumberType.TokenTx,
      locale
    });
    console.log(`${locale}: ${result}`);
  });

  console.log('\n--- TokenNonTx (Display) Format ---');
  testLocales.forEach(locale => {
    const result = formatNumber({
      input: testValue,
      type: NumberType.TokenNonTx,
      locale
    });
    console.log(`${locale}: ${result}`);
  });

  // Test parseUnits compatibility
  console.log('\n--- parseUnits Compatibility Test ---');
  const { parseUnits } = require('ethers');
  testLocales.forEach(locale => {
    const formatted = formatNumber({
      input: testValue,
      type: NumberType.TokenTx,
      locale
    });
    try {
      const wei = parseUnits(formatted, 18);
      console.log(`✅ ${locale}: ${formatted} → parseUnits succeeded`);
    } catch (error) {
      console.log(`❌ ${locale}: ${formatted} → parseUnits FAILED: ${error.message}`);
    }
  });
}
