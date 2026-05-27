import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import courseReducer from "./slices/courseSlice";
import enrollmentReducer from "./slices/enrollmentSlice";
import lessonReducer from './slices/lessonSlice';
import assignmentReducer from "./slices/assignmentSlice";
import quizReducer from "./slices/quizSlice";

export const store = configureStore({
    reducer: {
        auth: authReducer,
        courses: courseReducer,
        enrollments: enrollmentReducer,
        lessons: lessonReducer,
        assignments: assignmentReducer,
        quizzes: quizReducer,
    },
});