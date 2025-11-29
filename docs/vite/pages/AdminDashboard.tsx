
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { VoucherStatus, Transaction, Service } from '../types';
import { Search, Filter, X, CheckCircle, AlertCircle, Calendar, CreditCard, QrCode, Camera, Download, Phone, Upload, RefreshCw, Clipboard, PieChart, PlusCircle, History, MoreVertical, Trash2, Clock, FileText, UserCheck, List, Gift, Link as LinkIcon, Edit, Archive, Image as ImageIcon, Layers, Tag, Mail } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';

const AdminDashboard: React.FC = () => {
  const { transactions, services, redeemVoucher, createVoucher, extendVoucher, voidVoucher, auditLogs, addService, updateService, deleteService } = useStore();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Navigation State
  const [activeTab, setActiveTab] = useState<'TRANSACTIONS' | 'SERVICES'>('TRANSACTIONS');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | 'ALL'>('ALL');
  
  // Modals State
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showPOSModal, setShowPOSModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  
  // Service Management Modal State
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceForm, setServiceForm] = useState<{
    title: string;
    description: string;
    durationMin: number;
    price: number;
    image: string;
    facilities: string[];
  }>({
    title: '',
    description: '',
    durationMin: 60,
    price: 0,
    image: '',
    facilities: []
  });
  const [newFacility, setNewFacility] = useState('');

  // Scanner State
  const [showScanner, setShowScanner] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');
  const [scanCooldown, setScanCooldown] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  
  // Video Ref for Custom Scanner
  const videoRef = useRef<HTMLVideoElement>(null);

  // POS Form State
  const [posServiceId, setPosServiceId] = useState('');
  const [posName, setPosName] = useState('');
  const [posEmail, setPosEmail] = useState('');
  const [posPhone, setPosPhone] = useState('');
  const [posPayment, setPosPayment] = useState<'CASH' | 'QRIS' | 'CREDIT_CARD' | 'COMPLIMENTARY'>('CASH');

  // Customer History State
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');

  // Action Menu State
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize POS Service ID
  useEffect(() => {
    const activeServices = services.filter(s => !s.isArchived);
    if (activeServices.length > 0 && !posServiceId) {
        setPosServiceId(activeServices[0].id);
    }
  }, [services, posServiceId]);

  // Redirect if not logged in
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin/login');
    }
  }, [isAuthenticated, navigate]);

  // --- STATISTICS ---
  const stats = useMemo(() => {
    return {
      totalRevenue: transactions.filter(t => t.status !== VoucherStatus.VOIDED).reduce((acc, curr) => acc + curr.amount, 0),
      activeVouchers: transactions.filter(t => t.status === VoucherStatus.ACTIVE).length,
      redeemedVouchers: transactions.filter(t => t.status === VoucherStatus.REDEEMED).length,
    };
  }, [transactions]);

  // --- CHART DATA ---
  const revenueData = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => ({
      date: date.slice(5), // MM-DD
      amount: transactions
        .filter(t => t.purchaseDate === date && t.status !== VoucherStatus.VOIDED)
        .reduce((sum, t) => sum + t.amount, 0)
    }));
  }, [transactions]);

  const servicePerformanceData = useMemo(() => {
    const data: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.status !== VoucherStatus.VOIDED) {
        const srv = services.find(s => s.id === t.serviceId);
        const name = srv ? srv.title : 'Unknown';
        data[name] = (data[name] || 0) + t.amount;
      }
    });
    return Object.keys(data).map(key => ({ name: key, value: data[key] }));
  }, [transactions, services]);

  const CHART_COLORS = ['#4f804f', '#c19f78', '#2a422a', '#95704e', '#729f72'];

  // --- FILTERED DATA ---
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      t.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.customer.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const customerHistory = useMemo(() => {
    if (!selectedCustomerPhone) return [];
    return transactions.filter(t => t.customer.phone === selectedCustomerPhone);
  }, [transactions, selectedCustomerPhone]);


  // --- ACTIONS ---

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    const srv = services.find(s => s.id === posServiceId);
    if (!srv) return;

    const newCode = `KAL-POS-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 6);

    const newTx: Transaction = {
      id: newCode,
      serviceId: srv.id,
      customer: { name: posName, email: posEmail, phone: posPhone },
      purchaseDate: new Date().toISOString().split('T')[0],
      expiryDate: expiryDate.toISOString().split('T')[0],
      status: VoucherStatus.ACTIVE,
      amount: posPayment === 'COMPLIMENTARY' ? 0 : srv.price,
      paymentMethod: posPayment as any
    };

    createVoucher(newTx, user?.name || 'Staff');
    showToast(`Voucher ${newCode} created successfully`, 'success');
    setShowPOSModal(false);
    setPosName('');
    setPosEmail('');
    setPosPhone('');
  };

  const handleRedeem = (code: string) => {
    if(!code) return;
    const result = redeemVoucher(code, user?.name || 'Staff');
    
    if(result.success) {
        showToast(result.message, 'success');
        setRedeemInput('');
        setScannedData(null);
        setShowScanner(false);
    } else {
        showToast(result.message, 'error');
    }
  };

  const confirmRedemption = () => {
    if (scannedData) {
      handleRedeem(scannedData);
    }
  };

  const handleExtend = (id: string) => {
    extendVoucher(id, 30, user?.name || 'Staff');
    showToast(`Voucher ${id} extended by 30 days`, 'success');
    setActiveActionMenu(null);
  };

  const handleVoid = (id: string) => {
    const reason = window.prompt('Are you sure you want to void this voucher? This cannot be undone.\n\nPlease enter a reason:');
    if (reason !== null) { // Prompt returns null on cancel
      if (reason.trim() === '') {
         showToast('Void action cancelled: Reason is required.', 'error');
         return;
      }
      voidVoucher(id, reason, user?.name || 'Staff');
      showToast(`Voucher ${id} has been voided`, 'info');
      setActiveActionMenu(null);
    }
  };

  const handleCopyReviewLink = (id: string) => {
    const baseUrl = window.location.origin + window.location.pathname;
    const link = `${baseUrl}#/review/${id}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast('Review link copied to clipboard', 'success');
      setActiveActionMenu(null);
    });
  };

  const handleCustomerClick = (name: string, phone: string) => {
    setSelectedCustomerName(name);
    setSelectedCustomerPhone(phone);
    setShowHistoryModal(true);
  };

  // --- SERVICE MANAGEMENT ACTIONS ---
  
  const openServiceModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        title: service.title,
        description: service.description,
        durationMin: service.durationMin,
        price: service.price,
        image: service.image,
        facilities: service.facilities
      });
    } else {
      setEditingService(null);
      setServiceForm({
        title: '',
        description: '',
        durationMin: 60,
        price: 0,
        image: '',
        facilities: []
      });
    }
    setNewFacility('');
    setShowServiceModal(true);
  };

  const handleServiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceForm.title || !serviceForm.price) {
      showToast('Title and Price are required', 'error');
      return;
    }

    if (editingService) {
      updateService(editingService.id, serviceForm, user?.name || 'Staff');
      showToast('Service updated successfully', 'success');
    } else {
      const newService: Service = {
        id: `srv_${Math.random().toString(36).substring(2, 9)}`,
        ...serviceForm
      };
      addService(newService, user?.name || 'Staff');
      showToast('Service created successfully', 'success');
    }
    setShowServiceModal(false);
  };

  const handleArchiveService = (id: string) => {
    if (window.confirm('Are you sure you want to archive this service? It will no longer be available for purchase.')) {
      deleteService(id, user?.name || 'Staff');
      showToast('Service archived', 'success');
    }
  };

  const addFacility = () => {
    if (newFacility.trim()) {
      setServiceForm(prev => ({
        ...prev,
        facilities: [...prev.facilities, newFacility.trim()]
      }));
      setNewFacility('');
    }
  };

  const removeFacility = (index: number) => {
    setServiceForm(prev => ({
      ...prev,
      facilities: prev.facilities.filter((_, i) => i !== index)
    }));
  };

  // --- UTILS ---
  const downloadCSV = () => {
    const headers = ['Transaction ID', 'Customer Name', 'Phone', 'Email', 'Service ID', 'Amount', 'Status', 'Date', 'Payment Method'];
    const rows = filteredTransactions.map(tx => [
      tx.id,
      tx.customer.name,
      tx.customer.phone,
      tx.customer.email,
      tx.serviceId,
      tx.amount,
      tx.status,
      tx.purchaseDate,
      tx.paymentMethod
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kalanara_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Transaction data exported successfully', 'success');
  };

  const openWhatsApp = (contact: string, name: string, id: string) => {
    const phone = contact.replace(/\D/g, '');
    const finalPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
    const text = `Hello ${name}, regarding your voucher ${id} at Kalanara Spa...`;
    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- SCANNER LOGIC ---
  const handleScanText = (text: string | null) => {
    if (scanCooldown || scannedData) return;
    if (text && text.startsWith('KAL-')) {
        setScannedData(text);
        setShowScanner(false);
        setScanCooldown(true);
        setTimeout(() => setScanCooldown(false), 1000);
    }
  };

  // Custom Video Scanner Implementation using jsQR
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startScan = async () => {
      if (showScanner && videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (videoRef.current) {
             videoRef.current.srcObject = stream;
             // Required for iOS Safari
             videoRef.current.setAttribute("playsinline", "true"); 
             await videoRef.current.play();
             
             const scan = () => {
               if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                 const canvas = document.createElement('canvas');
                 canvas.width = videoRef.current.videoWidth;
                 canvas.height = videoRef.current.videoHeight;
                 const ctx = canvas.getContext('2d');
                 if (ctx) {
                   ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                   const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                   const code = jsQR(imageData.data, imageData.width, imageData.height);
                   if (code) {
                     handleScanText(code.data);
                   }
                 }
               }
               animationFrameId = requestAnimationFrame(scan);
             };
             animationFrameId = requestAnimationFrame(scan);
          }
        } catch (err) {
          console.error("Camera error", err);
          showToast("Camera access denied or not available", "error");
          setShowScanner(false);
        }
      }
    };

    if (showScanner) {
      startScan();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [showScanner]);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        // @ts-ignore
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          setScannedData(code.data);
          setShowScanner(false);
          showToast('QR Code detected from image', 'success');
        } else {
          showToast('Could not detect a valid QR code in the image.', 'error');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    e.target.value = '';
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!showRedeemModal) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            processFile(blob);
            e.preventDefault();
            return;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [showRedeemModal]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-sage-50 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* TOP HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-serif text-sage-900 font-bold">Dashboard</h1>
            <p className="text-sage-500 flex items-center gap-2">
              <span className="bg-sage-200 text-sage-800 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">{user.role}</span>
              {user.role === 'ADMIN' && (
                <button onClick={() => setShowAuditModal(true)} className="text-xs text-sage-600 underline hover:text-sage-900 flex items-center gap-1">
                   <FileText size={12} /> View Audit Log
                </button>
              )}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
             {user.role === 'ADMIN' && activeTab === 'TRANSACTIONS' && (
               <>
                 <button 
                    onClick={downloadCSV}
                    className="bg-white text-sage-700 border border-sage-200 px-4 py-3 rounded-lg flex items-center gap-2 hover:bg-sage-50 transition-colors shadow-sm whitespace-nowrap"
                 >
                   <Download size={18} /> Export
                 </button>
                 <button 
                    onClick={() => setShowPOSModal(true)}
                    className="bg-sand-500 text-white px-4 py-3 rounded-lg flex items-center gap-2 hover:bg-sand-600 transition-colors shadow-sm whitespace-nowrap"
                 >
                   <PlusCircle size={18} /> Create Voucher
                 </button>
               </>
             )}
            <button 
              onClick={() => {
                  setShowRedeemModal(true);
                  setShowScanner(false);
                  setScannedData(null);
              }}
              className="bg-sage-800 hover:bg-sage-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-md whitespace-nowrap"
            >
              <CheckCircle size={18} /> Redeem
            </button>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        {user.role === 'ADMIN' && (
          <div className="mb-8 flex border-b border-sage-200">
            <button
              onClick={() => setActiveTab('TRANSACTIONS')}
              className={`pb-3 px-6 text-sm font-medium flex items-center gap-2 transition-colors relative ${activeTab === 'TRANSACTIONS' ? 'text-sage-900' : 'text-sage-500 hover:text-sage-700'}`}
            >
              <List size={18} /> Transactions
              {activeTab === 'TRANSACTIONS' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-900"></div>}
            </button>
            <button
              onClick={() => setActiveTab('SERVICES')}
              className={`pb-3 px-6 text-sm font-medium flex items-center gap-2 transition-colors relative ${activeTab === 'SERVICES' ? 'text-sage-900' : 'text-sage-500 hover:text-sage-700'}`}
            >
              <Layers size={18} /> Service Management
              {activeTab === 'SERVICES' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-900"></div>}
            </button>
          </div>
        )}

        {/* ======================= */}
        {/* TRANSACTIONS TAB VIEW */}
        {/* ======================= */}
        {activeTab === 'TRANSACTIONS' && (
          <>
            {/* ANALYTICS SECTION (ADMIN ONLY) */}
            {user.role === 'ADMIN' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Key Metrics */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-sage-100">
                    <p className="text-sm font-medium text-sage-500">Total Revenue</p>
                    <p className="text-2xl font-bold text-sage-900 mt-2">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(stats.totalRevenue)}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-sage-100">
                    <p className="text-sm font-medium text-sage-500">Active Vouchers</p>
                    <p className="text-2xl font-bold text-green-600 mt-2">{stats.activeVouchers}</p>
                  </div>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-sage-100">
                    <p className="text-sm font-medium text-sage-500">Redeemed Vouchers</p>
                    <p className="text-2xl font-bold text-gray-600 mt-2">{stats.redeemedVouchers}</p>
                  </div>
                </div>

                {/* Revenue Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-sage-100 min-h-[350px]">
                  <h3 className="text-lg font-semibold text-sage-900 mb-4">Revenue (Last 7 Days)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" stroke="#4b5563" fontSize={12} />
                        <YAxis stroke="#4b5563" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                          formatter={(value: number) => new Intl.NumberFormat('id-ID').format(value)}
                        />
                        <Bar dataKey="amount" fill="#4f804f" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Services Pie Chart */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-sage-100 min-h-[350px]">
                  <h3 className="text-lg font-semibold text-sage-900 mb-4 flex items-center gap-2">
                    <PieChart size={18} /> Top Performing Services
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={servicePerformanceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {servicePerformanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => new Intl.NumberFormat('id-ID').format(value)} />
                        <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{fontSize: '12px'}} />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* TRANSACTIONS TABLE */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
              {/* Filters */}
              <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-sage-100 h-fit">
                <h3 className="text-lg font-semibold text-sage-900 mb-4 flex items-center gap-2">
                  <Filter size={18} /> Filters
                </h3>
                <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 text-sage-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Search Code, Name, Email..." 
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 focus:ring-2 focus:ring-sage-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-sage-600 mb-2">Status</label>
                      <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-full p-2 rounded-lg border border-sage-200 bg-white text-sage-900 outline-none"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value={VoucherStatus.ACTIVE}>Active</option>
                        <option value={VoucherStatus.REDEEMED}>Redeemed</option>
                        <option value={VoucherStatus.EXPIRED}>Expired</option>
                        <option value={VoucherStatus.VOIDED}>Voided</option>
                      </select>
                    </div>
                </div>
              </div>

              {/* Table */}
              <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-sage-100 overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-sage-50 border-b border-sage-200">
                      <tr>
                        <th className="p-4 font-medium text-sage-600 text-sm">Voucher ID</th>
                        <th className="p-4 font-medium text-sage-600 text-sm">Customer</th>
                        <th className="p-4 font-medium text-sage-600 text-sm">Contact</th>
                        <th className="p-4 font-medium text-sage-600 text-sm">Date</th>
                        {user.role === 'ADMIN' && <th className="p-4 font-medium text-sage-600 text-sm">Amount</th>}
                        <th className="p-4 font-medium text-sage-600 text-sm">Status</th>
                        {user.role === 'ADMIN' && <th className="p-4 font-medium text-sage-600 text-sm w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sage-100">
                      {filteredTransactions.length > 0 ? (
                        filteredTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-sage-50/50 transition group">
                            <td className="p-4 font-mono text-sm font-medium text-sage-900">{tx.id}</td>
                            <td className="p-4">
                                <button 
                                  onClick={() => handleCustomerClick(tx.customer.name, tx.customer.phone)}
                                  className="text-sage-900 font-medium hover:text-sand-600 text-left transition-colors flex items-center gap-2"
                                >
                                  {tx.customer.name}
                                  {tx.giftDetails?.isGift && <Gift size={14} className="text-sand-500" />}
                                </button>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1">
                                <button 
                                  onClick={() => openWhatsApp(tx.customer.phone, tx.customer.name, tx.id)}
                                  className="text-sage-500 text-xs flex items-center gap-1 hover:text-green-600 w-fit"
                                >
                                  <Phone size={12} /> {tx.customer.phone}
                                </button>
                                <div className="text-sage-400 text-xs flex items-center gap-1">
                                  <Mail size={12} /> <span className="truncate max-w-[120px]">{tx.customer.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-sm text-sage-600">{tx.purchaseDate}</td>
                            {user.role === 'ADMIN' && (
                                <td className="p-4 text-sm text-sage-900 font-medium">
                                {new Intl.NumberFormat('id-ID').format(tx.amount)}
                                </td>
                            )}
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1
                                ${tx.status === VoucherStatus.ACTIVE ? 'bg-green-100 text-green-800' : 
                                  tx.status === VoucherStatus.REDEEMED ? 'bg-gray-100 text-gray-600' : 
                                  tx.status === VoucherStatus.VOIDED ? 'bg-red-50 text-red-400 line-through' :
                                  'bg-red-100 text-red-800'}`}>
                                {tx.status === VoucherStatus.ACTIVE && <CheckCircle size={10} />}
                                {tx.status === VoucherStatus.EXPIRED && <AlertCircle size={10} />}
                                {tx.status}
                              </span>
                            </td>
                            {user.role === 'ADMIN' && (
                              <td className="p-4 relative">
                                <button 
                                  onClick={() => setActiveActionMenu(activeActionMenu === tx.id ? null : tx.id)}
                                  className="text-sage-400 hover:text-sage-600 p-1"
                                >
                                  <MoreVertical size={16} />
                                </button>
                                {activeActionMenu === tx.id && (
                                  <div className="absolute right-8 top-4 bg-white shadow-lg rounded-lg border border-sage-100 py-1 z-10 w-44 animate-in fade-in zoom-in duration-200">
                                    {(tx.status === VoucherStatus.ACTIVE || tx.status === VoucherStatus.EXPIRED) && (
                                      <>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleExtend(tx.id); }}
                                          className="w-full text-left px-4 py-2 text-sm text-sage-700 hover:bg-sage-50 flex items-center gap-2"
                                        >
                                          <Clock size={14} /> Extend (+30d)
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleVoid(tx.id); }}
                                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                          <Trash2 size={14} /> Void Voucher
                                        </button>
                                      </>
                                    )}
                                    {tx.status === VoucherStatus.REDEEMED && (
                                      <button 
                                          onClick={(e) => { e.stopPropagation(); handleCopyReviewLink(tx.id); }}
                                          className="w-full text-left px-4 py-2 text-sm text-sage-700 hover:bg-sage-50 flex items-center gap-2"
                                        >
                                          <LinkIcon size={14} /> Copy Review Link
                                        </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={user.role === 'ADMIN' ? 7 : 6} className="p-8 text-center text-sage-500">No transactions found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ======================= */}
        {/* SERVICES TAB VIEW */}
        {/* ======================= */}
        {activeTab === 'SERVICES' && (
          <div className="bg-white rounded-xl shadow-sm border border-sage-100 overflow-hidden">
             <div className="p-6 border-b border-sage-100 flex justify-between items-center">
                <h3 className="font-serif text-xl text-sage-900 font-bold">Manage Services</h3>
                <button 
                  onClick={() => openServiceModal()}
                  className="bg-sage-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-sage-700 transition-colors"
                >
                   <PlusCircle size={18} /> Add New Service
                </button>
             </div>
             
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-sage-50 border-b border-sage-200">
                    <tr>
                      <th className="p-4 font-medium text-sage-600 text-sm">Image</th>
                      <th className="p-4 font-medium text-sage-600 text-sm">Service Details</th>
                      <th className="p-4 font-medium text-sage-600 text-sm">Price</th>
                      <th className="p-4 font-medium text-sage-600 text-sm">Duration</th>
                      <th className="p-4 font-medium text-sage-600 text-sm">Facilities</th>
                      <th className="p-4 font-medium text-sage-600 text-sm">Status</th>
                      <th className="p-4 font-medium text-sage-600 text-sm w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sage-100">
                    {services.map(service => (
                      <tr key={service.id} className={`hover:bg-sage-50/50 transition ${service.isArchived ? 'opacity-60 bg-gray-50' : ''}`}>
                         <td className="p-4 w-24">
                            <img src={service.image} alt={service.title} className="w-16 h-12 object-cover rounded-md bg-sage-200" />
                         </td>
                         <td className="p-4">
                            <p className="font-bold text-sage-900">{service.title}</p>
                            <p className="text-xs text-sage-500 line-clamp-1">{service.description}</p>
                         </td>
                         <td className="p-4 font-medium text-sage-900">{new Intl.NumberFormat('id-ID').format(service.price)}</td>
                         <td className="p-4 text-sm text-sage-600">{service.durationMin} mins</td>
                         <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                               {service.facilities.slice(0, 3).map((f, i) => (
                                 <span key={i} className="text-[10px] bg-sage-100 text-sage-700 px-1.5 py-0.5 rounded">{f}</span>
                               ))}
                               {service.facilities.length > 3 && <span className="text-[10px] text-sage-400">+{service.facilities.length - 3}</span>}
                            </div>
                         </td>
                         <td className="p-4">
                            {service.isArchived ? (
                               <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-200 text-gray-600 text-xs font-bold">
                                  <Archive size={10} /> Archived
                               </span>
                            ) : (
                               <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold">
                                  <CheckCircle size={10} /> Active
                               </span>
                            )}
                         </td>
                         <td className="p-4">
                            {!service.isArchived && (
                              <div className="flex gap-2">
                                 <button onClick={() => openServiceModal(service)} className="p-1.5 text-sage-600 hover:bg-sage-100 rounded transition"><Edit size={16} /></button>
                                 <button onClick={() => handleArchiveService(service.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition"><Trash2 size={16} /></button>
                              </div>
                            )}
                         </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}

      </div>

      {/* --- MODALS --- */}

      {/* SERVICE FORM MODAL */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl w-full max-w-2xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-2xl font-serif text-sage-900">{editingService ? 'Edit Service' : 'Add New Service'}</h3>
                 <button onClick={() => setShowServiceModal(false)}><X className="text-sage-500 hover:text-sage-900" /></button>
              </div>
              <form onSubmit={handleServiceSubmit} className="space-y-6">
                 {/* Basic Info */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                       <label className="block text-sm font-medium text-sage-700 mb-1">Service Title</label>
                       <input 
                         required 
                         className="w-full p-3 border border-sage-200 rounded-lg bg-white text-sage-900 focus:ring-2 focus:ring-sage-500 outline-none" 
                         value={serviceForm.title} 
                         onChange={e => setServiceForm({...serviceForm, title: e.target.value})}
                         placeholder="e.g. Royal Javanese Massage"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-sage-700 mb-1">Price (IDR)</label>
                       <input 
                         required 
                         type="number"
                         className="w-full p-3 border border-sage-200 rounded-lg bg-white text-sage-900 focus:ring-2 focus:ring-sage-500 outline-none" 
                         value={serviceForm.price} 
                         onChange={e => setServiceForm({...serviceForm, price: Number(e.target.value)})}
                         placeholder="e.g. 450000"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-sage-700 mb-1">Duration (Minutes)</label>
                       <input 
                         required 
                         type="number"
                         className="w-full p-3 border border-sage-200 rounded-lg bg-white text-sage-900 focus:ring-2 focus:ring-sage-500 outline-none" 
                         value={serviceForm.durationMin} 
                         onChange={e => setServiceForm({...serviceForm, durationMin: Number(e.target.value)})}
                         placeholder="e.g. 90"
                       />
                    </div>
                    <div className="md:col-span-2">
                       <label className="block text-sm font-medium text-sage-700 mb-1">Description</label>
                       <textarea 
                         required 
                         className="w-full p-3 border border-sage-200 rounded-lg bg-white text-sage-900 focus:ring-2 focus:ring-sage-500 outline-none resize-none h-24" 
                         value={serviceForm.description} 
                         onChange={e => setServiceForm({...serviceForm, description: e.target.value})}
                         placeholder="Describe the treatment..."
                       />
                    </div>
                 </div>

                 {/* Image URL Input */}
                 <div>
                    <label className="block text-sm font-medium text-sage-700 mb-1">Image URL</label>
                    <div className="flex gap-2">
                       <div className="relative flex-1">
                          <ImageIcon className="absolute left-3 top-3 text-sage-400" size={18} />
                          <input 
                            required 
                            className="w-full pl-10 pr-3 py-3 border border-sage-200 rounded-lg bg-white text-sage-900 focus:ring-2 focus:ring-sage-500 outline-none" 
                            value={serviceForm.image} 
                            onChange={e => setServiceForm({...serviceForm, image: e.target.value})}
                            placeholder="https://..."
                          />
                       </div>
                    </div>
                    {serviceForm.image && (
                       <div className="mt-2 h-32 w-full bg-sage-50 rounded-lg overflow-hidden border border-sage-200">
                          <img src={serviceForm.image} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                       </div>
                    )}
                 </div>

                 {/* Facilities */}
                 <div>
                    <label className="block text-sm font-medium text-sage-700 mb-1">Facilities Included</label>
                    <div className="flex gap-2 mb-2">
                       <input 
                         className="flex-1 p-3 border border-sage-200 rounded-lg bg-white text-sage-900 focus:ring-2 focus:ring-sage-500 outline-none" 
                         value={newFacility} 
                         onChange={e => setNewFacility(e.target.value)}
                         placeholder="Add facility (e.g. Ginger Tea)"
                         onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFacility())}
                       />
                       <button type="button" onClick={addFacility} className="bg-sage-200 text-sage-800 px-4 rounded-lg font-medium hover:bg-sage-300">Add</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {serviceForm.facilities.map((f, i) => (
                          <span key={i} className="bg-sand-100 text-sage-800 px-3 py-1 rounded-full text-sm flex items-center gap-1 border border-sand-200">
                             {f} <button type="button" onClick={() => removeFacility(i)} className="hover:text-red-500"><X size={14} /></button>
                          </span>
                       ))}
                    </div>
                 </div>

                 <div className="flex gap-4 pt-4 border-t border-sage-100">
                    <button type="button" onClick={() => setShowServiceModal(false)} className="flex-1 py-3 text-sage-600 hover:bg-sage-50 rounded-lg font-medium transition">Cancel</button>
                    <button type="submit" className="flex-1 bg-sage-800 text-white py-3 rounded-lg font-bold hover:bg-sage-700 transition">
                       {editingService ? 'Update Service' : 'Create Service'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* REDEEM MODAL (Updated Scan Logic) */}
      {showRedeemModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-serif font-bold text-sage-900">
                {scannedData ? 'Confirm Redemption' : 'Redeem Voucher'}
              </h3>
              <button onClick={() => {setShowRedeemModal(false); setScannedData(null); setShowScanner(false);}} className="text-sage-400 hover:text-sage-600">
                <X size={24} />
              </button>
            </div>
            
            {scannedData ? (
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-sand-100 rounded-full flex items-center justify-center border-2 border-sage-200">
                  <QrCode size={40} className="text-sage-800" />
                </div>
                <div>
                  <p className="text-sm text-sage-500 mb-1 uppercase tracking-wider">Voucher Code Detected</p>
                  <p className="text-2xl font-mono font-bold text-sage-900 bg-sage-50 py-2 px-4 rounded-lg border border-sage-200 break-all">
                    {scannedData}
                  </p>
                </div>
                <div className="flex gap-3 w-full">
                  <button onClick={() => {setScannedData(null); setScanCooldown(false); setShowScanner(true);}} className="flex-1 border border-sage-300 text-sage-700 py-3 rounded-xl font-medium hover:bg-sage-50 transition-colors flex items-center justify-center gap-2">
                    <RefreshCw size={18} /> Rescan
                  </button>
                  <button onClick={confirmRedemption} className="flex-1 bg-sage-800 text-white py-3 rounded-xl font-medium hover:bg-sage-700 transition-colors shadow-lg">
                    Confirm
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {showScanner ? (
                  <div className="bg-black rounded-xl overflow-hidden relative h-64 flex items-center justify-center">
                      <video ref={videoRef} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 border-2 border-sage-500/50 pointer-events-none m-8 rounded-lg animate-pulse"></div>
                      <button onClick={() => setShowScanner(false)} className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setShowScanner(true)} className="py-4 border-2 border-dashed border-sage-300 rounded-xl flex flex-col items-center justify-center gap-2 text-sage-600 hover:border-sage-500 bg-white group">
                        <Camera size={24} className="group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">Scan Camera</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="py-4 border-2 border-dashed border-sage-300 rounded-xl flex flex-col items-center justify-center gap-2 text-sage-600 hover:border-sage-500 bg-white group relative">
                        <Upload size={24} className="group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">Upload Image</span>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </button>
                  </div>
                )}
                <div className="relative flex items-center py-2"><div className="flex-grow border-t border-gray-200"></div><span className="flex-shrink-0 mx-4 text-gray-400 text-sm">OR</span><div className="flex-grow border-t border-gray-200"></div></div>
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-2 bg-white text-sage-900">Enter Voucher Code Manually</label>
                  <input type="text" value={redeemInput} onChange={(e) => setRedeemInput(e.target.value.toUpperCase())} placeholder="KAL-2025-XXXX" className="w-full p-3 text-center font-mono text-lg border-2 border-sage-200 bg-white text-sage-900 rounded-xl uppercase" />
                </div>
                <button onClick={() => handleRedeem(redeemInput)} className="w-full bg-sage-800 text-white py-3 rounded-xl font-medium hover:bg-sage-700 transition-colors">Validate & Redeem</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* POS MODAL */}
      {showPOSModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-2xl font-serif text-sage-900">Create Voucher (POS)</h3>
                 <button onClick={() => setShowPOSModal(false)}><X className="text-sage-500 hover:text-sage-900" /></button>
              </div>
              <form onSubmit={handleCreateVoucher} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-1">Select Service</label>
                  <select className="w-full p-3 border border-sage-200 rounded-lg bg-white text-sage-900" value={posServiceId} onChange={e => setPosServiceId(e.target.value)}>
                    {services.filter(s => !s.isArchived).map(s => <option key={s.id} value={s.id}>{s.title} - {new Intl.NumberFormat('id-ID').format(s.price)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-1">Customer Name</label>
                  <input required className="w-full p-3 border border-sage-200 rounded-lg bg-white text-sage-900" placeholder="Full Name" value={posName} onChange={e => setPosName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-1">Email</label>
                  <input required type="email" className="w-full p-3 border border-sage-200 rounded-lg bg-white text-sage-900" placeholder="customer@example.com" value={posEmail} onChange={e => setPosEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-1">Contact (WhatsApp)</label>
                  <input required className="w-full p-3 border border-sage-200 rounded-lg bg-white text-sage-900" placeholder="0812..." value={posPhone} onChange={e => setPosPhone(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-1">Payment Method</label>
                  <select className="w-full p-3 border border-sage-200 rounded-lg bg-white text-sage-900" value={posPayment} onChange={e => setPosPayment(e.target.value as any)}>
                    <option value="CASH">Cash</option>
                    <option value="QRIS">QRIS</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="COMPLIMENTARY">Complimentary / VIP (Rp 0)</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-sand-500 text-white py-3 rounded-lg font-bold hover:bg-sand-600 mt-4">Generate Voucher</button>
              </form>
           </div>
        </div>
      )}

      {/* CUSTOMER HISTORY MODAL */}
      {showHistoryModal && (
         <div className="fixed inset-0 bg-black/20 z-50 flex justify-end">
           <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-center mb-6 border-b border-sage-100 pb-4">
                 <div>
                   <h3 className="text-xl font-serif text-sage-900">{selectedCustomerName}</h3>
                   <p className="text-sm text-sage-500">{selectedCustomerPhone}</p>
                 </div>
                 <button onClick={() => setShowHistoryModal(false)}><X /></button>
              </div>
              <h4 className="font-bold text-sage-700 mb-4 flex items-center gap-2"><History size={16}/> Purchase History</h4>
              <div className="space-y-4">
                 {customerHistory.map(tx => (
                   <div key={tx.id} className="border border-sage-100 rounded-lg p-4 bg-sage-50/50">
                      <div className="flex justify-between mb-2">
                        <span className="font-mono font-bold text-sm">{tx.id}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${tx.status === 'Aktif' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{tx.status}</span>
                      </div>
                      <p className="text-sm font-medium text-sage-900">{services.find(s => s.id === tx.serviceId)?.title}</p>
                      <p className="text-xs text-sage-500 mt-1">{tx.purchaseDate} • {new Intl.NumberFormat('id-ID').format(tx.amount)}</p>
                      
                      {tx.giftDetails?.isGift && (
                        <div className="mt-3 bg-white p-3 rounded border border-sage-200">
                           <div className="flex items-center gap-2 text-sand-600 font-bold text-xs uppercase mb-1">
                              <Gift size={12} /> Gift Voucher
                           </div>
                           <p className="text-sm text-sage-800 italic">To: {tx.giftDetails.recipientName}</p>
                           <p className="text-xs text-sage-500 mt-1">Message: "{tx.giftDetails.message}"</p>
                        </div>
                      )}
                   </div>
                 ))}
                 {customerHistory.length === 0 && <p className="text-center text-sage-400">No history found.</p>}
              </div>
           </div>
         </div>
      )}

      {/* AUDIT LOG MODAL (Existing) */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-8 shadow-2xl max-h-[80vh] flex flex-col">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-serif text-sage-900">Staff Audit Log</h3>
                <button onClick={() => setShowAuditModal(false)}><X /></button>
             </div>
             <div className="overflow-y-auto flex-1 pr-2">
                <table className="w-full text-left text-sm">
                  <thead className="bg-sage-50 sticky top-0">
                    <tr>
                      <th className="p-3 font-medium text-sage-600">Time</th>
                      <th className="p-3 font-medium text-sage-600">User</th>
                      <th className="p-3 font-medium text-sage-600">Action</th>
                      <th className="p-3 font-medium text-sage-600">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sage-100">
                     {auditLogs.length > 0 ? auditLogs.slice().reverse().map(log => (
                       <tr key={log.id}>
                         <td className="p-3 text-sage-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                         <td className="p-3 font-medium text-sage-900">{log.performedBy}</td>
                         <td className="p-3 text-sage-700"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{log.action}</span></td>
                         <td className="p-3 text-sage-600">{log.details}</td>
                       </tr>
                     )) : (
                       <tr><td colSpan={4} className="p-4 text-center text-sage-400">No logs recorded yet.</td></tr>
                     )}
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
