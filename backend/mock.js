const pool = require('./config/db');
pool.query('UPDATE responses SET canvas_data = $1::jsonb WHERE id = 144', [JSON.stringify({'input_1787816145040111': 'Nguyễn Văn Test', 'input_1787816164595230': 'Nam', 'input_178781619192176': 'TP.HCM', 'input_1787816284504977': 'RTX 4090', 'input_1787816363435564': '50000', 'input_1787816355867318': 'i9 14900k', 'input_1787816368151694': '20000'})])
.then(() => { console.log('Updated'); process.exit(0); });
