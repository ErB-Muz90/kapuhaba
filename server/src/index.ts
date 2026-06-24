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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
