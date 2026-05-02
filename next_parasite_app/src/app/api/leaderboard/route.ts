import { NextResponse } from 'next/server';
import duckdb from 'duckdb';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), '../db/chat.duckdb');

export async function GET() {
    // Open in READ_ONLY mode to allow multiple concurrent readers
    const db = new duckdb.Database(DB_PATH, { "access_mode": "READ_ONLY" });

    const query = (sql: string): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            db.all(sql, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    };

    const CONVERSION_RATES: Record<string, number> = {
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
        '¥': 0.0064, // JPY
        'JP¥': 0.0064,
    };

    const parseAndNormalizeAmount = (amountStr: string): number => {
        if (!amountStr) return 0;

        // Try to find the currency
        let rate = 1.0;
        let cleanedStr = amountStr.trim();

        // Sort keys by length descending to match CA$ before $
        const sortedCurrencies = Object.keys(CONVERSION_RATES).sort((a, b) => b.length - a.length);

        for (const symbol of sortedCurrencies) {
            if (cleanedStr.includes(symbol)) {
                rate = CONVERSION_RATES[symbol];
                cleanedStr = cleanedStr.replace(symbol, '').trim();
                break;
            }
        }

        // Remove thousands separators (commas or spaces) and handle decimal dot
        // We assume dot is decimal and comma is thousands based on sampled data
        const numericStr = cleanedStr.replace(/\s/g, '').replace(/,/g, '');
        const amount = parseFloat(numericStr);

        return isNaN(amount) ? 0 : amount * rate;
    };

    try {
        const donationsRaw = await query("SELECT author_name, purchase_amount FROM chat_messages WHERE purchase_amount IS NOT NULL AND purchase_amount != ''");

        const leaderboardMap = new Map();

        donationsRaw.forEach(row => {
            const name = row.author_name;
            const normalizedAmount = parseAndNormalizeAmount(row.purchase_amount);

            if (normalizedAmount > 0) {
                const current = leaderboardMap.get(name) || 0;
                leaderboardMap.set(name, current + normalizedAmount);
            }
        });

        const leaderboard = Array.from(leaderboardMap.entries())
            .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }))
            .sort((a, b) => b.total - a.total)

        return NextResponse.json(leaderboard);
    } catch (error: any) {
        console.error("Leaderboard API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        db.close();
    }
}
