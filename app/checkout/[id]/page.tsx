"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Image from "next/image";
import {
  CreditCard,
  Building2,
  Wallet,
  Gift,
  User,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { useStore } from "@/context/StoreContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency, APP_CONFIG } from "@/lib/constants";
import { PaymentMethod, PaymentStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createVoucher } from "@/lib/actions/vouchers";
import { createOrder } from "@/lib/actions/orders";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CheckoutForm {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  recipientName: string;
  recipientEmail: string;
  senderMessage: string;
  paymentMethod: PaymentMethod;
}

export default function CheckoutPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { services, addVoucher, addOrder } = useStore();
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");

  const service = services.find((s) => s.id === id);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CheckoutForm>({
    defaultValues: {
      paymentMethod: PaymentMethod.CREDIT_CARD,
    },
  });

  const selectedPayment = watch("paymentMethod");

  if (!service) {
    return (
      <div className="min-h-screen bg-sand-50 flex items-center justify-center">
        <p className="text-sage-600">Service not found</p>
      </div>
    );
  }

  const onSubmit = async (data: CheckoutForm) => {
    setIsProcessing(true);

    try {
      // Simulate payment processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + APP_CONFIG.voucherValidity);

      // Create voucher in Supabase
      const voucher = await createVoucher({
        service_id: service.id,
        recipient_name: data.recipientName,
        recipient_email: data.recipientEmail,
        sender_name: data.customerName,
        sender_message: data.senderMessage || null,
        expiry_date: expiryDate.toISOString(),
        amount: service.price,
      });

      if (!voucher) {
        throw new Error("Failed to create voucher");
      }

      // Create order in Supabase
      const order = await createOrder({
        voucher_id: voucher.id,
        customer_email: data.customerEmail,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        payment_method: data.paymentMethod,
        payment_status: PaymentStatus.COMPLETED,
        total_amount: service.price,
      });

      if (!order) {
        throw new Error("Failed to create order");
      }

      // Send voucher email
      try {
        await fetch("/api/email/send-voucher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientEmail: data.recipientEmail,
            recipientName: data.recipientName,
            senderName: data.customerName,
            senderMessage: data.senderMessage,
            voucherCode: voucher.code,
            serviceName: service.name,
            serviceDuration: service.duration,
            amount: service.price,
            expiryDate: expiryDate.toISOString(),
          }),
        });
      } catch (emailError) {
        console.error("Email sending failed:", emailError);
        // Continue even if email fails - voucher is still created
      }

      // Update local state
      addVoucher({
        id: voucher.id,
        code: voucher.code,
        service,
        recipientName: data.recipientName,
        recipientEmail: data.recipientEmail,
        senderName: data.customerName,
        senderMessage: data.senderMessage,
        purchaseDate: now,
        expiryDate,
        isRedeemed: false,
        amount: service.price,
      });

      setVoucherCode(voucher.code);
      setIsSuccess(true);
      showToast("Payment successful! Voucher sent to recipient.", "success");
    } catch (error) {
      console.error("Checkout error:", error);
      showToast("Failed to complete purchase. Please try again.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-sage-800 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl p-8 md:p-12 max-w-lg w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-sage-700" />
          </div>
          <h1 className="font-serif text-3xl text-sage-900 mb-2">
            Payment Successful!
          </h1>
          <p className="text-sage-600 mb-8">
            Your voucher has been created and sent to the recipient.
          </p>

          <div className="bg-sand-50 p-6 rounded-2xl mb-8">
            <p className="text-sm text-sage-500 mb-2">Voucher Code</p>
            <p className="font-mono text-2xl text-sage-900 font-bold tracking-wider">
              {voucherCode}
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-sage-800 hover:bg-sage-700 text-white py-3"
            >
              Back to Home
            </Button>
            <Button
              onClick={() => router.push("/verify")}
              variant="outline"
              className="w-full border-sage-300 text-sage-700 py-3"
            >
              Verify Another Voucher
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="font-serif text-3xl text-sage-900 mb-8 text-center">
          Complete Your Purchase
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Form */}
            <div className="space-y-6">
              {/* Customer Details */}
              <div className="bg-white p-6 rounded-2xl border border-sage-100">
                <h2 className="font-semibold text-sage-900 mb-4 flex items-center gap-2">
                  <User size={20} /> Your Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-sage-600 mb-1 block">
                      Full Name
                    </label>
                    <Input
                      {...register("customerName", { required: true })}
                      placeholder="Your name"
                      className={errors.customerName ? "border-red-500" : ""}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-sage-600 mb-1 block">
                      Email
                    </label>
                    <Input
                      {...register("customerEmail", {
                        required: true,
                        pattern: /^\S+@\S+$/i,
                      })}
                      type="email"
                      placeholder="your@email.com"
                      className={errors.customerEmail ? "border-red-500" : ""}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-sage-600 mb-1 block">
                      Phone
                    </label>
                    <Input
                      {...register("customerPhone", { required: true })}
                      placeholder="+62 xxx xxxx xxxx"
                      className={errors.customerPhone ? "border-red-500" : ""}
                    />
                  </div>
                </div>
              </div>

              {/* Recipient Details */}
              <div className="bg-white p-6 rounded-2xl border border-sage-100">
                <h2 className="font-semibold text-sage-900 mb-4 flex items-center gap-2">
                  <Gift size={20} /> Recipient Details
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-sage-600 mb-1 block">
                      Recipient Name
                    </label>
                    <Input
                      {...register("recipientName", { required: true })}
                      placeholder="Recipient's name"
                      className={errors.recipientName ? "border-red-500" : ""}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-sage-600 mb-1 block">
                      Recipient Email
                    </label>
                    <Input
                      {...register("recipientEmail", {
                        required: true,
                        pattern: /^\S+@\S+$/i,
                      })}
                      type="email"
                      placeholder="recipient@email.com"
                      className={errors.recipientEmail ? "border-red-500" : ""}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-sage-600 mb-1 block">
                      Gift Message (Optional)
                    </label>
                    <textarea
                      {...register("senderMessage")}
                      placeholder="Write a personal message..."
                      rows={3}
                      className="w-full px-3 py-2 border border-sage-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-white p-6 rounded-2xl border border-sage-100">
                <h2 className="font-semibold text-sage-900 mb-4 flex items-center gap-2">
                  <CreditCard size={20} /> Payment Method
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      value: PaymentMethod.CREDIT_CARD,
                      label: "Credit/Debit Card",
                      icon: CreditCard,
                    },
                    {
                      value: PaymentMethod.BANK_TRANSFER,
                      label: "Bank Transfer",
                      icon: Building2,
                    },
                    {
                      value: PaymentMethod.E_WALLET,
                      label: "E-Wallet",
                      icon: Wallet,
                    },
                  ].map((method) => (
                    <label
                      key={method.value}
                      className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${
                        selectedPayment === method.value
                          ? "border-sage-600 bg-sage-50"
                          : "border-sage-200 hover:border-sage-400"
                      }`}
                    >
                      <input
                        type="radio"
                        value={method.value}
                        {...register("paymentMethod")}
                        className="sr-only"
                      />
                      <method.icon
                        size={24}
                        className={
                          selectedPayment === method.value
                            ? "text-sage-700"
                            : "text-sage-400"
                        }
                      />
                      <span
                        className={
                          selectedPayment === method.value
                            ? "text-sage-900 font-medium"
                            : "text-sage-600"
                        }
                      >
                        {method.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div>
              <div className="bg-white p-6 rounded-2xl border border-sage-100 sticky top-24">
                <h2 className="font-semibold text-sage-900 mb-4">
                  Order Summary
                </h2>

                <div className="flex gap-4 mb-6">
                  <div className="relative size-20 rounded-lg overflow-hidden">
                    <Image
                      src={service.image || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=200&q=80"}
                      alt={service.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="font-medium text-sage-900">{service.name}</h3>
                    <p className="text-sm text-sage-500">
                      {service.duration} minutes
                    </p>
                  </div>
                </div>

                <div className="border-t border-sage-100 pt-4 space-y-3">
                  <div className="flex justify-between text-sage-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(service.price)}</span>
                  </div>
                  <div className="flex justify-between text-sage-600">
                    <span>Service Fee</span>
                    <span>Free</span>
                  </div>
                  <div className="border-t border-sage-100 pt-3 flex justify-between font-semibold text-sage-900">
                    <span>Total</span>
                    <span className="text-xl">
                      {formatCurrency(service.price)}
                    </span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full mt-6 bg-sage-800 hover:bg-sage-700 text-white py-4 rounded-xl text-lg"
                >
                  {isProcessing ? "Processing..." : "Complete Purchase"}
                </Button>

                <p className="text-center text-sage-500 text-xs mt-4">
                  By completing this purchase, you agree to our Terms of Service
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
