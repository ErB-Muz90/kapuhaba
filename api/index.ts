import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from '../server/src/routes/auth';
import productRoutes from '../server/src/routes/products';
import customerRoutes from '../server/src/routes/customers';
import supplierRoutes from '../server/src/routes/suppliers';
import staffRoutes from '../server/src/routes/staff';
import saleRoutes from '../server/src/routes/sales';
import expenseRoutes from '../server/src/routes/expenses';
import settingsRoutes from '../server/src/routes/settings';
import shiftRoutes from '../server/src/routes/shifts';
import purchaseOrderRoutes from '../server/src/routes/purchaseOrders';
import stockRoutes from '../server/src/routes/stock';
import accountsPayableRoutes from '../server/src/routes/accountsPayable';
import loyaltyRoutes from '../server/src/routes/loyalty';

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

export default app;
