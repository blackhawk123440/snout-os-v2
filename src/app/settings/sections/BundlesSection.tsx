'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Badge, Skeleton, EmptyState, Flex, Input, Select, Modal } from '@/components/ui';

interface Bundle {
  id: string;
  name: string;
  serviceType: string;
  visitCount: number;
  priceInCents: number;
  discountPercent: number;
  expirationDays: number;
  autoRenew: boolean;
  enabled: boolean;
  createdAt: string;
}

const defaultForm = {
  name: '',
  serviceType: 'Dog Walking',
  visitCount: 5,
  priceInCents: 20000,
  discountPercent: 10,
  expirationDays: 90,
  autoRenew: false,
};

export function BundlesSection() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const { data, isLoading } = useQuery<{ bundles: Bundle[] }>({
    queryKey: ['bundles'],
    queryFn: async () => {
      const res = await fetch('/api/ops/bundles');
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/ops/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to create bundle');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bundles'] });
      setShowCreate(false);
      setForm(defaultForm);
    },
  });

  const bundles = data?.bundles || [];

  return (
    <div className="flex flex-col gap-4">
      <Flex align="center" justify="space-between">
        <h3 className="text-lg font-semibold text-text-primary">Service Bundles</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>Create Bundle</Button>
      </Flex>

      {isLoading ? (
        <Skeleton height="200px" />
      ) : bundles.length === 0 ? (
        <EmptyState
          title="No bundles yet"
          description="Create a service bundle to offer package pricing to clients."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {bundles.map((b) => (
            <Card key={b.id}>
              <div className="p-4 flex justify-between items-start">
                <div>
                  <Flex align="center" gap={2}>
                    <span className="text-lg font-semibold">{b.name}</span>
                    <Badge variant={b.enabled ? 'success' : 'warning'}>{b.enabled ? 'Active' : 'Disabled'}</Badge>
                  </Flex>
                  <div className="text-sm text-text-secondary mt-1">
                    {b.visitCount} {b.serviceType} visits &middot; ${(b.priceInCents / 100).toFixed(2)} &middot; {b.discountPercent}% off
                  </div>
                  <div className="text-xs text-text-tertiary mt-1">
                    Expires after {b.expirationDays} days{b.autoRenew ? ' \u00b7 Auto-renew' : ''}
                  </div>
                </div>
                <div className="text-2xl font-bold text-text-primary">${(b.priceInCents / 100).toFixed(0)}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal isOpen title="Create Bundle" onClose={() => setShowCreate(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Bundle Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="5-Pack Dog Walking" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Service Type</label>
              <Select
                value={form.serviceType}
                onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                options={[
                  { value: 'Dog Walking', label: 'Dog Walking' },
                  { value: 'Drop-in Visit', label: 'Drop-in Visit' },
                  { value: 'Housesitting', label: 'Housesitting' },
                  { value: '24/7 Care', label: '24/7 Care' },
                ]}
              />
            </div>
            <Flex gap={3}>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Visits</label>
                <Input type="number" value={form.visitCount} onChange={(e) => setForm({ ...form, visitCount: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Price ($)</label>
                <Input type="number" value={form.priceInCents / 100} onChange={(e) => setForm({ ...form, priceInCents: Math.round(parseFloat(e.target.value) * 100) || 0 })} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Discount %</label>
                <Input type="number" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: parseInt(e.target.value) || 0 })} />
              </div>
            </Flex>
            <div>
              <label className="block text-sm font-medium mb-1">Expiration (days)</label>
              <Input type="number" value={form.expirationDays} onChange={(e) => setForm({ ...form, expirationDays: parseInt(e.target.value) || 30 })} />
            </div>
            <Flex gap={2} justify="flex-end">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.name}>
                {createMutation.isPending ? 'Creating\u2026' : 'Create Bundle'}
              </Button>
            </Flex>
          </div>
        </Modal>
      )}
    </div>
  );
}
