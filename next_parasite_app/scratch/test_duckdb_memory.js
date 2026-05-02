const duckdb = require('duckdb');
const db = new duckdb.Database(':memory:');

db.all("SELECT version()", (err, res) => {
    if (err) console.error("ERR:", err);
    else console.log("SUCCESS:", res);
    db.close();
});
