import { useCallback } from 'react';
import { useSettingsStore } from '../store/settingsStore';

function _fmt(amount: number, symbol: string): string {
  return `${symbol} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Reactive hook that returns a formatCurrency function bound to the
 * current currency symbol from settings. Re-renders when the symbol changes.
 */
export function useFormatCurrency() {
  const currencySymbol = useSettingsStore((s) => s.settings.currencySymbol);
  return useCallback((amount: number) => _fmt(amount, currencySymbol), [currencySymbol]);
}

/**
 * Legacy non-reactive formatter. Reads symbol synchronously at call time.
 * Prefer useFormatCurrency() in React components for reactivity.
 */
export function formatCurrency(amount: number): string {
  const { currencySymbol } = useSettingsStore.getState().settings;
  return _fmt(amount, currencySymbol);
}

/**
 * Format a points/loyalty number with locale grouping.
 */
export function formatPoints(points: number): string {
  return points.toLocaleString();
}

/**
 * Escape a value for safe inclusion in a CSV row.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 */
export function escapeCSV(value: string | number): string {
  const str = String(value);
  if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Parse a CSV string into an array of rows (header + data).
 * Handles quoted fields, escaped double-quotes, and newlines within quotes.
 */
export function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentField += '"';
        i++; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && next === '\n')) {
        if (char === '\r') i++; // skip \r in \r\n
        currentRow.push(currentField.trim());
        if (currentRow.length > 0 && currentRow.some(f => f !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  // Push last field
  currentRow.push(currentField.trim());
  if (currentRow.length > 0 && currentRow.some(f => f !== '')) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Expected CSV header columns for inventory import (matching the export format):
 *   Name, SKU, Barcode, Category, Buying Price, Selling Price, Stock, Low Stock Threshold
 */
export const IMPORT_COLUMNS = [
  'name',
  'sku',
  'barcode',
  'category',
  'buyingPrice',
  'sellingPrice',
  'stockQuantity',
  'lowStockThreshold',
] as const;

export const IMPORT_HEADER_DISPLAY = [
  'Name',
  'SKU',
  'Barcode',
  'Category',
  'Buying Price',
  'Selling Price',
  'Stock',
  'Low Stock Threshold',
] as const;

export interface ParsedImportRow {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  buyingPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  errors: string[];
}

/**
 * Parse a CSV string into validated product import rows.
 * Returns an object with valid rows and error rows.
 */
export function parseImportCSV(csv: string): {
  valid: ParsedImportRow[];
  errors: { row: number; message: string }[];
} {
  const raw = parseCSV(csv);
  const errors: { row: number; message: string }[] = [];
  const valid: ParsedImportRow[] = [];

  if (raw.length < 2) {
    errors.push({ row: 0, message: 'CSV must contain a header row and at least one data row' });
    return { valid, errors };
  }

  // Find column indices by matching headers (case-insensitive, trim)
  const header = raw[0].map(h => h.toLowerCase().trim());
  const colIndex = (names: string[]): number => {
    for (const name of names) {
      const idx = header.indexOf(name.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxName = colIndex(['name', 'product name', 'product']);
  const idxSku = colIndex(['sku']);
  const idxBarcode = colIndex(['barcode']);
  const idxCategory = colIndex(['category', 'categories']);
  const idxBuyingPrice = colIndex(['buying price', 'buyingprice', 'cost price', 'cost']);
  const idxSellingPrice = colIndex(['selling price', 'sellingprice', 'price', 'sell price']);
  const idxStock = colIndex(['stock', 'stock quantity', 'quantity', 'qty']);
  const idxThreshold = colIndex(['low stock threshold', 'threshold', 'low stock', 'reorder point']);

  // Validate required columns
  if (idxName === -1) errors.push({ row: 0, message: 'Missing required column: Name' });
  if (idxSku === -1) errors.push({ row: 0, message: 'Missing required column: SKU' });
  if (idxBuyingPrice === -1) errors.push({ row: 0, message: 'Missing required column: Buying Price' });
  if (idxSellingPrice === -1) errors.push({ row: 0, message: 'Missing required column: Selling Price' });

  if (errors.length > 0) return { valid, errors };

  // Parse each data row
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const rowErrors: string[] = [];

    const getField = (idx: number): string => (idx >= 0 && idx < row.length ? row[idx] : '');

    const name = getField(idxName);
    const sku = getField(idxSku);
    const barcode = getField(idxBarcode);
    const category = getField(idxCategory);
    const buyingPriceStr = getField(idxBuyingPrice);
    const sellingPriceStr = getField(idxSellingPrice);
    const stockStr = getField(idxStock);
    const thresholdStr = getField(idxThreshold);

    if (!name) rowErrors.push('Name is required');
    if (!sku) rowErrors.push('SKU is required');

    const buyingPrice = parseFloat(buyingPriceStr);
    if (isNaN(buyingPrice) || buyingPrice < 0) rowErrors.push(`Invalid Buying Price: "${buyingPriceStr}"`);

    const sellingPrice = parseFloat(sellingPriceStr);
    if (isNaN(sellingPrice) || sellingPrice < 0) rowErrors.push(`Invalid Selling Price: "${sellingPriceStr}"`);

    const stockQuantity = stockStr ? (parseInt(stockStr, 10) || 0) : 0;
    const lowStockThreshold = thresholdStr ? (parseInt(thresholdStr, 10) || 5) : 5;

    if (rowErrors.length > 0) {
      errors.push({ row: i + 1, message: `Row ${i + 1}: ${rowErrors.join('; ')}` });
    } else {
      valid.push({
        name,
        sku,
        barcode,
        category,
        buyingPrice,
        sellingPrice,
        stockQuantity,
        lowStockThreshold,
        errors: [],
      });
    }
  }

  return { valid, errors };
}
