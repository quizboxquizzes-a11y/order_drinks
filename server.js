const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Resend with your API Key from Render Environment Variables
const resend = new Resend(process.env.RESEND_API_KEY);

// Path to your inventory/order notebook
const DATA_FILE = path.join(__dirname, 'data.json');

/**
 * 1. GET STATUS
 * Used by index.html to show stock and admin.html to show everything.
 */
app.get('/api/status', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        res.json(data);
    } catch (err) {
        console.error("Read Error:", err);
        res.status(500).json({ error: "Could not read data file" });
    }
});

/**
 * 2. SEND ORDER
 * Subtracts stock, saves the order log, and sends the email.
 */
app.post('/send-order', async (req, res) => {
    const { name, drink } = req.body; // 'drink' is the array of selected items

    try {
        // Load data
        let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

        // Deduct stock for each item (if it exists)
        drink.forEach(item => {
            if (data.inventory[item] !== undefined && data.inventory[item] > 0) {
                data.inventory[item] -= 1;
            }
        });

        // Add to order history
        data.orders.push({
            name: name,
            items: drink,
            time: new Date().toLocaleString('en-GB', { timeZone: 'UTC' })
        });

        // Save updated data back to the file
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

        // Send Email via Resend
        await resend.emails.send({
            from: 'onboarding@resend.dev', 
            to: process.env.MY_NOTIFICATION_EMAIL, 
            subject: '☕ New Drink Order!',
            html: `<p><strong>${name}</strong> ordered: <strong>${drink.join(', ')}</strong>.</p>`
        });

        console.log(`Success: Order saved and email sent for ${name}`);
        res.status(200).send({ success: true });

    } catch (error) {
        console.error('Order processing failed:', error);
        res.status(500).send({ success: false, error: error.message });
    }
});

/**
 * 3. RESTOCK (Admin Only)
 * Used by admin.html to add stock back to the inventory.
 */
app.post('/api/restock', (req, res) => {
    const { item, amount } = req.body;
    try {
        let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        
        if (data.inventory[item] !== undefined) {
            data.inventory[item] += amount;
            // Prevent negative stock
            if (data.inventory[item] < 0) data.inventory[item] = 0;

            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            res.json({ success: true, newCount: data.inventory[item] });
        } else {
            res.status(404).json({ error: "Item not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Failed to update stock" });
    }
});

// Use Render's dynamic port or default to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Drink Station Backend running on port ${PORT}`);
});
