import { Navigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";

export default function RoleRoute({ children, roles }) {
    const { user, token } = useSelector((state) => state.auth);
    if (!token) return <Navigate to="/login" replace />;
    if (!roles.includes(user?.role)) return <Navigate to="/unauthorized" replace />;
    return children;
}