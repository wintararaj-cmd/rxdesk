import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '../../../lib/apiClient';

export default function InventoryInsights() {
  const { data: deadStockRes, isLoading: loadingDeadStock } = useQuery({
    queryKey: ['insights', 'dead-stock'],
    queryFn: () => inventoryApi.getDeadStock().then((res) => res.data.data),
  });

  const { data: predictiveRes, isLoading: loadingPredictive } = useQuery({
    queryKey: ['insights', 'predictive-orders'],
    queryFn: () => inventoryApi.getPredictiveOrders().then((res) => res.data.data),
  });

  const { data: refillRes, isLoading: loadingRefill } = useQuery({
    queryKey: ['insights', 'refill-reminders'],
    queryFn: () => inventoryApi.getRefillReminders().then((res) => res.data.data),
  });

  const sendWhatsApp = (phone: string, customerName: string, medicineName: string) => {
    const formattedPhone = phone.replace(/\D/g, '');
    const cleanPhone = formattedPhone.startsWith('91') || formattedPhone.length > 10 ? formattedPhone : `91${formattedPhone}`;
    const text = encodeURIComponent(`Hello ${customerName}, your medicine (${medicineName}) might be running low soon. Would you like to place a refill order from our shop? Reply to confirm.`);
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header section */}
      <div className="bg-gradient-to-br from-blue-700 via-indigo-800 to-indigo-900 rounded-3xl p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/20">
             🧠
          </div>
          <div>
            <h2 className="text-white font-black text-2xl tracking-tight leading-tight">AI Insights & Engagement</h2>
            <p className="text-indigo-200 text-sm font-medium mt-1">
              Optimize your working capital and engage patients automatically with refill reminders tailored to chronic medication usage.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Dead Stock Panel */}
        <div className="bg-white rounded-3xl border border-rose-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-rose-50 bg-rose-50/30 flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-xl shadow-sm border border-rose-200">
                 📉
               </div>
               <div>
                 <h3 className="font-black text-gray-900 tracking-tight text-lg">Dead Stock Alerts</h3>
                 <p className="text-xs text-rose-500 font-bold uppercase tracking-widest mt-0.5">Unsold for &gt; 90 days</p>
               </div>
             </div>
             {deadStockRes && deadStockRes.length > 0 && (
               <div className="bg-rose-500 text-white px-3 py-1 rounded-lg text-sm font-black shadow-md shadow-rose-200">
                 {deadStockRes.length} items
               </div>
             )}
          </div>
          
          <div className="p-0 flex-1 overflow-auto max-h-[500px]">
            {loadingDeadStock ? (
              <div className="p-10 text-center text-gray-400 font-medium">Analyzing stock movement...</div>
            ) : deadStockRes?.length === 0 ? (
              <div className="p-10 text-center text-emerald-600 font-medium">✨ Great job! You have no dead stock right now.</div>
            ) : (
               <table className="w-full text-sm">
                 <thead className="bg-gray-50/80 sticky top-0 z-10">
                   <tr>
                     <th className="px-5 py-3 text-left font-black text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-100">Medicine</th>
                     <th className="px-5 py-3 text-right font-black text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-100">Stock Qty</th>
                     <th className="px-5 py-3 text-right font-black text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-100">Est. Locked Capital</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    {deadStockRes?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-rose-50/40 transition-colors">
                        <td className="px-5 py-3 font-bold text-gray-800">{item.medicine_name}</td>
                        <td className="px-5 py-3 text-right font-black text-rose-600">{item.stock_qty}</td>
                        <td className="px-5 py-3 text-right font-bold text-gray-600">₹{(item.stock_qty * Number(item.purchase_price || item.mrp)).toFixed(0)}</td>
                      </tr>
                    ))}
                 </tbody>
               </table>
            )}
          </div>
        </div>

        {/* Predictive Orders Panel */}
        <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-indigo-50 bg-indigo-50/30 flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-xl shadow-sm border border-indigo-200">
                 🔮
               </div>
               <div>
                 <h3 className="font-black text-gray-900 tracking-tight text-lg">Smart Reorder Suggestions</h3>
                 <p className="text-xs text-indigo-500 font-bold uppercase tracking-widest mt-0.5">Based on 30-day run rate</p>
               </div>
             </div>
             {predictiveRes && predictiveRes.length > 0 && (
               <div className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm font-black shadow-md shadow-indigo-200">
                 {predictiveRes.length} items
               </div>
             )}
          </div>
          
          <div className="p-0 flex-1 overflow-auto max-h-[500px]">
            {loadingPredictive ? (
              <div className="p-10 text-center text-gray-400 font-medium">Building predictive models...</div>
            ) : predictiveRes?.length === 0 ? (
              <div className="p-10 text-center text-gray-500 font-medium">Need more sales data to generate predictions.</div>
            ) : (
               <table className="w-full text-sm">
                 <thead className="bg-gray-50/80 sticky top-0 z-10">
                   <tr>
                     <th className="px-5 py-3 text-left font-black text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-100">Medicine</th>
                     <th className="px-5 py-3 text-right font-black text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-100">Current Stock</th>
                     <th className="px-5 py-3 text-right font-black text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-100">Suggested Order</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    {predictiveRes?.map((item: any, i: number) => {
                      const shortageBg = item.current_stock === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700';
                      return (
                        <tr key={i} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-bold text-gray-800">{item.medicine_name}</p>
                            <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tight">Requires: {item.monthly_run_rate} / mo</p>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className={`px-2 py-0.5 rounded font-black text-xs ${item.current_stock < item.monthly_run_rate ? shortageBg : 'text-gray-600'}`}>
                              {item.current_stock}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <p className="font-black text-indigo-700 bg-indigo-50 inline-block px-2.5 py-1 rounded-lg shadow-inner">
                              +{item.suggested_order_qty}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                 </tbody>
               </table>
            )}
          </div>
        </div>

        {/* Patient Refill Reminders Panel */}
        <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm overflow-hidden flex flex-col xl:col-span-2">
          <div className="px-6 py-5 border-b border-emerald-50 bg-emerald-50/30 flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-xl shadow-sm border border-emerald-200">
                 📱
               </div>
               <div>
                 <h3 className="font-black text-gray-900 tracking-tight text-lg">Patient Refill Reminders (WhatsApp)</h3>
                 <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest mt-0.5">Engage chronic patients & increase sales</p>
               </div>
             </div>
             {refillRes && refillRes.length > 0 && (
               <div className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-sm font-black shadow-md shadow-emerald-200">
                 {refillRes.length} Reminders
               </div>
             )}
          </div>
          
          <div className="p-0 flex-1 overflow-auto max-h-[500px]">
            {loadingRefill ? (
              <div className="p-10 text-center text-gray-400 font-medium">Scanning past bills for upcoming refills...</div>
            ) : refillRes?.length === 0 ? (
              <div className="p-10 text-center text-gray-500 font-medium">No upcoming refill reminders found for the next 7 days.</div>
            ) : (
               <table className="w-full text-sm">
                 <thead className="bg-gray-50/80 sticky top-0 z-10">
                   <tr>
                     <th className="px-5 py-3 text-left font-black text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-100">Patient Details</th>
                     <th className="px-5 py-3 text-left font-black text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-100">Medicine Bought</th>
                     <th className="px-5 py-3 text-left font-black text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-100">Status</th>
                     <th className="px-5 py-3 text-right font-black text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-100">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    {refillRes?.map((item: any) => {
                      const isOverdue = item.days_remaining < 0;
                      return (
                        <tr key={item.id} className="hover:bg-emerald-50/20 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-bold text-gray-800">{item.customer_name}</p>
                            <p className="text-xs text-gray-500 font-medium">📱 {item.customer_phone}</p>
                          </td>
                          <td className="px-5 py-3">
                            <p className="font-bold text-gray-700">{item.medicine_name}</p>
                            <p className="text-xs text-gray-400 mt-1 uppercase font-bold">Qty: {item.last_quantity} {item.unit}</p>
                          </td>
                          <td className="px-5 py-3">
                            {isOverdue ? (
                              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-black text-[10px] uppercase">
                                Ran out {Math.abs(item.days_remaining)} days ago
                              </span>
                            ) : item.days_remaining === 0 ? (
                              <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-black text-[10px] uppercase">
                                Runs out TODAY
                              </span>
                            ) : (
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black text-[10px] uppercase">
                                Runs out in {item.days_remaining} day(s)
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => sendWhatsApp(item.customer_phone, item.customer_name, item.medicine_name)}
                              className="text-xs font-bold uppercase tracking-widest bg-[#25D366] text-white hover:bg-[#1da851] py-2 px-4 rounded-xl shadow-md transition-all active:scale-95"
                            >
                              Send WhatsApp
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                 </tbody>
               </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
