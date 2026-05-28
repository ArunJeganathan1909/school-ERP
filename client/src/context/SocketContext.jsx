import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useSelector, useDispatch } from 'react-redux';
import { addNotification } from '../store/slices/notificationSlice';
import { prependAnnouncement } from '../store/slices/announcementSlice';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
    const { token, user } = useSelector((s) => s.auth);
    const dispatch = useDispatch();
    const socketRef = useRef(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!token || !user) {
            // Disconnect if logged out
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setConnected(false);
            }
            return;
        }

        // Already connected
        if (socketRef.current?.connected) return;

        const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000', {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
        });

        socket.on('connect', () => {
            console.log('Socket connected:', socket.id);
            setConnected(true);
        });

        socket.on('disconnect', () => {
            setConnected(false);
        });

        socket.on('connect_error', (err) => {
            console.warn('Socket connection error:', err.message);
        });

        // Real-time notification
        socket.on('notification:new', (notification) => {
            dispatch(addNotification(notification));
        });

        // Real-time announcement
        socket.on('announcement:new', (announcement) => {
            dispatch(prependAnnouncement(announcement));
        });

        socketRef.current = socket;

        return () => {
            socket.off('notification:new');
            socket.off('announcement:new');
            socket.disconnect();
            socketRef.current = null;
        };
    }, [token, user, dispatch]);

    const joinCourse = (courseId) => socketRef.current?.emit('join:course', courseId);
    const leaveCourse = (courseId) => socketRef.current?.emit('leave:course', courseId);

    return (
        <SocketContext.Provider value={{ socket: socketRef.current, connected, joinCourse, leaveCourse }}>
            {children}
        </SocketContext.Provider>
    );
}

export const useSocket = () => useContext(SocketContext);