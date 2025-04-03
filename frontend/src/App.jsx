import React from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import HomePage from "./pages/HomePage/HomePage";
import Login from "./pages/Login/Login";
import Desigo from "./pages/Desigo/Desigo";
import Dashboard from "./pages/Dashboard/Dashboard";
import AdminAuthOtp from "./pages/OTP/AdminAuthOtp";

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/desigo-auth" element={<Desigo />} />
                <Route path="/dashboard/:id" element={<Dashboard />} />
                <Route path="/otp-verification" element={<AdminAuthOtp />} />
            </Routes>

            <ToastContainer position="top-center" autoClose={3000} />
        </Router>
    );
};

export default App;
