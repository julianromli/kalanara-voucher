
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { ShieldCheck, Search, CheckCircle, AlertCircle, Calendar, Gift, Loader2 } from 'lucide-react';
import { PublicVoucherInfo, VoucherStatus } from '../types';

const VerifyVoucher: React.FC = () => {
  const { verifyVoucher } = useStore();
  
  const [inputCode, setInputCode] = useState('');
  const [result, setResult] = useState<PublicVoucherInfo | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    setIsLoading(true);
    setError('');
    setResult(null);
    setHasSearched(false);

    // Simulate network delay for realistic UX
    setTimeout(() => {
      const voucherData = verifyVoucher(inputCode.trim().toUpperCase());
      
      if (voucherData) {
        setResult(voucherData);
      } else {
        setError('Voucher code not found. Please check your code and try again.');
      }
      setHasSearched(true);
      setIsLoading(false);
    }, 800);
  };

  const getStatusColor = (status: VoucherStatus) => {
    switch (status) {
      case VoucherStatus.ACTIVE: return 'text-green-600 bg-green-50 border-green-200';
      case VoucherStatus.REDEEMED: return 'text-gray-600 bg-gray-50 border-gray-200';
      case VoucherStatus.EXPIRED: return 'text-red-600 bg-red-50 border-red-200';
      case VoucherStatus.VOIDED: return 'text-red-800 bg-red-100 border-red-200';
      default: return 'text-sage-600';
    }
  };

  return (
    <div className="min-h-screen bg-sand-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-sage-800 rounded-full flex items-center justify-center mx-auto mb-4 text-sand-100 shadow-xl">
          <ShieldCheck size={32} />
        </div>
        <h1 className="font-serif text-3xl md:text-4xl text-sage-900 mb-2">Check Voucher Status</h1>
        <p className="text-sage-600">Verify the validity of your Kalanara Spa voucher.</p>
      </div>

      <div className="w-full max-w-md">
        <form onSubmit={handleVerify} className="relative mb-8">
          <div className="relative">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="Enter Voucher Code (e.g. KAL-2025-ABCD)"
              className="w-full pl-5 pr-14 py-4 rounded-xl border-2 border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none text-lg font-mono uppercase shadow-sm transition-all"
            />
            <button
              type="submit"
              disabled={isLoading || !inputCode}
              className="absolute right-2 top-2 bottom-2 bg-sage-800 text-white p-3 rounded-lg hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            </button>
          </div>
        </form>

        {hasSearched && !isLoading && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4 shadow-sm">
                <AlertCircle className="text-red-500 shrink-0 mt-1" size={24} />
                <div>
                  <h3 className="text-red-800 font-bold text-lg mb-1">Invalid Code</h3>
                  <p className="text-red-600">{error}</p>
                </div>
              </div>
            ) : result && (
              <div className="bg-white rounded-2xl shadow-xl border border-sage-100 overflow-hidden">
                {/* Status Header */}
                <div className={`p-6 border-b flex items-center justify-between ${getStatusColor(result.status)}`}>
                  <div className="flex items-center gap-2">
                    {result.status === VoucherStatus.ACTIVE ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                    <span className="font-bold text-xl tracking-wide">{result.status}</span>
                  </div>
                  <span className="font-mono font-medium opacity-80">{result.code}</span>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8">
                  <div className="flex gap-4 mb-6">
                     <img 
                       src={result.serviceImage || 'https://via.placeholder.com/150'} 
                       alt={result.serviceTitle} 
                       className="w-20 h-20 object-cover rounded-lg bg-sage-100"
                     />
                     <div>
                       <p className="text-sm text-sage-500 uppercase tracking-wider mb-1">Service Package</p>
                       <h3 className="font-serif text-2xl text-sage-900 leading-tight">{result.serviceTitle}</h3>
                     </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sage-700 bg-sand-50 p-4 rounded-xl">
                      <Calendar className="text-sage-500" size={20} />
                      <div>
                        <p className="text-xs text-sage-500 uppercase">Valid Until</p>
                        <p className="font-medium">{result.expiryDate}</p>
                      </div>
                    </div>

                    {result.isGift && (
                      <div className="flex items-center gap-3 text-sage-700 bg-sand-50 p-4 rounded-xl">
                        <Gift className="text-sand-500" size={20} />
                        <div>
                          <p className="text-xs text-sage-500 uppercase">Gifted By</p>
                          <p className="font-medium italic">{result.senderName}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {result.status === VoucherStatus.ACTIVE && (
                    <div className="mt-8 text-center text-sm text-sage-500 bg-sage-50 p-4 rounded-lg border border-sage-100 border-dashed">
                      Please present your voucher code at the reception desk upon arrival.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyVoucher;
