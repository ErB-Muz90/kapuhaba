import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Receipt } from '../components/Receipt';
import { useProductStore } from '../store/productStore';
import { useSaleStore } from '../store/saleStore';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import { useFormatCurrency } from '../utils/format';
import { useShiftStore } from '../store/shiftStore';
import { useSettingsStore } from '../store/settingsStore';
import type { PaymentMethod, Sale, Customer } from '../types';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  CreditCard,
  Smartphone,
  Banknote,
  User,
  Printer,
  X,
  Package,
  AlertCircle,
  Check,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function POS() {
  const $c = useFormatCurrency();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [processing, setProcessing] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const products = useProductStore((s) => s.products);
  const searchProducts = useProductStore((s) => s.searchProducts);
  const cart = useSaleStore((s) => s.cart);
  const selectedCustomerId = useSaleStore((s) => s.selectedCustomerId);
  const addToCart = useSaleStore((s) => s.addToCart);
  const removeFromCart = useSaleStore((s) => s.removeFromCart);
  const updateCartQuantity = useSaleStore((s) => s.updateCartQuantity);
  const clearCart = useSaleStore((s) => s.clearCart);
  const setSelectedCustomer = useSaleStore((s) => s.setSelectedCustomer);
  const completeSaleAction = useSaleStore((s) => s.completeSale);
  const customers = useCustomerStore((s) => s.customers);
  const searchCustomers = useCustomerStore((s) => s.searchCustomers);
  const getCustomer = useCustomerStore((s) => s.getCustomer);
  const user = useAuthStore((s) => s.user);
  const activeShift = useShiftStore((s) => s.getActiveShift());

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return getCustomer(selectedCustomerId) || null;
  }, [selectedCustomerId, getCustomer]);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(products.map((p) => p.category)))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    if (searchQuery) return searchProducts(searchQuery);
    if (selectedCategory === 'all') return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [products, searchQuery, selectedCategory, searchProducts]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    return searchCustomers(customerSearch);
  }, [customers, customerSearch, searchCustomers]);

  const taxRate = useSettingsStore((s) => s.settings.taxRate || 0.16);

  // VAT calculation (prices are VAT-INCLUSIVE)
  const { subtotal, tax, total } = useMemo(() => {
    const total = cart.reduce(
      (sum, item) => sum + item.product.sellingPrice * item.quantity,
      0
    );
    const subtotal = total / (1 + taxRate);
    const tax = total - subtotal;
    return { subtotal, tax, total };
  }, [cart, taxRate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      if (e.key === '/' && !inInput && !checkoutOpen && !customerSearchOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        if (checkoutOpen) setCheckoutOpen(false);
        else if (customerSearchOpen) setCustomerSearchOpen(false);
        else if (receiptOpen) {
          setReceiptOpen(false);
          setCompletedSale(null);
        }
      }
      if (e.key === 'F12' && cart.length > 0 && activeShift && !checkoutOpen) {
        e.preventDefault();
        setCheckoutOpen(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [cart.length, checkoutOpen, customerSearchOpen, receiptOpen, activeShift]);

  const handleAddToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    if (product.stockQuantity <= 0) {
      toast.error('Out of stock');
      return;
    }
    const existing = cart.find((i) => i.product.id === productId);
    if (existing && existing.quantity >= product.stockQuantity) {
      toast.error(`Only ${product.stockQuantity} available`);
      return;
    }
    addToCart({ product, quantity: 1 });
    toast.success(`Added ${product.name}`);
  };

  const handleUpdateQty = (productId: string, newQty: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    if (newQty > product.stockQuantity) {
      toast.error(`Only ${product.stockQuantity} available`);
      return;
    }
    updateCartQuantity(productId, newQty);
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer.id);
    setCustomerSearchOpen(false);
    setCustomerSearch('');
    toast.success(`Customer: ${customer.name}`);
  };

  const handleCheckout = async () => {
    if (!user || !activeShift) return;
    setProcessing(true);
    const sale = await completeSaleAction(
      paymentMethod,
      user.id,
      user.username,
      selectedCustomer?.name
    );
    if (sale) {
      setCompletedSale(sale);
      setCheckoutOpen(false);
      setReceiptOpen(true);
      toast.success('Sale completed');
    } else {
      toast.error('Sale failed — check stock availability');
    }
    setProcessing(false);
  };

  const handlePrint = () => {
    if (receiptRef.current) {
      const win = window.open('', '_blank');
      if (win) {
        const content = receiptRef.current.cloneNode(true) as HTMLElement;
        const styles = Array.from(document.styleSheets)
          .map((sheet) => {
            try {
              return Array.from(sheet.cssRules || [])
                .map((rule) => rule.cssText)
                .join('');
            } catch {
              return '';
            }
          })
          .join('');
        win.document.write(
          `<html><head><title>Receipt</title><style>@page{margin:0;size:80mm auto}body{font-family:monospace;padding:4mm}${styles}</style></head><body></body></html>`
        );
        win.document.body.appendChild(content);
        win.document.close();
        win.print();
      }
    }
  };

  const paymentMethods = [
    { id: 'cash' as PaymentMethod, label: 'Cash', icon: Banknote },
    { id: 'mpesa' as PaymentMethod, label: 'M-Pesa', icon: Smartphone },
    { id: 'card' as PaymentMethod, label: 'Card', icon: CreditCard },
  ];

  return (
    <Layout>
      <div className="space-y-4">
        {/* Shift Warning */}
        {!activeShift && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900">No Active Shift</p>
                <p className="text-sm text-red-700">Start a shift to process sales</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => navigate('/shifts')}>
              <Clock className="w-4 h-4" /> Start Shift
            </Button>
          </div>
        )}

        <div className="h-[calc(100vh-9rem)] flex flex-col lg:flex-row gap-4">
          {/* Products Section */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b space-y-3">
              <div className="relative">
                <Input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products (press / to focus)"
                  icon={<Search className="w-5 h-5" />}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat === 'all' ? 'All Products' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Package className="w-12 h-12 mb-2" />
                  <p>No products found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleAddToCart(product.id)}
                      disabled={product.stockQuantity <= 0}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        product.stockQuantity <= 0
                          ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-blue-500 hover:shadow-md bg-white'
                      }`}
                    >
                      <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                        <Package className="w-5 h-5 text-blue-600" />
                      </div>
                      <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1 min-h-[2.5rem]">
                        {product.name}
                      </h3>
                      <p className="text-xs text-gray-500 mb-1">{product.sku}</p>
                      {product.stockQuantity <= product.lowStockThreshold && product.stockQuantity > 0 && (
                        <span className="inline-block text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded mb-1">Low Stock</span>
                      )}
                      {product.stockQuantity === 0 && (
                        <span className="inline-block text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded mb-1">Out of Stock</span>
                      )}
                      <div className="flex items-end justify-between mt-1">
                        <div>
                          <p className="font-bold text-blue-600 text-sm">{$c(product.sellingPrice)}</p>
                          <p className="text-[9px] text-gray-400">Incl. VAT</p>
                        </div>
                        <p className="text-xs text-gray-500">{product.stockQuantity}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart Section */}
          <div className="w-full lg:w-96 flex flex-col bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-blue-600" />
                  <h2 className="font-semibold text-gray-900">Current Sale</h2>
                </div>
                {cart.length > 0 && (
                  <button onClick={clearCart} className="text-sm text-red-600 hover:text-red-700">
                    Clear
                  </button>
                )}
              </div>

              <div className="mt-3">
                {activeShift ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs font-medium text-green-800">Shift Active · {activeShift.staffName}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-medium text-red-800">No Active Shift</span>
                  </div>
                )}
              </div>

              <div className="mt-3">
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">{selectedCustomer.name}</span>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="text-blue-600 hover:text-blue-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCustomerSearchOpen(true)}
                    className="w-full flex items-center justify-center gap-2 p-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600"
                  >
                    <User className="w-4 h-4" /> Add Customer (Optional)
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6">
                  <ShoppingBag className="w-12 h-12 mb-2 opacity-50" />
                  <p className="text-sm">Cart is empty</p>
                </div>
              ) : (
                <div className="divide-y">
                  {cart.map((item) => (
                    <div key={item.product.id} className="p-3">
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">{item.product.name}</h4>
                          <p className="text-xs text-gray-500">{$c(item.product.sellingPrice)}</p>
                        </div>
                        <button onClick={() => removeFromCart(item.product.id)} className="text-red-500 hover:text-red-600 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateQty(item.product.id, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded hover:bg-gray-200"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleUpdateQty(item.product.id, parseInt(e.target.value) || 0)}
                            className="w-12 h-7 text-center border rounded text-sm"
                            min="1"
                            max={item.product.stockQuantity}
                          />
                          <button
                            onClick={() => handleUpdateQty(item.product.id, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded hover:bg-gray-200"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="font-semibold text-sm text-gray-900">
                          {$c(item.product.sellingPrice * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t p-4 space-y-2 bg-gray-50">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal (Excl. VAT)</span>
                <span>{$c(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>VAT ({(taxRate * 100).toFixed(0)}%) Incl.</span>
                <span>{$c(tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                <span>Total (VAT Incl.)</span>
                <span>{$c(total)}</span>
              </div>
              <Button
                onClick={() => setCheckoutOpen(true)}
                disabled={cart.length === 0 || !activeShift}
                className="w-full mt-2"
                size="lg"
              >
                {activeShift ? `Checkout (F12)` : 'Start Shift First'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Search Modal */}
      <Modal isOpen={customerSearchOpen} onClose={() => { setCustomerSearchOpen(false); setCustomerSearch(''); }} title="Select Customer">
        <div className="p-4 border-b">
          <Input
            type="text"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="Search by name or phone"
            icon={<Search className="w-5 h-5" />}
            autoFocus
          />
        </div>
        <div className="max-h-96 overflow-y-auto">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No customers found</div>
          ) : (
            <div className="divide-y">
              {filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelectCustomer(customer)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 text-left"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{customer.name}</p>
                    <p className="text-sm text-gray-500">{customer.phone}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Checkout Modal */}
      <Modal isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Checkout" size="md">
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2 text-sm">Order Summary</h3>
            <div className="space-y-1 text-sm max-h-32 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between">
                  <span className="text-gray-600 truncate">{item.product.name} × {item.quantity}</span>
                  <span className="font-medium ml-2">{$c(item.product.sellingPrice * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t mt-3 pt-2 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal (Excl. VAT)</span>
                <span>{$c(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>VAT ({(taxRate * 100).toFixed(0)}%) Incl.</span>
                <span>{$c(tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-1 border-t">
                <span>Total (VAT Incl.)</span>
                <span>{$c(total)}</span>
              </div>
            </div>
          </div>

          {selectedCustomer && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <User className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-medium text-blue-900">{selectedCustomer.name}</p>
            </div>
          )}

          <div>
            <h3 className="font-medium text-gray-900 mb-2 text-sm">Payment Method</h3>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    paymentMethod === method.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <method.icon className={`w-6 h-6 mx-auto ${paymentMethod === method.id ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className={`text-sm font-medium mt-1 ${paymentMethod === method.id ? 'text-blue-700' : 'text-gray-600'}`}>
                    {method.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'mpesa' && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Confirm M-Pesa payment received before completing sale.</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setCheckoutOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleCheckout} loading={processing} className="flex-1">
              <Check className="w-4 h-4" /> Complete Sale
            </Button>
          </div>
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal isOpen={receiptOpen} onClose={() => { setReceiptOpen(false); setCompletedSale(null); }} title="Sale Complete" size="lg">
        <div className="p-6">
          <div className="flex items-center justify-center gap-3 mb-6 p-4 bg-green-50 rounded-lg">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-900">Sale Completed!</h3>
              <p className="text-sm text-green-700">Total: {completedSale && $c(completedSale.total)}</p>
            </div>
          </div>
          {completedSale && (
            <div className="border rounded-lg overflow-hidden mb-4 max-h-96 overflow-y-auto flex justify-center bg-gray-50 p-4">
              <Receipt ref={receiptRef} sale={completedSale} type="thermal" />
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setReceiptOpen(false); setCompletedSale(null); }} className="flex-1">Close</Button>
            <Button onClick={handlePrint} className="flex-1"><Printer className="w-4 h-4" /> Print</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
