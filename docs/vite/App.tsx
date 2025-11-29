
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import VoucherDetail from './pages/VoucherDetail';
import Checkout from './pages/Checkout';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import ReviewPage from './pages/ReviewPage';
import VerifyVoucher from './pages/VerifyVoucher';

// Layout wrapper to conditionally handle Navbar visibility if needed
const Layout: React.FC<{children: React.ReactNode}> = ({ children }) => {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
};

const App: React.FC = () => {
  return (
    <StoreProvider>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Layout><LandingPage /></Layout>} />
              <Route path="/voucher/:id" element={<Layout><VoucherDetail /></Layout>} />
              <Route path="/verify" element={<Layout><VerifyVoucher /></Layout>} />
              <Route path="/checkout/:id" element={<Checkout />} /> {/* No Navbar in checkout */}
              <Route path="/review/:id" element={<ReviewPage />} /> {/* No Navbar in review */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<Layout><AdminDashboard /></Layout>} />
            </Routes>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </StoreProvider>
  );
};

export default App;
