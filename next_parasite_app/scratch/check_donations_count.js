const duckdb = require('duckdb');
const path = require('path');

async function run() {
    const dbPath = path.resolve(__dirname, '../../db/chat.duckdb');
    try {
        const db = new duckdb.Database(dbPath, { "access_mode": "READ_ONLY" });
        db.all("SELECT COUNT(*) as count FROM chat_messages WHERE purchase_amount IS NOT NULL AND purchase_amount != ''", (err, res) => {
            if (err) console.error(err);
            else console.log(res);
            db.close();
        });
    } catch (e) {
        console.error(e);
    }
}

run();
