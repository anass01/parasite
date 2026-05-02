const duckdb = require('duckdb');
const path = require('path');

async function run() {
    const dbPath = path.resolve(__dirname, '../../db/chat.duckdb');
    try {
        const db = new duckdb.Database(dbPath, { "access_mode": "READ_ONLY" });
        db.all("SELECT DISTINCT purchase_amount FROM chat_messages WHERE purchase_amount IS NOT NULL AND purchase_amount != '' LIMIT 100", (err, res) => {
            if (err) console.error(err);
            else {
                console.log("Distinct Donation Strings:");
                console.log(res.map(r => r.purchase_amount).join(' | '));
            }
            db.close();
        });
    } catch (e) {
        console.error(e);
    }
}

run();
