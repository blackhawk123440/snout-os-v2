import { stripe } from "@/lib/stripe";

export async function getStripeAnalytics(timeRange: string = "30d"): Promise<{
  totalRevenue: number;
  totalCustomers: number;
  totalInvoices: number;
  recentPayments: any[];
  monthlyRevenue: number;
  weeklyRevenue: number;
  dailyRevenue: number;
  averagePayment: number;
  paymentMethods: Record<string, number>;
  revenueByMonth: Record<string, number>;
  topCustomers: Array<{ email: string; totalSpent: number; paymentCount: number }>;
  conversionRate: number;
  refundRate: number;
  churnRate: number;
}> {
  try {
    // Calculate date ranges
    const now = new Date();
    const daysAgo = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : timeRange === "90d" ? 90 : 365;
    const startDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    // Fetch all data
    const [customers, invoices, paymentIntents] = await Promise.all([
      stripe.customers.list({ limit: 100 }),
      stripe.invoices.list({ limit: 100, status: "paid" }),
      stripe.paymentIntents.list({ limit: 100 }),
    ]);

    // Filter data by time range
    const filteredInvoices = invoices.data.filter(invoice => 
      invoice.created >= startTimestamp
    );
    const filteredPaymentIntents = paymentIntents.data.filter(intent => 
      intent.created >= startTimestamp
    );

    // Calculate basic metrics
    const totalRevenue = invoices.data.reduce((sum, invoice) => {
      return sum + (invoice.amount_paid || 0) / 100;
    }, 0);

    const monthlyRevenue = filteredInvoices.reduce((sum, invoice) => {
      return sum + (invoice.amount_paid || 0) / 100;
    }, 0);

    // Calculate weekly and daily revenue
    const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const dayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    const weeklyRevenue = filteredInvoices.filter(invoice => 
      invoice.created >= Math.floor(weekAgo.getTime() / 1000)
    ).reduce((sum, invoice) => sum + (invoice.amount_paid || 0) / 100, 0);

    const dailyRevenue = filteredInvoices.filter(invoice => 
      invoice.created >= Math.floor(dayAgo.getTime() / 1000)
    ).reduce((sum, invoice) => sum + (invoice.amount_paid || 0) / 100, 0);

    // Calculate average payment
    const averagePayment = filteredInvoices.length > 0 
      ? monthlyRevenue / filteredInvoices.length 
      : 0;

    // Payment methods breakdown
    const paymentMethods: Record<string, number> = {};
    filteredPaymentIntents.forEach(intent => {
      const paymentMethodTypes = typeof intent === 'string' 
        ? null 
        : (intent as any).payment_method_types;
      if (paymentMethodTypes && Array.isArray(paymentMethodTypes)) {
        paymentMethodTypes.forEach((method: string) => {
          paymentMethods[method] = (paymentMethods[method] || 0) + 1;
        });
      }
    });

    // Revenue by month
    const revenueByMonth: Record<string, number> = {};
    filteredInvoices.forEach(invoice => {
      const date = new Date(invoice.created * 1000);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + (invoice.amount_paid || 0) / 100;
    });

    // Top customers
    const customerSpending: Record<string, { totalSpent: number; paymentCount: number }> = {};
    filteredInvoices.forEach(invoice => {
      if (invoice.customer_email) {
        if (!customerSpending[invoice.customer_email]) {
          customerSpending[invoice.customer_email] = { totalSpent: 0, paymentCount: 0 };
        }
        customerSpending[invoice.customer_email].totalSpent += (invoice.amount_paid || 0) / 100;
        customerSpending[invoice.customer_email].paymentCount += 1;
      }
    });

    const topCustomers = Object.entries(customerSpending)
      .map(([email, data]) => ({ email, ...data }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Performance metrics
    const totalPaymentIntents = paymentIntents.data.length;
    const successfulPayments = paymentIntents.data.filter(intent => intent.status === 'succeeded').length;
    const refundedPayments = paymentIntents.data.filter(intent => intent.status === 'requires_capture').length;
    
    const conversionRate = totalPaymentIntents > 0 ? (successfulPayments / totalPaymentIntents) * 100 : 0;
    const refundRate = totalPaymentIntents > 0 ? (refundedPayments / totalPaymentIntents) * 100 : 0;
    const churnRate = 5.0; // Placeholder - would need more complex calculation

    // Recent payments with enhanced data
    const recentPayments = filteredInvoices
      .slice(0, 20)
      .map(invoice => ({
        id: invoice.id,
        amount: (invoice.amount_paid || 0) / 100,
        status: invoice.status,
        created: new Date(invoice.created * 1000),
        customerEmail: invoice.customer_email,
        customerName: invoice.customer_name,
        description: invoice.description,
        paymentMethod: (invoice.payment_intent && typeof invoice.payment_intent !== 'string' 
          ? (invoice.payment_intent as any).payment_method_types?.[0] 
          : null) || 'card',
        currency: invoice.currency,
      }));

    return {
      totalRevenue,
      totalCustomers: customers.data.length,
      totalInvoices: invoices.data.length,
      recentPayments,
      monthlyRevenue,
      weeklyRevenue,
      dailyRevenue,
      averagePayment,
      paymentMethods,
      revenueByMonth,
      topCustomers,
      conversionRate,
      refundRate,
      churnRate,
    };
  } catch (error) {
    console.error("Failed to fetch Stripe analytics:", error);
    return {
      totalRevenue: 0,
      totalCustomers: 0,
      totalInvoices: 0,
      recentPayments: [],
      monthlyRevenue: 0,
      weeklyRevenue: 0,
      dailyRevenue: 0,
      averagePayment: 0,
      paymentMethods: {},
      revenueByMonth: {},
      topCustomers: [],
      conversionRate: 0,
      refundRate: 0,
      churnRate: 0,
    };
  }
}