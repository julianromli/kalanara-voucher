

import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight, Star, Quote } from 'lucide-react';
import { useStore } from '../context/StoreContext';

const LandingPage: React.FC = () => {
  const { services, reviews } = useStore();

  // Filter out archived services
  const activeServices = services.filter(service => !service.isArchived);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price);
  };

  // Get top 3 recent high rated reviews
  const displayedReviews = reviews
    .filter(r => r.rating >= 4)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-sage-900">
          <img 
            src="https://picsum.photos/1920/1080?random=10" 
            alt="Spa Background" 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-sage-900/80 via-transparent to-transparent" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <span className="text-sand-300 tracking-[0.2em] text-sm md:text-base uppercase mb-4 block animate-fade-in">
            Welcome to Kalanara
          </span>
          <h1 className="font-serif text-5xl md:text-7xl text-sand-50 mb-6 leading-tight">
            Rejuvenate Your <br/> <span className="italic text-sand-400">Body & Soul</span>
          </h1>
          <p className="text-sand-100/90 text-lg md:text-xl mb-10 max-w-2xl mx-auto font-light">
            Experience the ancient healing traditions of Java in a modern sanctuary. 
            Book your escape today.
          </p>
          <a 
            href="#services" 
            className="inline-flex items-center gap-2 bg-sand-500 text-sage-900 px-8 py-4 rounded-full text-lg font-medium hover:bg-sand-400 transition-all transform hover:scale-105 shadow-lg shadow-sage-900/20"
          >
            Explore Treatments
          </a>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 px-4 sm:px-6 lg:px-8 bg-sand-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl text-sage-900 mb-4">Curated Packages</h2>
            <div className="h-1 w-20 bg-sand-500 mx-auto rounded-full"></div>
            <p className="mt-4 text-sage-600 max-w-2xl mx-auto">
              Select a voucher package below to gift yourself or a loved one.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {activeServices.length > 0 ? (
              activeServices.map((service) => (
                <div key={service.id} className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-sage-100">
                  <div className="relative h-64 overflow-hidden">
                    <img 
                      src={service.image} 
                      alt={service.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-sage-900 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 shadow-sm">
                      <Clock size={14} />
                      {service.durationMin} mins
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="font-serif text-2xl text-sage-900 mb-2 group-hover:text-sage-700 transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-sage-600 text-sm mb-6 line-clamp-2">
                      {service.description}
                    </p>
                    
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-sage-100">
                      <span className="text-lg font-semibold text-sage-800">
                        {formatPrice(service.price)}
                      </span>
                      <Link 
                        to={`/voucher/${service.id}`} 
                        className="text-sand-600 font-medium hover:text-sand-800 flex items-center gap-1 text-sm uppercase tracking-wide"
                      >
                        Details <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-12 text-sage-500">
                 No services available at the moment.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      {displayedReviews.length > 0 && (
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="font-serif text-4xl text-sage-900 mb-4">Guest Experiences</h2>
              <div className="h-1 w-20 bg-sand-500 mx-auto rounded-full"></div>
              <p className="mt-4 text-sage-600 max-w-2xl mx-auto">
                Read what our guests have to say about their journey with us.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {displayedReviews.map((review) => (
                <div key={review.id} className="bg-sand-50 p-8 rounded-2xl border border-sage-100 relative">
                  <Quote className="absolute top-6 right-6 text-sand-200" size={40} />
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        size={16} 
                        className={`${i < review.rating ? 'text-sand-500 fill-sand-500' : 'text-gray-300'}`} 
                      />
                    ))}
                  </div>
                  <p className="text-sage-700 italic mb-6 min-h-[80px]">"{review.comment}"</p>
                  <div className="border-t border-sage-200 pt-4">
                    <p className="font-bold text-sage-900">{review.customerName}</p>
                    <p className="text-xs text-sage-500 mt-1">{review.serviceTitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trust/Features */}
      <section className="py-20 bg-sage-800 text-sand-100">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div>
            <div className="w-16 h-16 mx-auto bg-sage-700 rounded-full flex items-center justify-center mb-4 text-sand-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 className="font-serif text-xl mb-2">Instant Delivery</h3>
            <p className="text-sage-300 text-sm">Vouchers are sent automatically via WhatsApp & Email immediately after purchase.</p>
          </div>
          <div>
            <div className="w-16 h-16 mx-auto bg-sage-700 rounded-full flex items-center justify-center mb-4 text-sand-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 className="font-serif text-xl mb-2">Valid for 6 Months</h3>
            <p className="text-sage-300 text-sm">Flexible redemption period to suit your schedule.</p>
          </div>
          <div>
            <div className="w-16 h-16 mx-auto bg-sage-700 rounded-full flex items-center justify-center mb-4 text-sand-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 className="font-serif text-xl mb-2">Secure Payment</h3>
            <p className="text-sage-300 text-sm">Trusted payments via QRIS, Bank Transfer, and Credit Cards.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
