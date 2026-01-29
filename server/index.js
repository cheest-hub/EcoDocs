const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: (origin, callback) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
            'http://localhost:5173',
            'http://192.168.0.194:5173',
            'http://172.19.64.1:5173',
            'http://172.24.176.1:5173'
        ];

        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('EcoDocs API Running');
});

// Routes placeholders
const authRoutes = require('./routes/authRoutes');

const docRoutes = require('./routes/docRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/docs', docRoutes);
app.use('/api/settings', settingsRoutes);

// Static uploads serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve Frontend in Production
if (process.env.NODE_ENV === 'production' || process.argv.includes('--production')) {
    app.use(express.static(path.join(__dirname, '../public')));
    app.get('*', (req, res) => {
        // Skip API routes
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
        res.sendFile(path.resolve(__dirname, '../public', 'index.html'));
    });
}

// Global Error Handler
const errorHandler = require('./middleware/errorHandler');

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
    // Server is ready
});
