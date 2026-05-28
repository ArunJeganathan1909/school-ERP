import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchNotifications = createAsyncThunk('notifications/fetchAll', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/notifications?${query}`);
        return data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const markRead = createAsyncThunk('notifications/markRead', async (id, { rejectWithValue }) => {
    try {
        const { data } = await api.put(`/notifications/${id}/read`);
        return data.notification;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const markAllRead = createAsyncThunk('notifications/markAllRead', async (_, { rejectWithValue }) => {
    try {
        await api.put('/notifications/read-all');
        return true;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const deleteNotification = createAsyncThunk('notifications/delete', async (id, { rejectWithValue }) => {
    try {
        await api.delete(`/notifications/${id}`);
        return id;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const clearAllNotifications = createAsyncThunk('notifications/clearAll', async (_, { rejectWithValue }) => {
    try {
        await api.delete('/notifications');
        return true;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const notificationSlice = createSlice({
    name: 'notifications',
    initialState: { list: [], unreadCount: 0, total: 0, loading: false, error: null },
    reducers: {
        // Called directly from SocketContext when a real-time notification arrives
        addNotification(state, action) {
            state.list.unshift(action.payload);
            state.unreadCount += 1;
            state.total += 1;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchNotifications.pending, (s) => { s.loading = true; })
            .addCase(fetchNotifications.fulfilled, (s, a) => {
                s.loading = false;
                s.list = a.payload.notifications;
                s.unreadCount = a.payload.unreadCount;
                s.total = a.payload.total;
            })
            .addCase(fetchNotifications.rejected, (s, a) => { s.loading = false; s.error = a.payload; })

            .addCase(markRead.fulfilled, (s, a) => {
                const i = s.list.findIndex(n => n._id === a.payload._id);
                if (i !== -1) { s.list[i] = a.payload; s.unreadCount = Math.max(0, s.unreadCount - 1); }
            })

            .addCase(markAllRead.fulfilled, (s) => {
                s.list = s.list.map(n => ({ ...n, isRead: true }));
                s.unreadCount = 0;
            })

            .addCase(deleteNotification.fulfilled, (s, a) => {
                const n = s.list.find(n => n._id === a.payload);
                if (n && !n.isRead) s.unreadCount = Math.max(0, s.unreadCount - 1);
                s.list = s.list.filter(n => n._id !== a.payload);
                s.total -= 1;
            })

            .addCase(clearAllNotifications.fulfilled, (s) => {
                s.list = []; s.unreadCount = 0; s.total = 0;
            });
    },
});

export const { addNotification } = notificationSlice.actions;
export default notificationSlice.reducer;