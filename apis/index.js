import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import UserModel from './models/user.js';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import bcrypt from 'bcrypt';
import http from 'http';
import { WebSocketServer } from 'ws';
import MessageModel from './models/Message.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = 10;

const app = express();
app.use('/uploads', express.static(join(__dirname, 'uploads')));
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
}));

async function getUserDataFromRequest(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies?.token;
        if (token) {
            jwt.verify(token, jwtSecret, {}, (err, userData) => {
                if (err) throw err;
                resolve(userData);
            });
        } else {
            reject('no token');
        }
    });
}

app.get('/test', (req, res) => {
    res.json('test ok');
});

app.get('/messages/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const userData = await getUserDataFromRequest(req);
        const ourUserId = userData.userId;

        const messages = await MessageModel.find({
            sender: { $in: [userId, ourUserId] },
            recipient: { $in: [userId, ourUserId] },
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/people', async (req, res) => {
    const users = await UserModel.find({}, { '_id': 1, username: 1 });
    res.json(users);
});

app.get('/profile', (req, res) => {
    const token = req.cookies?.token;
    if (token) {
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
            if (err) throw err;
            res.json(userData);
        });
    } else {
        res.status(401).json('no token');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await UserModel.findOne({ username });
    if (foundUser) {
        const passOk = bcrypt.compareSync(password, foundUser.password);
        if (passOk) {
            const token = jwt.sign({ userId: foundUser._id, username: foundUser.username }, jwtSecret);
            res.cookie('token', token).json('login successful');
        } else {
            res.status(401).json('invalid password');
        }
    } else {
        res.status(401).json('user not found');
    }
});

app.post('/logout', (req, res) => {
    res.cookie('token', '', { sameSite: 'none', secure: true }).json('ok');
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
        const createdUser = await UserModel.create({
            username: username,
            password: hashedPassword,
        });
        jwt.sign({ userId: createdUser._id, username }, jwtSecret, {}, (err, token) => {
            if (err) throw err;
            res.cookie('token', token, {
                httpOnly: true,
                sameSite: 'none',
                secure: true,
            }).status(201).json({
                id: createdUser._id,
                username: createdUser.username,
            });
        });
    } catch (error) {
        if (error.code === 11000) {
            res.status(400).json({ error: 'Username already exists' });
        } else {
            res.status(500).json({ error: 'Error registering user' });
        }
    }
});

const startServer = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to MongoDB');

        const server = app.listen(4040, () => {
            console.log('Server is running on port 4040');
        });

        const wss = new WebSocketServer({ server });

        wss.on('connection', (connection, req) => {
            function notifyAboutOnlinePeople() {
                [...wss.clients].forEach(client => {
                    client.send(JSON.stringify({
                        online: [...wss.clients]
                            .filter(c => c.userId && c.username)
                            .map(c => ({
                                userId: c.userId,
                                username: c.username,
                            }))
                    }));
                });
            }

            connection.isAlive = true;

            connection.timer = setInterval(() => {
                connection.ping();
                connection.deathTimer = setTimeout(() => {
                    connection.isAlive = false;
                    clearInterval(connection.timer);
                    connection.terminate();
                    notifyAboutOnlinePeople();
                    console.log('death');
                }, 1000);
            }, 5000);

            connection.on('pong', () => {
                clearTimeout(connection.deathTimer);
            });

            const cookies = req.headers.cookie;
            if (cookies) {
                const tokenCookieString = cookies.split(';').find(str => str.trim().startsWith('token='));
                if (tokenCookieString) {
                    const token = tokenCookieString.split('=')[1];
                    if (token) {
                        jwt.verify(token, jwtSecret, {}, (err, userData) => {
                            if (err) {
                                console.log('Invalid token');
                                return;
                            }
                            const { userId, username } = userData;
                            connection.userId = userId;
                            connection.username = username;

                            connection.on('message', async (message) => {
                                const messageData = JSON.parse(message.toString());
                                const { recipient, text, file } = messageData;
                                let filename = null;
                                if (file) {
                                    console.log('size', file.data.length);
                                    const parts = file.name.split('.');
                                    const ext = parts[parts.length - 1];
                                    filename = Date.now() + '.' + ext;
                                    const path = join(__dirname, 'uploads', filename);
                                    const bufferData = Buffer.from(file.data.split(',')[1], 'base64');
                                    fs.writeFile(path, bufferData, () => {
                                        console.log('file saved:' + path);
                                    });
                                }
                                if (recipient && (text || file)) {
                                    const messageDoc = await MessageModel.create({
                                        sender: connection.userId,
                                        recipient,
                                        text,
                                        file: file ? filename : null,
                                    });
                                    console.log('created message');
                                    [...wss.clients].filter(c => c.userId === recipient)
                                        .forEach(c => c.send(JSON.stringify({
                                            text,
                                            sender: connection.userId,
                                            recipient,
                                            file: file ? { name: file.name, data: file.data } : null,
                                            _id: messageDoc._id,
                                        })));
                                }
                            });

                            notifyAboutOnlinePeople();
                        });
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
};

startServer();