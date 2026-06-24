import express from 'express';
import cors from 'cors';
import authRoutes from '../server/src/routes/auth.js';
import productRoutes from '../server/src/routes/products.js';
import customerRoutes from '../server/src/routes/customers.js';
import supplierRoutes from '../server/src/routes/suppliers.js';
import staffRoutes from '../server/src/routes/staff.js';
import saleRoutes from '../server/src/routes/sales.js';
import expenseRoutes from '../server/src/routes/expenses.js';
import settingsRoutes from '../server/src/routes/settings.js';
import shiftRoutes from '../server/src/routes/shifts.js';
import purchaseOrderRoutes from '../server/src/routes/purchaseOrders.js';
import stockRoutes from '../server/src/routes/stock.js';
import accountsPayableRoutes from '../server/src/routes/accountsPayable.js';
import loyaltyRoutes from '../server/src/routes/loyalty.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/accounts-payable', accountsPayableRoutes);
app.use('/api/loyalty', loyaltyRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

export default app;
