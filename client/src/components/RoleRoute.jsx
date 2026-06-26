import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

export default function RoleRoute({ children, roles }) {
    const { user, token, initialized } = useSelector((state) => state.auth);

    if (!token) return <Navigate to="/login" replace />;

    // We have a token but haven't confirmed who the user is yet —
    // wait instead of guessing, or we'll bounce real users to /unauthorized
    // on every hard refresh.
    if (!initialized) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(79,70,229,0.2)', borderTopColor: '#4F46E5' }} />
            </div>
        );
    }

    if (!roles.includes(user?.role)) return <Navigate to="/unauthorized" replace />;

    return children;
}