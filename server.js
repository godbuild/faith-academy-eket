const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Directories
const FA_DIR = path.join(__dirname);
const MEDIA_DIR = path.join(FA_DIR, 'media');
const INDEX_HTML = path.join(FA_DIR, 'index.html');
const CLIENTS_FILE = path.join(FA_DIR, 'clients.txt');

// Ensure media directory exists
if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// Multer setup for uploads
const upload = multer({ dest: MEDIA_DIR });

// Helper to get IP
function getIP(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
}

// Track clients in memory for active status
let clients = {}; // { ip: lastAccess }
const ACTIVE_TIMEOUT = 10 * 60 * 1000; // 10 minutes for "active" status

// Log client to clients.txt and update memory
function logClient(ip) {
    const now = new Date();
    clients[ip] = now;
    const logEntry = `${ip} - ${now.toISOString()}\n`;
    // Only log if not already in file (first access)
    let alreadyLogged = false;
    if (fs.existsSync(CLIENTS_FILE)) {
        const lines = fs.readFileSync(CLIENTS_FILE, 'utf8').split('\n');
        alreadyLogged = lines.some(line => line.startsWith(ip + ' -'));
    }
    if (!alreadyLogged) {
        fs.appendFileSync(CLIENTS_FILE, logEntry);
    }
}

// Serve index.html
app.get('/', (req, res) => {
    logClient(getIP(req));
    res.sendFile(INDEX_HTML);
});

// Serve media files statically
app.use('/media', express.static(MEDIA_DIR));

// File upload form (for you, the creator)
app.get('/upload', (req, res) => {
    logClient(getIP(req));
    res.send(`
        <h2>Upload Image to Media Folder</h2>
        <form action="/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="file" multiple>
            <button type="submit">Upload</button>
        </form>
        <a href="/">Home</a>
    `);
});

// Handle uploads
app.post('/upload', upload.array('file'), (req, res) => {
    logClient(getIP(req));
    res.send('Upload successful! <a href="/upload">Upload more</a> | <a href="/">Home</a>');
});

// Dashboard
app.get('/dashboard', (req, res) => {
    logClient(getIP(req));
    // Read all clients from file
    let allClients = [];
    if (fs.existsSync(CLIENTS_FILE)) {
        allClients = fs.readFileSync(CLIENTS_FILE, 'utf8')
            .split('\n')
            .filter(line => line)
            .map(line => {
                const [ip, timestamp] = line.split(' - ');
                return { ip, timestamp };
            });
    }
    // Get currently active clients
    const now = Date.now();
    const activeClients = [];
    Object.entries(clients).forEach(([ip, date]) => {
        if (now - date.getTime() < ACTIVE_TIMEOUT) {
            activeClients.push({ ip, timestamp: date.toISOString() });
        }
    });

    res.send(`
        <h2>Active Clients (last ${ACTIVE_TIMEOUT / 60000} min)</h2>
        <ul>
            ${activeClients.map(c => `<li>${c.ip} - ${c.timestamp}</li>`).join('')}
        </ul>
        <h2>All Clients</h2>
        <ul>
            ${allClients.map(c => `<li>${c.ip} - ${c.timestamp}</li>`).join('')}
        </ul>
        <a href="/">Home</a>
    `);
});

app.listen(PORT, () => {
    console.log(`Faith Academy, Eket Server running at http://localhost:${PORT}`);
});