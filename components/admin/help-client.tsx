"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/admin/dashboard-header";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HugeiconsIcon } from "@hugeicons/react";
import { SearchIcon } from "@hugeicons/core-free-icons";

const HELP_SECTIONS = [
  {
    title: "Getting Started",
    items: [
      {
        question: "How to access the admin dashboard?",
        answer: "Navigate to /admin/login and use your admin credentials to access the dashboard."
      },
      {
        question: "What are the different admin roles?",
        answer: "There are three roles: Super Admin (full access), Manager (business operations), and Staff (limited access)."
      }
    ]
  },
  {
    title: "Managing Services",
    items: [
      {
        question: "How to add a new service?",
        answer: "Go to Services page, click 'Add Service', fill in the details, and save."
      },
      {
        question: "Can I deactivate a service?",
        answer: "Yes, you can deactivate services by clicking the delete button on the service card."
      }
    ]
  },
  {
    title: "Order Management",
    items: [
      {
        question: "How to update order status?",
        answer: "Go to Orders page, find the order, and use the status update buttons to change its status."
      },
      {
        question: "Can I export order data?",
        answer: "Yes, use the export button on the Orders page to download order data as CSV."
      }
    ]
  }
];

const FAQ_ITEMS = [
  {
    question: "What happens when a voucher expires?",
    answer: "Expired vouchers cannot be redeemed and will show as 'Expired' status in the system."
  },
  {
    question: "How do I handle customer complaints?",
    answer: "Review customer feedback in the Reviews section and take appropriate action based on the content."
  },
  {
    question: "Can I bulk update multiple orders?",
    answer: "Yes, use the bulk actions feature in the Orders page to update multiple orders at once."
  }
];

export function HelpClient() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const filteredSections = HELP_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.items.length > 0);

  const handleContactSupport = () => {
    showToast("Support email: support@kalanara.com", "info");
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <>
      <DashboardHeader title="Help Center" showActions={false} />
      <div className="w-full overflow-y-auto overflow-x-hidden p-4 md:p-6 h-full">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-semibold">Admin Help Center</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Find answers to common questions and learn how to use the admin dashboard effectively.
            </p>
            
            <div className="relative max-w-md mx-auto">
              <HugeiconsIcon icon={SearchIcon} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search help articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {filteredSections.map((section, sectionIndex) => (
                <Card key={sectionIndex}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HugeiconsIcon icon={SearchIcon} className="w-5 h-5" />
                      {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {section.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="border-b border-border last:border-b-0 pb-4 last:pb-0">
                        <h4 className="font-medium mb-2">{item.question}</h4>
                        <p className="text-sm text-muted-foreground">{item.answer}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HugeiconsIcon icon={SearchIcon} className="w-5 h-5" />
                    FAQ
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {FAQ_ITEMS.map((faq, index) => (
                    <Collapsible
                      key={index}
                      open={openFaq === `faq-${index}`}
                      onOpenChange={() => setOpenFaq(openFaq === `faq-${index}` ? null : `faq-${index}`)}
                    >
                      <CollapsibleTrigger className="flex items-center justify-between w-full text-left p-2 rounded-lg hover:bg-accent">
                        <span className="text-sm font-medium">{faq.question}</span>
                        <HugeiconsIcon 
                          icon={SearchIcon} 
                          className={`w-4 h-4 transition-transform ${openFaq === `faq-${index}` ? 'rotate-180' : ''}`} 
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 text-sm text-muted-foreground p-2">
                        {faq.answer}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Need More Help?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Can't find what you're looking for? Contact our support team.
                  </p>
                  <Button onClick={handleContactSupport} className="w-full">
                    <HugeiconsIcon icon={SearchIcon} className="w-4 h-4 mr-2" />
                    Contact Support
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
