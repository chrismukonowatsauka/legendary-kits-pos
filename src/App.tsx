import React, { useEffect, useState } from 'react';
import { ClipboardList, History, Landmark, Menu, Package, Receipt, Settings, ShoppingCart, Truck, Users, Wallet } from 'lucide-react';
import { StoreProvider, useStore } from './lib/store';
import { MessageBar, Modal } from './components/ui';
import { PointOfSale } from './screens/PointOfSale';
import { SalesHistory } from './screens/SalesHistory';
import { Expenses } from './screens/Expenses';
import { Accounts } from './screens/Accounts';
import { Customers } from './screens/Customers';
import { Products } from './screens/Products';
import { SalesOrders } from './screens/SalesOrders';
import { SupplierOrders } from './screens/SupplierOrders';
import { SettingsScreen } from './screens/SettingsScreen';

type Screen = 'pos' | 'history' | 'orders' | 'supplier' | 'products' | 'customers' | 'expenses' | 'accounts' | 'settings';

const MENU: { group: string; items: [Screen, string, React.ReactNode][] }[] = [
  {
    group: 'Point of Sale',
    items: [
      ['pos', 'Point of Sale', <ShoppingCart size={20} />],
      ['history', 'Sales History', <History size={20} />],
    ],
  },
  {
    group: 'Orders',
    items: [
      ['orders', 'Sales Orders', <ClipboardList size={20} />],
      ['supplier', 'Supplier Orders', <Truck size={20} />],
    ],
  },
  {
    group: 'Money',
    items: [
      ['expenses', 'Expenses', <Receipt size={20} />],
      ['accounts', 'Accounts', <Landmark size={20} />],
      ['customers', 'Customers', <Users size={20} />],
    ],
  },
  {
    group: 'Setup',
    items: [
      ['products', 'Products', <Package size={20} />],
      ['settings', 'Settings', <Settings size={20} />],
    ],
  },
];
const ALL = MENU.flatMap((g) => g.items);
/** Phone bottom bar: the four jobs used most, plus More for the rest. */
const BOTTOM: Screen[] = ['pos', 'orders', 'history', 'expenses'];

const Shell: React.FC = () => {
  const { ready, settings } = useStore();
  const [screen, setScreen] = useState<Screen>(() => (localStorage.getItem('lk:screen') as Screen) || 'pos');
  const [more, setMore] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem('lk:screen', screen);
    } catch {
      /* ignore */
    }
    document.title = `${ALL.find((i) => i[0] === screen)?.[1]} · ${settings.shopName}`;
  }, [screen, settings.shopName]);

  if (!ready) return <div className="p-8 text-center text-[#777777]">Loading…</div>;

  const go = (s: Screen) => {
    setScreen(s);
    setMore(false);
  };
  const body =
    screen === 'pos' ? <PointOfSale /> :
    screen === 'history' ? <SalesHistory /> :
    screen === 'orders' ? <SalesOrders goSupplierOrders={() => go('supplier')} /> :
    screen === 'supplier' ? <SupplierOrders /> :
    screen === 'products' ? <Products /> :
    screen === 'customers' ? <Customers /> :
    screen === 'expenses' ? <Expenses /> :
    screen === 'accounts' ? <Accounts /> :
    <SettingsScreen />;

  return (
    <div className="h-[100dvh] flex flex-col lg:flex-row">
      {/* PC: menu down the left */}
      <nav className="hidden lg:flex flex-col w-[220px] shrink-0 border-r border-[#e5e5e5] bg-white">
        <div className="px-4 py-3 font-bold text-[16px] bg-[#111111] text-white">{settings.shopName}</div>
        <div className="flex-1 overflow-y-auto py-2">
          {MENU.map((g) => (
            <div key={g.group} className="mb-2">
              <div className="px-4 pt-2 pb-1 text-[11px] font-bold text-[#777777] uppercase tracking-wide">{g.group}</div>
              {g.items.map(([id, label, icon]) => (
                <button key={id} type="button" onClick={() => go(id)} className={`w-full flex items-center gap-3 px-4 py-2 text-left ${screen === id ? 'bg-[#ededed] font-bold' : 'hover:bg-[#f5f5f5]'}`}>
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </nav>
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Phone: shop name on top */}
        <header className="lg:hidden bg-[#111111] text-white px-4 py-2 font-bold flex items-center">{settings.shopName}</header>
        <MessageBar />
        <main className="flex-1 min-h-0 overflow-y-auto pb-[72px] lg:pb-0">{body}</main>
      </div>
      {/* Phone: bottom bar with large buttons */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-[64px] bg-white border-t border-[#dddddd] grid grid-cols-5 z-40 pb-[env(safe-area-inset-bottom)]">
        {BOTTOM.map((id) => {
          const [, label, icon] = ALL.find((i) => i[0] === id)!;
          return (
            <button key={id} type="button" onClick={() => go(id)} className={`flex flex-col items-center justify-center gap-0.5 text-[11px] ${screen === id ? 'font-bold text-[#111111]' : 'text-[#666666]'}`}>
              {icon}
              {id === 'pos' ? 'Sell' : label.replace('Sales ', '')}
            </button>
          );
        })}
        <button type="button" onClick={() => setMore(true)} className={`flex flex-col items-center justify-center gap-0.5 text-[11px] ${!BOTTOM.includes(screen) ? 'font-bold' : 'text-[#666666]'}`}>
          <Menu size={20} />
          More
        </button>
      </nav>
      {more && (
        <Modal title="Menu" onClose={() => setMore(false)}>
          {MENU.map((g) => (
            <div key={g.group}>
              <div className="text-[12px] font-bold text-[#777777] uppercase tracking-wide mb-1">{g.group}</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {g.items.map(([id, label, icon]) => (
                  <button key={id} type="button" onClick={() => go(id)} className={`btn min-h-[56px]! justify-start! ${screen === id ? 'btn-primary' : ''}`}>
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="text-[12px] text-[#777777] flex items-center gap-1">
            <Wallet size={14} /> {settings.shopName}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
