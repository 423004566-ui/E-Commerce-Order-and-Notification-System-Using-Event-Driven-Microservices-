const express = require('express');
const amqp = require('amqplib');
const jwt = require('jsonwebtoken'); 
const app = express();
app.use(express.json());

const AMQP_URL = 'amqps://qhqvpmpw:F4JZLqjVO_6RPSKMwqyPZK_n6_B9VZdr@gerbil.rmq.cloudamqp.com/qhqvpmpw';
const JWT_SECRET = 'super_secret_key_123'; 

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (username === 'admin' && password === 'password123') {
        const user = { username: username, role: 'admin' };
        
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
        return res.json({ token: token });
    }

    res.status(401).json({ error: "Invalid username or password" });
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token) return res.status(401).json({ error: "Access denied. Token missing." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid or expired token." });
        req.user = user; 
        next();
    });
}

app.post('/api/orders', authenticateToken, async (req, res) => {
    try {
        let itemName = "Default Item";
        if (Array.isArray(req.body)) {
            itemName = req.body[0]?.item || "Default Item"; 
        } else {
            itemName = req.body.item || req.body.name || "Default Item"; 
        }

        const order = { id: Date.now(), name: itemName, status: "PENDING" };

        const connection = await amqp.connect(AMQP_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue('order_notifications', { durable: true });

        channel.sendToQueue('order_notifications', Buffer.from(JSON.stringify(order)));
        console.log("🚀 [Order Service] Sent secured order to RabbitMQ:", order);

        setTimeout(() => connection.close(), 500);

        res.status(201).json({ message: "Order placed successfully with valid JWT!", order });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to process order" });
    }
});

app.listen(3000, () => console.log(`🚀 Order Service running on port 3000`));