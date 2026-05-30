const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);
const DATA_FILE = path.join(__dirname, 'data.json');

// --- NEW: Route to get all stock and orders for your sites ---
app.get('/api/status', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Could not read data file" });
    }
});

// --- UPDATED: Your order route now handles stock and saving ---
app.post('/send-order', async (req, res) => {
    const { name, drink } = req.body; // drink is an array of items

    try {
        // 1. Load current stock/orders
        let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

        // 2. Deduct stock for each item selected
        drink.forEach(item => {
            if (data.inventory[item] !== undefined && data.inventory[item] > 0) {
                data.inventory[item] -= 1;
            }
        });

        // 3. Save the order to the list
        data.orders.push({
            name,
            items: drink,
            time: new Date().toLocaleString()
        });

        // 4. Save back to data.json
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

        // 5. Still send the email so you get a buzz on your phone
        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: process.env.MY_NOTIFICATION_EMAIL,
            subject: '☕ New Drink Order!',
            html: `<p><strong>${name}</strong> ordered: <strong>${drink.join(', ')}</strong>.</p>`
        });

        res.status(200).send({ success: true });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).send({ success: false, error: error.message });
    }
});

// --- NEW: Route for your Admin site to add stock ---
app.post('/api/restock', (req, res) => {
    const { item, amount } = req.body;
    try {
        let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        if (data.inventory[item] !== undefined) {
            data.inventory[item] += amount;
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Item not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Failed to update stock" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
