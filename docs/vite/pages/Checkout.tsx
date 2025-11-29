
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useForm } from 'react-hook-form';
import { ChevronLeft, CreditCard, Building2, QrCode as QrIcon, Lock, CheckCircle, Download, MessageCircle, Gift, Mail, User, Send } from 'lucide-react';
import { Transaction, VoucherStatus } from '../types';
import QRCode from 'react-qr-code';
import { useToast } from '../context/ToastContext';
import { jsPDF } from 'jspdf';
import QRCodeGenerator from 'qrcode';
import emailjs from '@emailjs/browser';

interface CheckoutForm {
  fullName: string;
  email: string;
  phone: string;
  notes?: string;
  paymentMethod: 'QRIS' | 'BANK_TRANSFER' | 'CREDIT_CARD';
  isGift: boolean;
  recipientName: string;
  message: string;
  sendTo: 'PURCHASER' | 'RECIPIENT';
  recipientEmail?: string;
  recipientPhone?: string;
}

const Checkout: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { services, addTransaction } = useStore();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'FORM' | 'SUCCESS'>('FORM');
  const [generatedCode, setGeneratedCode] = useState('');
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

  const service = services.find(s => s.id === id);
  const { register, handleSubmit, formState: { errors }, watch, getValues } = useForm<CheckoutForm>({
    defaultValues: {
      paymentMethod: 'QRIS',
      isGift: true, // Default as gift
      sendTo: 'PURCHASER'
    }
  });

  const selectedPayment = watch('paymentMethod');
  const isGift = watch('isGift');
  const sendTo = watch('sendTo');

  if (!service) return <div>Service not found</div>;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  };

  const sendConfirmationEmail = async (transaction: Transaction, code: string) => {
    try {
        // Determine target email
        const targetEmail = transaction.giftDetails?.sendTo === 'RECIPIENT' && transaction.giftDetails.recipientEmail 
            ? transaction.giftDetails.recipientEmail 
            : transaction.customer.email;

        // Determine target name (who is receiving the email)
        const targetName = transaction.giftDetails?.sendTo === 'RECIPIENT' 
             ? transaction.giftDetails.recipientName
             : transaction.customer.name;

        const templateParams = {
            to_name: targetName,
            to_email: targetEmail,
            service_name: service.title,
            voucher_code: code,
            amount: formatPrice(transaction.amount),
            expiry_date: transaction.expiryDate,
            message: transaction.giftDetails?.message || "Thank you for your purchase!",
            sender_name: transaction.giftDetails?.senderName || "Kalanara Spa"
        };

        // Example Service ID, Template ID, Public Key
        // await emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', templateParams, 'YOUR_PUBLIC_KEY');
        console.log("Simulated Email Send:", templateParams);
        
    } catch (error) {
        console.error("Failed to send email:", error);
    }
  };

  const onSubmit = async (data: CheckoutForm) => {
    setIsProcessing(true);
    
    // Simulate API Call
    await new Promise(resolve => setTimeout(resolve, 1500));

    const newCode = `KAL-2025-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 6);

    const transaction: Transaction = {
      id: newCode,
      serviceId: service.id,
      customer: {
        name: data.fullName, // Purchaser Name
        email: data.email, // Purchaser email
        phone: data.phone, // Purchaser phone
        notes: data.notes
      },
      purchaseDate: new Date().toISOString().split('T')[0],
      expiryDate: expiryDate.toISOString().split('T')[0],
      status: VoucherStatus.ACTIVE,
      amount: service.price,
      paymentMethod: data.paymentMethod,
      giftDetails: data.isGift ? {
        isGift: true,
        senderName: data.fullName, // Sender is the Purchaser
        recipientName: data.recipientName,
        message: data.message,
        sendTo: data.sendTo,
        recipientEmail: data.recipientEmail,
        recipientPhone: data.recipientPhone
      } : undefined
    };

    addTransaction(transaction);
    
    // Send Email in background
    sendConfirmationEmail(transaction, newCode);

    setGeneratedCode(newCode);
    setLastTransaction(transaction);
    setStep('SUCCESS');
    setIsProcessing(false);
    showToast('Payment successful! Voucher generated.', 'success');
  };

  const handleDownloadPDF = async () => {
    if (!lastTransaction) return;
    const doc = new jsPDF();
    
    // Background
    doc.setFillColor(244, 247, 244); // sage-50
    doc.rect(0, 0, 210, 297, 'F');

    // Header
    doc.setFillColor(42, 66, 42); // sage-800
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('times', 'bold');
    doc.text("KALANARA SPA", 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text("Rejuvenate Your Soul", 105, 30, { align: 'center' });

    const isGiftVoucher = lastTransaction.giftDetails?.isGift;
    // Adjust box height: 140 for standard, 190 for gift
    const boxHeight = isGiftVoucher ? 190 : 140;
    
    // Voucher Box
    doc.setDrawColor(42, 66, 42);
    doc.setLineWidth(1);
    doc.rect(20, 60, 170, boxHeight);

    // Voucher Title
    doc.setTextColor(42, 66, 42);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(service.title.toUpperCase(), 105, 80, { align: 'center' });

    // Voucher Code
    doc.setFontSize(12);
    doc.text("VOUCHER CODE:", 105, 95, { align: 'center' });
    doc.setFontSize(20);
    doc.setFont('courier', 'bold');
    doc.text(generatedCode, 105, 105, { align: 'center' });

    // Valid Until
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Valid Until: ${lastTransaction.expiryDate}`, 105, 115, { align: 'center' });

    // Issued To Logic
    const issuedToName = isGiftVoucher && lastTransaction.giftDetails?.recipientName 
        ? lastTransaction.giftDetails.recipientName 
        : lastTransaction.customer.name;
        
    doc.text(`Issued To: ${issuedToName}`, 105, 125, { align: 'center' });

    // Generate QR Code Image
    try {
      const qrDataUrl = await QRCodeGenerator.toDataURL(generatedCode, {
        width: 200,
        margin: 1,
        color: {
          dark: '#2a422a',
          light: '#ffffff'
        }
      });
      
      // Add QR Code Image (Centered under customer name)
      // x = 105 (center) - 17.5 (half width) = 87.5
      doc.addImage(qrDataUrl, 'PNG', 87.5, 130, 35, 35);
      
    } catch (err) {
      console.error("Error generating QR for PDF", err);
      showToast('Warning: QR Code could not be generated for PDF', 'error');
    }

    // Gift Section
    if (isGiftVoucher && lastTransaction.giftDetails) {
       // Separator
       doc.setDrawColor(200, 200, 200);
       doc.line(40, 175, 170, 175);

       doc.setTextColor(42, 66, 42);
       doc.setFont('times', 'italic');
       doc.setFontSize(12);
       
       const msg = lastTransaction.giftDetails.message;
       const splitMsg = doc.splitTextToSize(`"${msg}"`, 140);
       doc.text(splitMsg, 105, 188, { align: 'center' });

       doc.setFont('helvetica', 'normal');
       doc.setFontSize(10);
       doc.text(`Voucher ini dikirim oleh: ${lastTransaction.giftDetails.senderName}`, 105, 215, { align: 'center' });
    }

    // Instructions
    // Footer Y position depends on box height
    const footerY = 60 + boxHeight + 10;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text("Please present this voucher code or QR code at the reception.", 105, footerY, { align: 'center' });
    doc.text("Booking required 24 hours in advance.", 105, footerY + 5, { align: 'center' });

    doc.save(`Kalanara_Voucher_${generatedCode}.pdf`);
    showToast('PDF Downloaded', 'success');
  };

  const handleWhatsApp = () => {
    let targetPhone = ""; 
    let text = "";

    if (lastTransaction?.giftDetails?.isGift) {
        const isRecipient = lastTransaction.giftDetails.sendTo === 'RECIPIENT';
        const sender = lastTransaction.giftDetails.senderName;
        const recipientName = lastTransaction.giftDetails.recipientName;
        
        // If "Send to Recipient" was chosen, target their number
        if (isRecipient && lastTransaction.giftDetails.recipientPhone) {
             const cleanPhone = lastTransaction.giftDetails.recipientPhone.replace(/\D/g, '').replace(/^0/, '62');
             targetPhone = cleanPhone;
             text = `Hi ${recipientName}! This gift voucher of ${service.title} at Kalanara Spa is for you!. Voucher Code: ${generatedCode}. "${lastTransaction.giftDetails.message}"`;
        } else {
             // Default to Purchaser
             const cleanPhone = lastTransaction.customer.phone.replace(/\D/g, '').replace(/^0/, '62');
             targetPhone = cleanPhone;
             text = `Hi! I (Purchaser) received this voucher for ${recipientName}. Sent by ${sender}. Code: ${generatedCode}.`;
        }
    } else {
         const cleanPhone = lastTransaction?.customer.phone.replace(/\D/g, '').replace(/^0/, '62') || "";
         targetPhone = cleanPhone;
         text = `Hi Kalanara Spa! I just purchased a voucher for ${service.title}. My Voucher Code is ${generatedCode}. Can I book a slot?`;
    }
    
    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleEmail = () => {
     if (!lastTransaction) return;
     
     const isRecipient = lastTransaction.giftDetails?.sendTo === 'RECIPIENT';
     const targetEmail = isRecipient && lastTransaction.giftDetails?.recipientEmail 
        ? lastTransaction.giftDetails.recipientEmail 
        : lastTransaction.customer.email;
     
     const subject = `Your Kalanara Spa Voucher: ${service.title}`;
     const body = `Hi! This ${service.title} gift voucher is for you!.\nCode: ${generatedCode}\nValid until: ${lastTransaction.expiryDate}`;
     
     window.open(`mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  if (step === 'SUCCESS') {
    return (
      <div className="min-h-screen bg-sand-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-sage-100">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="font-serif text-3xl text-sage-900 mb-2">Payment Successful!</h2>
          <p className="text-sage-600 mb-6">Your voucher is ready to use.</p>

          <div className="flex justify-center mb-6">
             <div className="p-4 bg-white border-2 border-sage-100 rounded-xl shadow-inner">
                <QRCode 
                  value={generatedCode}
                  size={160}
                  fgColor="#2a422a" // sage-800
                  bgColor="#ffffff"
                />
             </div>
          </div>

          <div className="bg-sand-100 p-4 rounded-lg mb-8 border border-dashed border-sage-300">
            <p className="text-xs uppercase tracking-widest text-sage-500 mb-1">Voucher Code</p>
            <p className="text-2xl font-mono font-bold text-sage-900 tracking-wider">{generatedCode}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button 
              onClick={handleWhatsApp}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 transition"
            >
              <MessageCircle className="text-green-600 mb-1" size={20} />
              <span className="text-xs font-medium text-green-800">Send to WhatsApp</span>
            </button>
            <button 
              onClick={handleEmail}
              className="flex flex-col items-center justify-center p-3 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
            >
              <Mail className="text-blue-600 mb-1" size={20} />
              <span className="text-xs font-medium text-blue-800">Send to Email</span>
            </button>
          </div>
          
          <button 
              onClick={handleDownloadPDF}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-sage-200 hover:bg-sage-50 transition mb-6"
            >
              <Download className="text-sage-700" size={20} />
              <span className="text-sm font-medium text-sage-800">Download PDF Voucher</span>
          </button>

          <Link 
            to="/" 
            className="block w-full bg-sage-800 text-white py-3 rounded-full hover:bg-sage-700 transition"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="bg-white border-b border-sage-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center">
          <button onClick={() => navigate(-1)} className="text-sage-600 hover:text-sage-900">
            <ChevronLeft />
          </button>
          <h1 className="ml-4 font-serif text-lg text-sage-900">Secure Checkout</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          
          {/* Order Summary */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-sage-100">
            <div className="flex gap-4">
              <img src={service.image} alt="thumb" className="w-20 h-20 object-cover rounded-lg" />
              <div className="flex-1">
                <h3 className="font-serif text-lg text-sage-900">{service.title}</h3>
                <p className="text-sage-500 text-sm">{service.durationMin} Mins</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sage-900">{formatPrice(service.price)}</p>
              </div>
            </div>
          </section>

          {/* Purchaser Information */}
          <section>
            <h3 className="font-serif text-xl text-sage-900 mb-4">Purchaser Information (Sender)</h3>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-sage-100 space-y-4">
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">Full Name</label>
                <input 
                  {...register('fullName', { required: 'Purchaser Name is required' })}
                  className="w-full p-3 rounded-lg border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
                  placeholder="e.g. Jane Doe"
                />
                {errors.fullName && <span className="text-red-500 text-sm">{errors.fullName.message}</span>}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-sage-700 mb-1">Email</label>
                    <input 
                      type="email"
                      {...register('email', { 
                          required: 'Email is required',
                          pattern: { value: /^\S+@\S+$/i, message: "Invalid email" }
                      })}
                      className="w-full p-3 rounded-lg border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
                      placeholder="name@example.com"
                    />
                    {errors.email && <span className="text-red-500 text-sm">{errors.email.message}</span>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-sage-700 mb-1">WhatsApp (Phone)</label>
                    <input 
                      type="tel"
                      {...register('phone', { required: 'WhatsApp number is required' })}
                      className="w-full p-3 rounded-lg border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
                      placeholder="e.g. 08123456789"
                    />
                    {errors.phone && <span className="text-red-500 text-sm">{errors.phone.message}</span>}
                  </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">Special Notes (Optional)</label>
                <textarea 
                  {...register('notes')}
                  className="w-full p-3 rounded-lg border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none h-24 resize-none"
                  placeholder="Any allergies or special requests?"
                />
              </div>
            </div>
          </section>

          {/* Gift Options */}
          <section>
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-serif text-xl text-sage-900 flex items-center gap-2"><Gift className="text-sand-500"/> Gift Options</h3>
               <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" {...register('isGift')} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage-600"></div>
                  <span className="ml-3 text-sm font-medium text-sage-700">Send as Gift</span>
                </label>
            </div>
            
            {isGift && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-sage-100 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                 
                 {/* Recipient Name & Message */}
                 <div className="grid grid-cols-1 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-sage-700 mb-1">Recipient Name</label>
                        <input 
                          {...register('recipientName', { required: isGift ? 'Recipient name is required' : false })}
                          className="w-full p-3 rounded-lg border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
                          placeholder="Who is this gift for?"
                        />
                        {errors.recipientName && <span className="text-red-500 text-sm">{errors.recipientName.message}</span>}
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-sage-700 mb-1">Personal Message</label>
                        <textarea 
                          {...register('message')}
                          maxLength={200}
                          className="w-full p-3 rounded-lg border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none h-24 resize-none"
                          placeholder="e.g. Happy Anniversary! Hope you enjoy this relaxing day."
                        />
                        <p className="text-right text-xs text-sage-400 mt-1">{watch('message')?.length || 0}/200</p>
                     </div>
                 </div>

                 {/* Delivery Options */}
                 <div className="border-t border-sage-100 pt-4">
                     <label className="block text-sm font-medium text-sage-700 mb-3">Send Voucher To:</label>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className={`cursor-pointer border p-4 rounded-xl flex items-center gap-3 transition-all ${sendTo === 'PURCHASER' ? 'border-sage-600 bg-sage-50' : 'border-sage-200 hover:border-sage-400'}`}>
                           <input type="radio" value="PURCHASER" {...register('sendTo')} className="w-4 h-4 text-sage-600 accent-sage-600" />
                           <User size={20} className="text-sage-600"/>
                           <div>
                              <p className="font-medium text-sage-900">Me (Purchaser)</p>
                              <p className="text-xs text-sage-500">Sent to your email/WA</p>
                           </div>
                        </label>

                        <label className={`cursor-pointer border p-4 rounded-xl flex items-center gap-3 transition-all ${sendTo === 'RECIPIENT' ? 'border-sage-600 bg-sage-50' : 'border-sage-200 hover:border-sage-400'}`}>
                           <input type="radio" value="RECIPIENT" {...register('sendTo')} className="w-4 h-4 text-sage-600 accent-sage-600" />
                           <Send size={20} className="text-sage-600"/>
                           <div>
                              <p className="font-medium text-sage-900">The Recipient</p>
                              <p className="text-xs text-sage-500">Sent directly to them</p>
                           </div>
                        </label>
                     </div>

                     {/* Recipient Contact Fields */}
                     {sendTo === 'RECIPIENT' && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                             <div>
                                <label className="block text-sm font-medium text-sage-700 mb-1">Recipient Email</label>
                                <input 
                                  type="email"
                                  {...register('recipientEmail', { 
                                      required: sendTo === 'RECIPIENT' ? 'Recipient email is required' : false,
                                      pattern: { value: /^\S+@\S+$/i, message: "Invalid email" }
                                  })}
                                  className="w-full p-3 rounded-lg border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
                                  placeholder="recipient@example.com"
                                />
                                {errors.recipientEmail && <span className="text-red-500 text-sm">{errors.recipientEmail.message}</span>}
                             </div>
                             
                             <div>
                                <label className="block text-sm font-medium text-sage-700 mb-1">Recipient WhatsApp</label>
                                <input 
                                  type="tel"
                                  {...register('recipientPhone', { required: sendTo === 'RECIPIENT' ? 'Recipient WhatsApp is required' : false })}
                                  className="w-full p-3 rounded-lg border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 focus:ring-2 focus:ring-sage-500 focus:border-transparent outline-none"
                                  placeholder="e.g. 08123456789"
                                />
                                {errors.recipientPhone && <span className="text-red-500 text-sm">{errors.recipientPhone.message}</span>}
                             </div>
                        </div>
                     )}
                 </div>
              </div>
            )}
          </section>

          {/* Payment Method */}
          <section>
            <h3 className="font-serif text-xl text-sage-900 mb-4">Payment Method</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className={`cursor-pointer border-2 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${selectedPayment === 'QRIS' ? 'border-sage-600 bg-sage-50' : 'border-white bg-white hover:border-sage-200'}`}>
                <input type="radio" value="QRIS" {...register('paymentMethod')} className="hidden" />
                <QrIcon size={32} className="text-sage-700" />
                <span className="font-medium text-sage-900">QRIS</span>
              </label>

              <label className={`cursor-pointer border-2 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${selectedPayment === 'BANK_TRANSFER' ? 'border-sage-600 bg-sage-50' : 'border-white bg-white hover:border-sage-200'}`}>
                <input type="radio" value="BANK_TRANSFER" {...register('paymentMethod')} className="hidden" />
                <Building2 size={32} className="text-sage-700" />
                <span className="font-medium text-sage-900">Bank Transfer</span>
              </label>

              <label className={`cursor-pointer border-2 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${selectedPayment === 'CREDIT_CARD' ? 'border-sage-600 bg-sage-50' : 'border-white bg-white hover:border-sage-200'}`}>
                <input type="radio" value="CREDIT_CARD" {...register('paymentMethod')} className="hidden" />
                <CreditCard size={32} className="text-sage-700" />
                <span className="font-medium text-sage-900">Credit Card</span>
              </label>
            </div>
          </section>

          <button 
            type="submit" 
            disabled={isProcessing}
            className="w-full bg-sage-800 text-white py-4 rounded-xl text-lg font-semibold shadow-lg hover:bg-sage-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>Processing...</>
            ) : (
              <>
                <Lock size={18} /> Pay {formatPrice(service.price)}
              </>
            )}
          </button>

        </form>
      </main>
    </div>
  );
};

export default Checkout;
