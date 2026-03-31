import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-03-31.basil" as any,
});

export { stripe };

export async function createPaymentLink(
  amount: number,
  description: string,
  customerEmail?: string,
  metadata?: Record<string, string>
): Promise<string | null> {
  try {
    // Create a product first
    const product = await stripe.products.create({
      name: description,
    });

    // Create a price for the product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      ...(customerEmail && { customer_email: customerEmail }),
      ...(metadata && { metadata }),
      payment_intent_data: {
        ...(metadata && { metadata }),
      },
    });

    return paymentLink.url;
  } catch (error) {
    console.error("Failed to create payment link:", error);
    return null;
  }
}

export async function createInvoice(
  customerEmail: string,
  amount: number,
  description: string
): Promise<string | null> {
  try {
    // Create or get customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: customerEmail,
      });
    }

    // Create invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      description,
      auto_advance: true,
    });

    // Add invoice item
    await stripe.invoiceItems.create({
      customer: customer.id,
      invoice: invoice.id,
      amount: Math.round(amount * 100), // Convert to cents
      description,
    });

    // Finalize invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    
    return finalizedInvoice.hosted_invoice_url || null;
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return null;
  }
}

export async function getStripeAnalytics(): Promise<{
  totalRevenue: number;
  totalCustomers: number;
  totalInvoices: number;
  recentPayments: any[];
}> {
  try {
    const [customers, invoices] = await Promise.all([
      stripe.customers.list({ limit: 100 }),
      stripe.invoices.list({ limit: 100, status: "paid" }),
    ]);

    const totalRevenue = invoices.data.reduce((sum, invoice) => {
      return sum + (invoice.amount_paid || 0) / 100; // Convert from cents
    }, 0);

    const recentPayments = invoices.data
      .slice(0, 10)
      .map(invoice => ({
        id: invoice.id,
        amount: (invoice.amount_paid || 0) / 100,
        status: invoice.status,
        created: new Date(invoice.created * 1000),
        customerEmail: invoice.customer_email,
      }));

    return {
      totalRevenue,
      totalCustomers: customers.data.length,
      totalInvoices: invoices.data.length,
      recentPayments,
    };
  } catch (error) {
    console.error("Failed to fetch Stripe analytics:", error);
    return {
      totalRevenue: 0,
      totalCustomers: 0,
      totalInvoices: 0,
      recentPayments: [],
    };
  }
}