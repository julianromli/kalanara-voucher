
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Service, Transaction, VoucherStatus, StoreContextType, AuditLogEntry, Review, PublicVoucherInfo } from '../types';
import { MOCK_SERVICES, MOCK_TRANSACTIONS, MOCK_REVIEWS } from '../constants';

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize Services from LocalStorage
  const [services, setServices] = useState<Service[]>(() => {
    try {
      const saved = localStorage.getItem('kalanara_services');
      return saved && saved !== "undefined" ? JSON.parse(saved) : MOCK_SERVICES;
    } catch {
      return MOCK_SERVICES;
    }
  });
  
  // Initialize transactions from LocalStorage
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('kalanara_transactions');
      return saved && saved !== "undefined" ? JSON.parse(saved) : MOCK_TRANSACTIONS;
    } catch (error) {
      console.error("Failed to load transactions from storage", error);
      return MOCK_TRANSACTIONS;
    }
  });

  // Initialize Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('kalanara_audit_logs');
      return saved && saved !== "undefined" ? JSON.parse(saved) : [];
    } catch (error) {
      return [];
    }
  });

  // Initialize Reviews
  const [reviews, setReviews] = useState<Review[]>(() => {
    try {
      const saved = localStorage.getItem('kalanara_reviews');
      return saved && saved !== "undefined" ? JSON.parse(saved) : MOCK_REVIEWS;
    } catch (error) {
      return MOCK_REVIEWS;
    }
  });

  // Sync Services to LS
  useEffect(() => {
    try {
      localStorage.setItem('kalanara_services', JSON.stringify(services));
    } catch (error) {
      console.error("Failed to save services to storage", error);
    }
  }, [services]);

  // Sync Transactions to LS
  useEffect(() => {
    try {
      localStorage.setItem('kalanara_transactions', JSON.stringify(transactions));
    } catch (error) {
      console.error("Failed to save transactions to storage", error);
    }
  }, [transactions]);

  // Sync Audit Logs to LS
  useEffect(() => {
    try {
      localStorage.setItem('kalanara_audit_logs', JSON.stringify(auditLogs));
    } catch (error) {
      console.error("Failed to save audit logs to storage", error);
    }
  }, [auditLogs]);

  // Sync Reviews to LS
  useEffect(() => {
    try {
      localStorage.setItem('kalanara_reviews', JSON.stringify(reviews));
    } catch (error) {
      console.error("Failed to save reviews to storage", error);
    }
  }, [reviews]);

  // Cross-tab synchronization
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'kalanara_transactions') {
        try {
          const newValue = event.newValue;
          if (newValue && newValue !== "undefined") {
            setTransactions(JSON.parse(newValue));
          }
        } catch (e) {
          console.error("Error syncing transactions across tabs", e);
        }
      }
      if (event.key === 'kalanara_audit_logs') {
        try {
          const newValue = event.newValue;
          if (newValue && newValue !== "undefined") {
            setAuditLogs(JSON.parse(newValue));
          }
        } catch (e) {
          console.error("Error syncing audit logs across tabs", e);
        }
      }
      if (event.key === 'kalanara_reviews') {
        try {
          const newValue = event.newValue;
          if (newValue && newValue !== "undefined") {
            setReviews(JSON.parse(newValue));
          }
        } catch (e) {
          console.error("Error syncing reviews across tabs", e);
        }
      }
      if (event.key === 'kalanara_services') {
        try {
          const newValue = event.newValue;
          if (newValue && newValue !== "undefined") {
            setServices(JSON.parse(newValue));
          }
        } catch (e) {
          console.error("Error syncing services across tabs", e);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const addLog = (action: string, details: string, performedBy: string) => {
    const newLog: AuditLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      action,
      details,
      performedBy
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const addTransaction = (transaction: Transaction) => {
    setTransactions((prev) => [transaction, ...prev]);
  };

  const createVoucher = (transaction: Transaction, performedBy: string) => {
    setTransactions((prev) => [transaction, ...prev]);
    addLog('CREATE_VOUCHER', `Created manual voucher ${transaction.id} for ${transaction.customer.name}`, performedBy);
  };

  const redeemVoucher = (code: string, performedBy: string) => {
    const txIndex = transactions.findIndex((t) => t.id === code);
    if (txIndex === -1) {
      return { success: false, message: 'Voucher not found.' };
    }

    const tx = transactions[txIndex];
    if (tx.status === VoucherStatus.REDEEMED) {
      return { success: false, message: 'Voucher has already been redeemed.' };
    }
    if (tx.status === VoucherStatus.EXPIRED) {
      return { success: false, message: 'Voucher has expired.' };
    }
    if (tx.status === VoucherStatus.VOIDED) {
      return { success: false, message: 'Voucher has been voided.' };
    }

    // Update status
    const updatedTx = { ...tx, status: VoucherStatus.REDEEMED };
    const newTransactions = [...transactions];
    newTransactions[txIndex] = updatedTx;
    setTransactions(newTransactions);
    
    addLog('REDEEM_VOUCHER', `Redeemed voucher ${code}`, performedBy);

    return { success: true, message: `Voucher ${code} redeemed successfully!` };
  };

  // Public verification method (Sanitized Data)
  const verifyVoucher = (code: string): PublicVoucherInfo | null => {
    // In a real app, this would be an API call: await api.get(`/verify/${code}`)
    const tx = transactions.find((t) => t.id === code);
    
    if (!tx) return null;

    const service = services.find(s => s.id === tx.serviceId);

    return {
      code: tx.id,
      serviceTitle: service?.title || 'Unknown Service',
      serviceImage: service?.image || '',
      expiryDate: tx.expiryDate,
      status: tx.status,
      isGift: !!tx.giftDetails?.isGift,
      senderName: tx.giftDetails?.senderName
    };
  };

  const updateVoucherStatus = (id: string, status: VoucherStatus) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const extendVoucher = (id: string, days: number, performedBy: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    const currentExpiry = new Date(tx.expiryDate);
    currentExpiry.setDate(currentExpiry.getDate() + days);
    const newExpiryDate = currentExpiry.toISOString().split('T')[0];

    setTransactions(prev => prev.map(t => t.id === id ? { ...t, expiryDate: newExpiryDate } : t));
    addLog('EXTEND_VOUCHER', `Extended voucher ${id} by ${days} days. New expiry: ${newExpiryDate}`, performedBy);
  };

  const voidVoucher = (id: string, reason: string, performedBy: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: VoucherStatus.VOIDED } : t));
    addLog('VOID_VOUCHER', `Voided voucher ${id}. Reason: ${reason}`, performedBy);
  };

  const addReview = (review: Review) => {
    setReviews(prev => [review, ...prev]);
  };

  // Service Management Methods
  const addService = (service: Service, performedBy: string) => {
    setServices(prev => [...prev, service]);
    addLog('ADD_SERVICE', `Added new service: ${service.title}`, performedBy);
  };

  const updateService = (id: string, updatedData: Partial<Service>, performedBy: string) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...updatedData } : s));
    addLog('UPDATE_SERVICE', `Updated service: ${id}`, performedBy);
  };

  const deleteService = (id: string, performedBy: string) => {
    // Soft delete
    setServices(prev => prev.map(s => s.id === id ? { ...s, isArchived: true } : s));
    addLog('DELETE_SERVICE', `Archived service: ${id}`, performedBy);
  };

  return (
    <StoreContext.Provider value={{ 
      services, 
      transactions, 
      auditLogs,
      reviews, 
      addTransaction, 
      createVoucher, 
      redeemVoucher, 
      verifyVoucher,
      updateVoucherStatus, 
      extendVoucher, 
      voidVoucher, 
      addReview,
      addService,
      updateService,
      deleteService
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
