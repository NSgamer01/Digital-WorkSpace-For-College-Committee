const http = require('http');

const data = JSON.stringify({
    committeeId: '32076a09-aeb4-46d2-99ad-2d9d65e022b1',
    role: 'faculty'
});

const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/users/7b0c08b8-9426-4282-b145-dfa20b47adb8/committees',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
}, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();
