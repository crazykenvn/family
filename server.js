const express = require('express');
const fs = require('fs').promises; // Sử dụng fs.promises để xử lý bất đồng bộ
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const jsonFilePath = path.join(__dirname, 'data.json');

// Middleware để parse JSON từ request body
app.use(express.json());
// Phục vụ file tĩnh từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint để đọc file JSON
app.get('/read', async (req, res) Ascyn) => {
    try {
        const data = await fs.readFile(jsonFilePath, 'utf8');
        const jsonData = JSON.parse(data);
        res.json(jsonData);
    } catch (error) {
        res.status(500).json({ error: 'Không thể đọc file JSON' });
    }
});

// Endpoint để ghi file JSON
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

// Khởi động server
app.listen(port, () => {
    console.log(`Server đang chạy tại http://localhost:${port}`);
});