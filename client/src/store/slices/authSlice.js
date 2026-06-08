import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../api/axios.js";

// Async thunks
export const loginUser = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/auth/login', credentials);
        localStorage.setItem('token', data.token);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || 'Login Failed');
    }
})

export const registerUser = createAsyncThunk('auth/register', async ( userData, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/auth/register', userData);
        localStorage.setItem('token', data.token);
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data?.message || 'Registration Failed');
    }
})

export const fetchMe = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
    try {
        const { data } = await api.get('/auth/me');
        return data;
    } catch (error) {
        return rejectWithValue(error.response?.data?.message)
    }
})

const authSlice =  createSlice({
    name: "auth",
    initialState: {
        user: null,
        token: localStorage.getItem("token") || null,
        loading: false,
        error: null,
    },
    reducers: {
        logout(state) {
            state.user = null;
            state.token = null;
            localStorage.removeItem("token");
        },
        clearError(state) {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        const handlePending = (state) => {
            state.loading = true;
            state.error = null;
        };
        const handleRejected = (state, action) => {
            state.loading = false;
            state.error = action.payload;
        };

        builder
            .addCase(loginUser.pending, handlePending)
            .addCase(loginUser.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload.user;
                state.token = action.payload.token;
            })
            .addCase(loginUser.rejected, handleRejected)

            .addCase(registerUser.pending, handlePending)
            .addCase(registerUser.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload.user;
                state.token = action.payload.token;
            })
            .addCase(registerUser.rejected, handleRejected)

            .addCase(fetchMe.fulfilled, (state, action) => {
                state.user = action.payload.user;
            });
    },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;