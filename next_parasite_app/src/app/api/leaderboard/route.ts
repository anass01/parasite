import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cachedQuery } from '@/lib/cache';

const LEADERBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface DonationRow {
    author_name: string;
    purchase_amount: string;
}

// Defined once at module level — not recreated on every request
const CONVERSION_RATES: Record<string, number> = {
    'USD': 1.0, '$': 1.0,
    '£': 1.27, 'GBP': 1.27,
    '€': 1.08, 'EUR': 1.08,
    'MAD': 0.10, 'AED': 0.27,
    'CA$': 0.73, 'CAD': 0.73,
    'CHF': 1.10, 'PLN': 0.25,
    'SAR': 0.27, 'IDR': 0.000062,
    'NZ$': 0.60, 'NZD': 0.60,
    'ZAR': 0.054,
    'A$': 0.66, 'AUD': 0.66,
    'MX$': 0.059, 'MXN': 0.059,
    'R$': 0.19, 'BRL': 0.19,
    '¥': 0.0064, 'JP¥': 0.0064,
};

// Pre-sort once
const SORTED_CURRENCIES = Object.keys(CONVERSION_RATES).sort((a, b) => b.length - a.length);

const parseAndNormalizeAmount = (amountStr: string): number => {
    if (!amountStr) return 0;
    let rate = 1.0;
    let cleaned = amountStr.trim();
    for (const symbol of SORTED_CURRENCIES) {
        if (cleaned.includes(symbol)) {
            rate = CONVERSION_RATES[symbol];
            cleaned = cleaned.replace(symbol, '').trim();
            break;
        }
    }
    const amount = parseFloat(cleaned.replace(/\s/g, '').replace(/,/g, ''));
    return isNaN(amount) ? 0 : amount * rate;
};

async function buildLeaderboard() {
    const donationsRaw = await query<DonationRow>(
        "SELECT author_name, purchase_amount FROM chat_messages WHERE purchase_amount IS NOT NULL AND purchase_amount != ''"
    );

    const leaderboardMap = new Map<string, number>();
    for (const row of donationsRaw) {
        const normalized = parseAndNormalizeAmount(row.purchase_amount);
        if (normalized > 0) {
            leaderboardMap.set(row.author_name, (leaderboardMap.get(row.author_name) ?? 0) + normalized);
        }
    }

    return Array.from(leaderboardMap.entries())
        .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }))
        .sort((a, b) => b.total - a.total);
}

export async function GET() {
    try {
        const leaderboard = await cachedQuery('leaderboard:data', LEADERBOARD_CACHE_TTL, buildLeaderboard);

        // Amounts are intentionally hidden — set total to 0 for display
        const response = leaderboard.map(entry => ({ ...entry, total: 0 }));

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Leaderboard API Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
