const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const resend = new Resend(process.env.RESEND_API_KEY);

app.post('/send-order', async (req, res) => {
    const { name, drink } = req.body;

    try {
        const data = await resend.emails.send({
            from: 'onboarding@resend.dev', 
            to: process.env.MY_NOTIFICATION_EMAIL, 
            subject: '☕ New Drink Order!',
            html: `<p><strong>${name}</strong> wants a <strong>${drink}</strong>.</p>`
        });

        console.log('Success! Email notification sent.');
        res.status(200).send({ success: true });
    } catch (error) {
        console.error('Email failed to send:', error);
        res.status(500).send({ success: false, error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});
