
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { Star, CheckCircle, ChevronLeft } from 'lucide-react';
import { VoucherStatus } from '../types';

const ReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Transaction ID
  const { transactions, services, addReview, reviews } = useStore();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const transaction = transactions.find(t => t.id === id);
  const existingReview = reviews.find(r => r.transactionId === id);
  const service = transaction ? services.find(s => s.id === transaction.serviceId) : null;

  useEffect(() => {
    if (existingReview) {
      setIsSubmitted(true);
    }
  }, [existingReview]);

  if (!transaction) {
    return (
      <div className="min-h-screen bg-sand-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-serif text-sage-900">Voucher Not Found</h2>
          <Link to="/" className="text-sand-600 mt-4 inline-block">Return Home</Link>
        </div>
      </div>
    );
  }

  if (transaction.status !== VoucherStatus.REDEEMED && !existingReview) {
    return (
       <div className="min-h-screen bg-sand-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-serif text-sage-900 mb-2">Experience Not Completed</h2>
          <p className="text-sage-600">
            You can only review a service after your voucher has been redeemed at the spa.
          </p>
          <Link to="/" className="text-sand-600 mt-4 inline-block">Return Home</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      showToast('Please select a star rating', 'error');
      return;
    }

    addReview({
      id: `rev_${Math.random().toString(36).substring(2, 9)}`,
      transactionId: transaction.id,
      customerName: transaction.customer.name,
      serviceTitle: service?.title || 'Unknown Service',
      rating,
      comment,
      date: new Date().toISOString().split('T')[0]
    });

    setIsSubmitted(true);
    showToast('Thank you for your feedback!', 'success');
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-sand-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-sage-100">
          <div className="w-20 h-20 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-6">
             <Star size={40} className="text-sand-500 fill-sand-500" />
          </div>
          <h2 className="font-serif text-3xl text-sage-900 mb-2">Thank You!</h2>
          <p className="text-sage-600 mb-8">Your review helps us improve our sanctuary.</p>
          <Link to="/" className="bg-sage-800 text-white py-3 px-8 rounded-full hover:bg-sage-700 transition">
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
          <Link to="/" className="text-sage-600 hover:text-sage-900">
            <ChevronLeft />
          </Link>
          <h1 className="ml-4 font-serif text-lg text-sage-900">Write a Review</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-sage-100 overflow-hidden">
          <div className="p-6 bg-sage-50 border-b border-sage-100">
            <p className="text-xs text-sage-500 uppercase tracking-wider mb-1">Reviewing Service</p>
            <h2 className="font-serif text-2xl text-sage-900">{service?.title}</h2>
            <p className="text-sage-600 text-sm mt-1">Visited on {transaction.expiryDate} (Redemption)</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
            <div className="text-center">
              <label className="block text-sm font-medium text-sage-700 mb-4">How would you rate your experience?</label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star 
                      size={40} 
                      className={`transition-colors ${
                        star <= (hoveredRating || rating) 
                          ? 'text-sand-500 fill-sand-500' 
                          : 'text-gray-200'
                      }`} 
                    />
                  </button>
                ))}
              </div>
              <p className="text-center text-sm font-medium text-sand-600 mt-2 h-5">
                {hoveredRating === 1 && "Needs Improvement"}
                {hoveredRating === 2 && "Fair"}
                {hoveredRating === 3 && "Good"}
                {hoveredRating === 4 && "Great"}
                {hoveredRating === 5 && "Excellent"}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">Share your experience</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you enjoy most? How was the ambiance?"
                className="w-full p-4 rounded-xl border border-sage-200 bg-white text-sage-900 placeholder:text-sage-400 focus:ring-2 focus:ring-sage-500 outline-none min-h-[150px] resize-none"
                required
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-sage-800 text-white py-4 rounded-xl text-lg font-semibold shadow-lg hover:bg-sage-700 transition-all"
            >
              Submit Review
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ReviewPage;
