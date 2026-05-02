const duckdb = require('duckdb');
const path = require('path');
const dbPath = 'c:/Users/Anass/Desktop/git/parasite/db/chat.duckdb';
const db = new duckdb.Database(dbPath);

db.all("SELECT COUNT(*) FROM chat_messages", (err, res) => {
    if (err) {
        console.error("QUERY ERROR:", err);
    } else {
        console.log("QUERY SUCCESS:", res);
    }
    db.close();
});
