const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    // JWT auth middleware for socket connections
    io.use(async (socket, next) => {
        try {
            const token =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.split(' ')[1];

            if (!token) return next(new Error('Authentication token missing'));

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('name email role isActive');

            if (!user || !user.isActive) return next(new Error('User not found or inactive'));

            socket.user = user;
            next();
        } catch (error) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const user = socket.user;
        console.log(`Socket connected: ${user.name} (${user.role}) - ${socket.id}`);

    //     Join personal room (for direct notifications)
        socket.join(`user:${user._id}`);

    //     Join role-based room (for role-wide broadcasts)
        socket.join(`role:${user.role}`);

    //     Join course rooms on request
        socket.on('join:course', (courseId) => {
            socket.join(`course:${courseId}`);
        });

        socket.on('leave:course', (courseId) => {
            socket.leave(`course:${ courseId }`);
        });

    //     Ping/pong for connection health
        socket.on('ping', () => socket.emit('pong'));

        socket.on('disconnect', (reason) => {
            console.log(`Socket disconnected: ${user.name} - ${reason}`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) throw new Error('Socket.io not initialized.');
    return io;
};

module.exports = { initSocket, getIO };