/**
 * Stripe Connect helpers for sitter payouts.
 * Create accounts, onboarding links, and transfers.
 * Mocked in tests via STRIPE_MOCK_TRANSFER env or dependency injection.
 */

import Stripe from "stripe";
import { stripe } from "./stripe";

const STRIPE_MOCK = process.env.STRIPE_MOCK_TRANSFER === "true";

export interface CreateAccountResult {
  accountId: string;
  onboardingUrl: string | null;
}

export async function createConnectAccount(params: {
  email: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<CreateAccountResult> {
  if (STRIPE_MOCK) {
    return {
      accountId: "acct_mock_" + Date.now(),
      onboardingUrl: params.returnUrl + "?mock=1",
    };
  }

  const account = await stripe.accounts.create({
    type: "express",
    email: params.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  });

  return {
    accountId: account.id,
    onboardingUrl: link.url,
  };
}

export async function createAccountLink(params: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<string | null> {
  if (STRIPE_MOCK) {
    return params.returnUrl + "?mock=1";
  }
  const link = await stripe.accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

export async function createLoginLink(accountId: string): Promise<string | null> {
  if (STRIPE_MOCK) return null;
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

export interface AccountStatus {
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
}

export async function getAccountStatus(accountId: string): Promise<AccountStatus> {
  if (STRIPE_MOCK) {
    return {
      payoutsEnabled: true,
      chargesEnabled: true,
      detailsSubmitted: true,
    };
  }

  const account = await stripe.accounts.retrieve(accountId);
  return {
    payoutsEnabled: account.payouts_enabled ?? false,
    chargesEnabled: account.charges_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
  };
}

export interface CreateTransferResult {
  transferId: string;
}

export async function createTransferToConnectedAccount(params: {
  amountCents: number;
  currency: string;
  destinationAccountId: string;
  description?: string;
  metadata?: Record<string, string>;
}): Promise<CreateTransferResult> {
  if (STRIPE_MOCK) {
    return {
      transferId: "tr_mock_" + Date.now(),
    };
  }

  const transfer = await stripe.transfers.create({
    amount: params.amountCents,
    currency: params.currency,
    destination: params.destinationAccountId,
    description: params.description,
    metadata: params.metadata,
  });

  return { transferId: transfer.id };
}
