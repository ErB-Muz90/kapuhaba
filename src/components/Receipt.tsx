import { forwardRef } from 'react';
import type { Sale } from '../types';
import { useSettingsStore } from '../store/settingsStore';
import { useFormatCurrency, safeFormat } from '../utils/format';

interface ReceiptProps {
  sale: Sale;
  type?: 'thermal' | 'a4';
}

export const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(
  ({ sale, type = 'thermal' }, ref) => {
    const $c = useFormatCurrency();
    const { settings } = useSettingsStore();

    if (type === 'thermal') {
      return (
        <div
          ref={ref}
          className="bg-white p-4 font-mono text-xs"
          style={{ width: '80mm' }}
        >
          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="text-lg font-bold">{settings.name}</h1>
            <p className="text-gray-600">{settings.address}</p>
            <p className="text-gray-600">{settings.phone}</p>
            <p className="text-gray-600">{settings.email}</p>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Receipt info */}
          <div className="mb-2">
            <p>Receipt #: {(sale.id ?? '').slice(0, 8).toUpperCase()}</p>
            <p>Date: {safeFormat(sale.createdAt, 'dd/MM/yyyy HH:mm')}</p>
            <p>Cashier: {sale.cashierName}</p>
            {sale.customerName && <p>Customer: {sale.customerName}</p>}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Items */}
          <table className="w-full mb-2">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1">Item</th>
                <th className="text-center py-1">Qty</th>
                <th className="text-right py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, index) => (
                <tr key={index}>
                  <td className="py-1">
                    <div className="truncate max-w-[120px]">{item.productName}</div>
                    <div className="text-gray-500">@ {$c(item.unitPrice)}</div>
                  </td>
                  <td className="text-center py-1">{item.quantity}</td>
                  <td className="text-right py-1">{$c(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Subtotal (Excl. VAT):</span>
              <span>{$c(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT ({(settings.taxRate * 100).toFixed(0)}%) Incl.:</span>
              <span>{$c(sale.tax)}</span>
            </div>
            <div className="border-t border-dashed border-gray-400 my-1" />
            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL (VAT Incl.):</span>
              <span>{$c(sale.total)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Payment method */}
          <div className="mb-2">
            <p>Payment: {sale.paymentMethod.toUpperCase()}</p>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Footer */}
          <div className="text-center text-gray-600">
            <p className="text-gray-400 mb-1">* All prices are VAT inclusive</p>
            <p>Thank you for shopping with us!</p>
            <p>Please come again</p>
          </div>
        </div>
      );
    }

    // A4 format
    return (
      <div
        ref={ref}
        className="bg-white p-8"
        style={{ width: '210mm', minHeight: '297mm' }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-800">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{settings.name}</h1>
            <p className="text-gray-600 mt-1">{settings.address}</p>
            <p className="text-gray-600">{settings.phone}</p>
            <p className="text-gray-600">{settings.email}</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-800">RECEIPT</h2>
            <p className="text-gray-600 mt-2">
              <span className="font-medium">Receipt #:</span>{' '}
              {(sale.id ?? '').slice(0, 8).toUpperCase()}
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Date:</span>{' '}
              {safeFormat(sale.createdAt, 'MMMM dd, yyyy')}
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Time:</span>{' '}
              {safeFormat(sale.createdAt, 'HH:mm:ss')}
            </p>
          </div>
        </div>

        {/* Customer & Cashier Info */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Customer:</h3>
            <p className="text-gray-600">{sale.customerName || 'Walk-in Customer'}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Served by:</h3>
            <p className="text-gray-600">{sale.cashierName}</p>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full mb-8">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="text-left py-3 px-4">#</th>
              <th className="text-left py-3 px-4">Product</th>
              <th className="text-center py-3 px-4">Qty</th>
              <th className="text-right py-3 px-4">Unit Price (Incl.)</th>
              <th className="text-right py-3 px-4">Total (Incl.)</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="py-3 px-4">{index + 1}</td>
                <td className="py-3 px-4">{item.productName}</td>
                <td className="text-center py-3 px-4">{item.quantity}</td>
                <td className="text-right py-3 px-4">{$c(item.unitPrice)}</td>
                <td className="text-right py-3 px-4">{$c(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-72">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Subtotal (Excl. VAT):</span>
              <span className="font-medium">{$c(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">VAT ({(settings.taxRate * 100).toFixed(0)}%) Incl.:</span>
              <span className="font-medium">{$c(sale.tax)}</span>
            </div>
            <div className="flex justify-between py-3 text-lg font-bold">
              <span>Total (VAT Incl.):</span>
              <span>{$c(sale.total)}</span>
            </div>
          </div>
        </div>

        {/* Payment info */}
        <div className="bg-gray-100 p-4 rounded-lg mb-8">
          <p className="text-gray-600">
            <span className="font-semibold">Payment Method:</span>{' '}
            {sale.paymentMethod.toUpperCase()}
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-600 border-t pt-6">
          <p className="text-xs text-gray-400 mb-2">* All prices are VAT inclusive</p>
          <p className="font-medium">Thank you for your business!</p>
          <p className="text-sm mt-2">
            For any queries, please contact us at {settings.phone}
          </p>
        </div>
      </div>
    );
  }
);

Receipt.displayName = 'Receipt';
