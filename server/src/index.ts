import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import customerRoutes from './routes/customers.js';
import supplierRoutes from './routes/suppliers.js';
import staffRoutes from './routes/staff.js';
import saleRoutes from './routes/sales.js';
import expenseRoutes from './routes/expenses.js';
import settingsRoutes from './routes/settings.js';
import shiftRoutes from './routes/shifts.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import stockRoutes from './routes/stock.js';
import accountsPayableRoutes from './routes/accountsPayable.js';
import loyaltyRoutes from './routes/loyalty.js';
import resetRoutes from './routes/reset.js';
import returnRoutes from './routes/returns.js';
import layawayRoutes from './routes/layaways.js';

const app = express();
const PORT = process.env.PORT || 3001;

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
app.use('/api/reset', resetRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/layaways', layawayRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
