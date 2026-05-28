import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import courseReducer from "./slices/courseSlice";
import enrollmentReducer from "./slices/enrollmentSlice";
import lessonReducer from './slices/lessonSlice';
import assignmentReducer from "./slices/assignmentSlice";
import quizReducer from "./slices/quizSlice";
import attendanceReducer from "./slices/attendanceSlice" ;
import feeReducer from "./slices/feeSlice";
import notificationReducer from "./slices/notificationSlice";
import announcementReducer from "./slices/announcementSlice";

export const store = configureStore({
    reducer: {
        auth: authReducer,
        courses: courseReducer,
        enrollments: enrollmentReducer,
        lessons: lessonReducer,
        assignments: assignmentReducer,
        quizzes: quizReducer,
        attendance: attendanceReducer,
        fees: feeReducer,
        notifications: notificationReducer,
        announcements: announcementReducer,
    },
});