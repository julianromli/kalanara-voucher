import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { Clock, CheckCircle, ChevronLeft } from 'lucide-react';

const VoucherDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { services } = useStore();
  const navigate = useNavigate();

  const service = services.find(s => s.id === id);

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50">
        <div className="text-center">
          <h2 className="text-2xl font-serif text-sage-900">Service not found</h2>
          <Link to="/" className="text-sand-600 hover:underline mt-4 inline-block">Return Home</Link>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  };

  return (
    <div className="min-h-screen bg-sand-50 pb-24 md:pb-10">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-4">
        <Link to="/" className="text-sage-500 hover:text-sage-800 flex items-center gap-1 text-sm">
          <ChevronLeft size={16} /> Back to Treatments
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-sage-100">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Image Side */}
            <div className="relative h-64 lg:h-auto">
              <img 
                src={service.image} 
                alt={service.title} 
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-sage-900/10"></div>
            </div>

            {/* Content Side */}
            <div className="p-8 md:p-12 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-sand-600 font-medium mb-3">
                <Clock size={18} />
                <span>{service.durationMin} Minutes</span>
              </div>
              
              <h1 className="font-serif text-3xl md:text-5xl text-sage-900 mb-6">{service.title}</h1>
              
              <div className="text-3xl font-semibold text-sage-800 mb-8">
                {formatPrice(service.price)}
                <span className="text-base font-normal text-sage-500 ml-2">/ person</span>
              </div>

              <div className="prose prose-sage mb-8">
                <p className="text-sage-600 leading-relaxed text-lg">{service.description}</p>
              </div>

              <div className="bg-sand-50 p-6 rounded-xl mb-10 border border-sand-200">
                <h3 className="font-serif text-lg text-sage-900 mb-4">Included Facilities:</h3>
                <ul className="space-y-3">
                  {service.facilities.map((item, index) => (
                    <li key={index} className="flex items-center gap-3 text-sage-700">
                      <CheckCircle size={18} className="text-sage-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="hidden md:block">
                <button 
                  onClick={() => navigate(`/checkout/${service.id}`)}
                  className="w-full bg-sage-800 text-sand-50 py-4 px-8 rounded-full text-lg hover:bg-sage-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  Buy Voucher Now
                </button>
                <p className="text-center text-xs text-sage-400 mt-3">Secure payment powered by Midtrans</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 md:hidden z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-sage-500">Total Price</span>
            <span className="text-lg font-bold text-sage-900">{formatPrice(service.price)}</span>
          </div>
          <button 
            onClick={() => navigate(`/checkout/${service.id}`)}
            className="bg-sage-800 text-white py-3 px-6 rounded-full font-medium flex-1"
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoucherDetail;