const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();

// 1. ALLOW PERMISSIONS (CORS)
// This is essential so your admin.html can talk to the server
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

const resend = new Resend(process.env.RESEND_API_KEY);
const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize data.json if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ inventory: {}, orders: [] }, null, 2));
}

// 2. GET STATUS (Used by Index and Admin)
app.get('/api/status', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Could not read data" });
    }
});

// 3. CREATE NEW ITEM (The part that makes your button work!)
app.post('/api/add-item', (req, res) => {
    try {
        const { name, emoji, category } = req.body;
        let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

        // Generate a unique ID (e.g., "Apple Juice" -> "apple-juice")
        const id = name.toLowerCase().replace(/\s+/g, '-');

        // Add the new item object
        data.inventory[id] = {
            name: name,
            emoji: emoji,
            category: category,
            stock: 0
        };

        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        console.log(`Added new item: ${name}`);
        res.status(200).json({ success: true });
    } catch (err) {
        console.error("Add Item Error:", err);
        res.status(500).json({ error: "Failed to add item" });
    }
});

// 4. UPDATE STOCK (Restock)
app.post('/api/restock', (req, res) => {
    try {
        const { item, amount } = req.body;
        let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

        if (data.inventory[item]) {
            data.inventory[item].stock += amount;
            if (data.inventory[item].stock < 0) data.inventory[item].stock = 0;
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Item not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Stock update failed" });
    }
});

// 5. DELETE ITEM
app.post('/api/delete-item', (req, res) => {
    try {
        const { id } = req.body;
        let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        delete data.inventory[id];
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// 6. PLACE ORDER
app.post('/send-order', async (req, res) => {
    try {
        const { name, drink } = req.body;
        let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

        // Subtract stock for each item ordered
        drink.forEach(orderedName => {
            const itemKey = Object.keys(data.inventory).find(key => data.inventory[key].name === orderedName);
            if (itemKey && data.inventory[itemKey].stock > 0) {
                data.inventory[itemKey].stock -= 1;
            }
        });

        // Log the order
        const newOrder = { 
            name, 
            items: drink, 
            time: new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' }) 
        };
        data.orders.push(newOrder);

        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

        // Send Email
        await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: process.env.MY_NOTIFICATION_EMAIL,
            subject: `New Order from ${name}`,
            html: `<p><strong>${name}</strong> ordered: ${drink.join(', ')}</p>`
        });

        res.status(200).json({ success: true });
    } catch (err) {
        console.error("Order Error:", err);
        res.status(500).json({ error: "Order failed" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is live on port ${PORT}`);
});
