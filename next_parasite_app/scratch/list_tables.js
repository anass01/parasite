const duckdb = require('duckdb');
const path = require('path');
const db = new duckdb.Database(path.resolve(__dirname, '../../db/chat.duckdb'));

db.all("SELECT table_name FROM information_schema.tables", (err, res) => {
    if (err) console.error(err);
    else console.log(res);
    db.close();
});
