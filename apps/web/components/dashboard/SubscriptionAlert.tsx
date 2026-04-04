'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { shopApi } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { AlertTriangle, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SubscriptionData {
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  trial_ends_at: string | null;
  current_period_end: string | null;
  plan: {
    name: string;
  };
}

interface ShopData {
  shop_name: string;
  subscriptions?: SubscriptionData[];
}

export function SubscriptionAlert() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  const { data: shop } = useQuery<ShopData>({
    queryKey: ['web-shop'],
    queryFn: () => shopApi.getMyShop().then((r) => r.data.data),
    enabled: !!user,
  });

  useEffect(() => {
    if (shop?.subscriptions && shop.subscriptions.length > 0) {
      const sub = shop.subscriptions[0];
      
      const checkDate = sub.status === 'trial' ? sub.trial_ends_at : sub.current_period_end;
      
      if (checkDate) {
        const endDate = new Date(checkDate).getTime();
        const now = new Date().getTime();
        const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        
        // Expiry logic
        if (diffDays <= 3 && diffDays >= 0) {
          // If we haven't dismissed this session
          const dismissed = sessionStorage.getItem(`sub-alert-dismissed-${sub.status}`);
          if (!dismissed) {
             setIsOpen(true);
          }
        }
      }
    }
  }, [shop]);

  if (!isOpen || !shop?.subscriptions?.length) return null;

  const currentSub = shop.subscriptions[0];
  const isTrial = currentSub.status === 'trial';
  
  const handleDismiss = () => {
    sessionStorage.setItem(`sub-alert-dismissed-${currentSub.status}`, 'true');
    setIsOpen(false);
  };
  
  const handleRecharge = () => {
    handleDismiss();
    router.push('/dashboard/settings'); // Or wherever billing is located
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="bg-rose-50 p-6 flex flex-col items-center text-center border-b border-rose-100">
          <div className="bg-rose-100 text-rose-600 p-3 rounded-full mb-4">
             {isTrial ? <Crown className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">
             Action Required: Subscription Expiring
          </h2>
          <p className="text-sm font-medium text-rose-600 uppercase tracking-widest">
             {isTrial ? 'Trial Period Ending' : 'Premium Subscription Expiring'}
          </p>
        </div>

        <div className="p-6">
           <p className="text-gray-600 text-center mb-6 text-sm">
             Your {isTrial ? 'trial access' : 'premium plan'} to RxDesk is about to expire shortly. To avoid any service interruptions with billing and appointments, please recharge your account now.
           </p>

           <div className="flex gap-3">
             <button 
                onClick={handleDismiss}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
              >
                Remind Me Later
             </button>
             <button 
                onClick={handleRecharge}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold shadow-lg shadow-rose-500/30 hover:opacity-90 transition-opacity"
              >
                Recharge Now
             </button>
           </div>
        </div>

      </div>
    </div>
  );
}
