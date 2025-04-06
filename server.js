const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.PORT || 3000; // Glitch dùng PORT từ env
const jsonFilePath = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/read', async (req, res) => {
    try {
        const data = await fs.readFile(jsonFilePath, 'utf8');
        const jsonData = JSON.parse(data);
        res.json(jsonData);
    } catch (error) {
        res.status(500).json({ error: 'Không thể đọc file JSON' });
    }
});

app.post('/write', async (req, res) => {
    try {
        const newData = req.body;
        const jsonString = JSON.stringify(newData, null, 2);
        await fs.writeFile(jsonFilePath, jsonString, 'utf8');
        res.json({ success: true, message: 'Ghi file thành công' });
    } catch (error) {
        res.status(500).json({ error: 'Không thể ghi file JSON' });
    }
});

app.listen(port, () => {
    console.log(`Server chạy tại port ${port}`);
});