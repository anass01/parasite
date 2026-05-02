const duckdb = require('duckdb');
const path = require('path');

async function run() {
    const dbPath = path.resolve(__dirname, '../../db/chat.duckdb');
    console.log(`Connecting to: ${dbPath}`);
    
    try {
        const db = new duckdb.Database(dbPath, { "access_mode": "READ_ONLY" });
        
        db.all("SELECT purchase_amount, COUNT(*) as count FROM chat_messages WHERE purchase_amount IS NOT NULL AND purchase_amount != '' GROUP BY purchase_amount LIMIT 20", (err, res) => {
            if (err) {
                console.error("Query error:", err);
            } else {
                console.log("Sample Donations:");
                console.log(JSON.stringify(res, null, 2));
            }
            db.close();
        });
    } catch (e) {
        console.error("Database connection error:", e);
    }
}

run();
