import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../api/axios';

export const fetchAllFees = createAsyncThunk('fees/fetchAll', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/fees?${query}`);
        return data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const fetchMyFees = createAsyncThunk('fees/fetchMine', async (params = {}, { rejectWithValue }) => {
    try {
        const query = new URLSearchParams(params).toString();
        const { data } = await api.get(`/fees/my?${query}`);
        return data;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const createFee = createAsyncThunk('fees/create', async (feeData, { rejectWithValue }) => {
    try {
        const { data } = await api.post('/fees', feeData);
        return data.fee;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

export const recordPayment = createAsyncThunk(
    'fees/payment',
    async ({ id, amount, method, reference }, { dispatch, rejectWithValue }) => {
        try {
            const { data } = await api.post(`/fees/${id}/payment`, { amount, method, reference });
            return data.fee;
        } catch (err) {
            return rejectWithValue(err.response?.data?.message);
        }
    }
);

export const deleteFee = createAsyncThunk('fees/delete', async (id, { rejectWithValue }) => {
    try {
        await api.delete(`/fees/${id}`);
        return id;
    } catch (err) { return rejectWithValue(err.response?.data?.message); }
});

const feeSlice = createSlice({
    name: 'fees',
    initialState: {
        list:     [],
        myFees:   [],
        stats:    { totalExpected: 0, totalCollected: 0, pending: 0, overdue: 0, paid: 0 },
        totalDue: 0,
        total:    0,
        pages:    1,
        loading:  false,
        error:    null,
        paymentError: null,
    },
    reducers: {
        clearFeeError(state)        { state.error = null; },
        clearPaymentError(state)    { state.paymentError = null; },
    },
    extraReducers: (builder) => {
        builder
            /* fetchAllFees */
            .addCase(fetchAllFees.pending,   (s) => { s.loading = true; s.error = null; })
            .addCase(fetchAllFees.fulfilled, (s, a) => {
                s.loading = false;
                s.list    = a.payload.fees;
                s.stats   = a.payload.stats || s.stats;
                s.total   = a.payload.total;
                s.pages   = a.payload.pages;
            })
            .addCase(fetchAllFees.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            /* fetchMyFees */
            .addCase(fetchMyFees.pending,   (s) => { s.loading = true; })
            .addCase(fetchMyFees.fulfilled, (s, a) => {
                s.loading = false;
                s.myFees  = a.payload.fees;
                s.totalDue = a.payload.totalDue;
            })
            .addCase(fetchMyFees.rejected,  (s, a) => { s.loading = false; s.error = a.payload; })

            /* createFee */
            .addCase(createFee.fulfilled, (s, a) => {
                s.list.unshift(a.payload);
                s.total += 1;
            })
            .addCase(createFee.rejected, (s, a) => { s.error = a.payload; })

            /* recordPayment — replace the updated fee in the list */
            .addCase(recordPayment.pending,   (s) => { s.paymentError = null; })
            .addCase(recordPayment.fulfilled, (s, a) => {
                const updated = a.payload;

                // Replace in main list
                const idx = s.list.findIndex(f => f._id === updated._id);
                if (idx !== -1) s.list[idx] = updated;

                // Replace in myFees if present
                const myIdx = s.myFees.findIndex(f => f._id === updated._id);
                if (myIdx !== -1) s.myFees[myIdx] = updated;

                // Recalculate stats from current list
                const collected = s.list.reduce((sum, f) => sum + (f.paidAmount || 0), 0);
                const expected  = s.list.reduce((sum, f) => sum + (f.netAmount  || 0), 0);
                s.stats = {
                    ...s.stats,
                    totalCollected: collected,
                    totalExpected:  expected,
                    paid:    s.list.filter(f => f.status === 'paid').length,
                    pending: s.list.filter(f => f.status === 'pending').length,
                    overdue: s.list.filter(f => f.status === 'overdue').length,
                };
            })
            .addCase(recordPayment.rejected, (s, a) => { s.paymentError = a.payload; })

            /* deleteFee */
            .addCase(deleteFee.fulfilled, (s, a) => {
                s.list  = s.list.filter(f => f._id !== a.payload);
                s.total -= 1;
            });
    },
});

export const { clearFeeError, clearPaymentError } = feeSlice.actions;
export default feeSlice.reducer;