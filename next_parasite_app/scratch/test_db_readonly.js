const duckdb = require('duckdb');
const dbPath = 'c:/Users/Anass/Desktop/git/parasite/db/chat.duckdb';

// Try opening with READ_ONLY mode (1)
const db = new duckdb.Database(dbPath, { "access_mode": "READ_ONLY" }, (err) => {
    if (err) {
        console.error("OPEN ERROR:", err);
        return;
    }
    console.log("DATABASE OPENED");
    db.all("SELECT COUNT(*) FROM chat_messages", (err, res) => {
        if (err) console.error("QUERY ERROR:", err);
        else console.log("QUERY SUCCESS:", res);
        db.close();
    });
});
