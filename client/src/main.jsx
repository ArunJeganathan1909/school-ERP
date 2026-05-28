import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from "react-redux";
import { store } from './store/store';
import {SocketProvider } from "./context/SocketContext.jsx";
import App from './App';
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Provider store={store}>
            <SocketProvider>
                <App />
            </SocketProvider>
        </Provider>
    </React.StrictMode>
)