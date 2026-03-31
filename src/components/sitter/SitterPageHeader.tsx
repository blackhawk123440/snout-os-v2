'use client';

import React from 'react';
import { PageHeader } from '@/components/layout';

export interface SitterPageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function SitterPageHeader({ title, subtitle, action }: SitterPageHeaderProps) {
  return <PageHeader title={title} subtitle={subtitle} actions={action} />;
}
