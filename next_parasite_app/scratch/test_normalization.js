const CONVERSION_RATES = {
    'USD': 1.0,
    '$': 1.0,
    '£': 1.27,
    'GBP': 1.27,
    '€': 1.08,
    'EUR': 1.08,
    'MAD': 0.10,
    'AED': 0.27,
    'CA$': 0.73,
    'CAD': 0.73,
    'CHF': 1.10,
    'PLN': 0.25,
    'SAR': 0.27,
    'IDR': 0.000062,
    'NZ$': 0.60,
    'NZD': 0.60,
    'ZAR': 0.054,
    'A$': 0.66,
    'AUD': 0.66,
    'MX$': 0.059,
    'MXN': 0.059,
    'R$': 0.19,
    'BRL': 0.19,
    '¥': 0.0064,
    'JP¥': 0.0064,
};

const parseAndNormalizeAmount = (amountStr) => {
    if (!amountStr) return 0;
    let rate = 1.0;
    let cleanedStr = amountStr.trim();
    const sortedCurrencies = Object.keys(CONVERSION_RATES).sort((a, b) => b.length - a.length);
    for (const symbol of sortedCurrencies) {
        if (cleanedStr.includes(symbol)) {
            rate = CONVERSION_RATES[symbol];
            cleanedStr = cleanedStr.replace(symbol, '').trim();
            break;
        }
    }
    const numericStr = cleanedStr.replace(/\s/g, '').replace(/,/g, '');
    const amount = parseFloat(numericStr);
    return isNaN(amount) ? 0 : amount * rate;
};

const testCases = [
    { input: "$30.00", expected: 30.00 },
    { input: "£5.00", expected: 6.35 },
    { input: "MAD 200.00", expected: 20.00 },
    { input: "CA$5.00", expected: 3.65 },
    { input: "IDR 1,000,000", expected: 62.00 },
    { input: "AED 17.99", expected: 4.8573 },
    { input: "€25.00", expected: 27.00 },
];

testCases.forEach(tc => {
    const result = parseAndNormalizeAmount(tc.input);
    console.log(`Input: ${tc.input.padEnd(15)} | Result: ${result.toFixed(4).padEnd(10)} | Expected: ${tc.expected.toFixed(4)} | Pass: ${Math.abs(result - tc.expected) < 0.01}`);
});
