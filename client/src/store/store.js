import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice.js";
import courseReducer from "./slices/courseSlice.js";
import enrollmentReducer from "./slices/enrollmentSlice.js";

export const store = configureStore({
    reducer: {
        auth: authReducer,
        courses: courseReducer,
        enrollments: enrollmentReducer,
    },
});