/**
 * Automation Template System
 * 
 * Handles template variables, validation, and preview generation.
 */

/**
 * Template variable definition
 */
export interface TemplateVariable {
  id: string;
  name: string;
  description: string;
  category: 'client' | 'sitter' | 'booking' | 'payment' | 'company';
  example: string;
}

/**
 * Available template variables
 */
export const templateVariables: TemplateVariable[] = [
  // Client variables
  {
    id: 'client.firstName',
    name: 'Client First Name',
    description: 'Client first name',
    category: 'client',
    example: 'John',
  },
  {
    id: 'client.lastName',
    name: 'Client Last Name',
    description: 'Client last name',
    category: 'client',
    example: 'Doe',
  },
  {
    id: 'client.name',
    name: 'Client Full Name',
    description: 'Client full name',
    category: 'client',
    example: 'John Doe',
  },
  {
    id: 'client.phone',
    name: 'Client Phone',
    description: 'Client phone number',
    category: 'client',
    example: '(555) 123-4567',
  },
  {
    id: 'client.email',
    name: 'Client Email',
    description: 'Client email address',
    category: 'client',
    example: 'john@example.com',
  },
  
  // Sitter variables
  {
    id: 'sitter.name',
    name: 'Sitter Name',
    description: 'Sitter full name',
    category: 'sitter',
    example: 'Jane Smith',
  },
  {
    id: 'sitter.firstName',
    name: 'Sitter First Name',
    description: 'Sitter first name',
    category: 'sitter',
    example: 'Jane',
  },
  {
    id: 'sitter.tier',
    name: 'Sitter Tier',
    description: 'Sitter tier name',
    category: 'sitter',
    example: 'Elite',
  },
  
  // Booking variables
  {
    id: 'booking.service',
    name: 'Service Type',
    description: 'Booking service type',
    category: 'booking',
    example: 'Dog Walking',
  },
  {
    id: 'booking.date',
    name: 'Booking Date',
    description: 'Booking start date',
    category: 'booking',
    example: 'Monday, January 15, 2024',
  },
  {
    id: 'booking.time',
    name: 'Booking Time',
    description: 'Booking start time',
    category: 'booking',
    example: '9:00 AM',
  },
  {
    id: 'booking.schedule',
    name: 'Schedule',
    description: 'Full schedule with dates and times',
    category: 'booking',
    example: 'Monday, Jan 15 at 9:00 AM - 11:00 AM',
  },
  {
    id: 'booking.address',
    name: 'Address',
    description: 'Booking address',
    category: 'booking',
    example: '123 Main St, City, State 12345',
  },
  {
    id: 'booking.pets',
    name: 'Pets',
    description: 'Pet information',
    category: 'booking',
    example: '2 Dogs, 1 Cat',
  },
  {
    id: 'booking.total',
    name: 'Total Price',
    description: 'Booking total price',
    category: 'booking',
    example: '$150.00',
  },
  {
    id: 'booking.earnings',
    name: 'Sitter Earnings',
    description: 'Sitter earnings for this booking',
    category: 'booking',
    example: '$120.00',
  },
  {
    id: 'booking.status',
    name: 'Status',
    description: 'Booking status',
    category: 'booking',
    example: 'Confirmed',
  },
  
  // Payment variables
  {
    id: 'payment.link',
    name: 'Payment Link',
    description: 'Payment link URL',
    category: 'payment',
    example: 'https://checkout.stripe.com/...',
  },
  {
    id: 'payment.amount',
    name: 'Payment Amount',
    description: 'Payment amount',
    category: 'payment',
    example: '$150.00',
  },
  {
    id: 'tip.link',
    name: 'Tip Link',
    description: 'Tip link URL',
    category: 'payment',
    example: 'https://checkout.stripe.com/...',
  },
  {
    id: 'tip.amount',
    name: 'Tip Amount',
    description: 'Tip amount',
    category: 'payment',
    example: '$20.00',
  },
  
  // Company variables
  {
    id: 'company.name',
    name: 'Company Name',
    description: 'Business name',
    category: 'company',
    example: 'Snout OS',
  },
  {
    id: 'company.phone',
    name: 'Company Phone',
    description: 'Business phone number',
    category: 'company',
    example: '(555) 123-4567',
  },
];

/**
 * Extract variables from template text
 */
export function extractVariables(template: string): string[] {
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const matches = template.matchAll(variableRegex);
  const variables: string[] = [];
  
  for (const match of matches) {
    const varName = match[1].trim();
    if (varName && !variables.includes(varName)) {
      variables.push(varName);
    }
  }
  
  return variables;
}

/**
 * Validate template variables
 */
export function validateTemplateVariables(template: string): {
  valid: boolean;
  missing: string[];
  unknown: string[];
} {
  const found = extractVariables(template);
  const validIds = templateVariables.map(v => v.id);
  const unknown = found.filter(v => !validIds.includes(v));
  
  // For now, we don't require all variables to be present
  // This could be enhanced with required variable lists per template type
  return {
    valid: unknown.length === 0,
    missing: [],
    unknown,
  };
}

/**
 * Replace variables in template with example data
 */
export function previewTemplate(template: string, exampleData?: Record<string, any>): string {
  let result = template;
  const variables = extractVariables(template);
  
  for (const variable of variables) {
    let replacement = '';
    
    // Use example data if provided
    if (exampleData && exampleData[variable]) {
      replacement = String(exampleData[variable]);
    } else {
      // Use default example from variable definition
      const varDef = templateVariables.find(v => v.id === variable);
      replacement = varDef?.example || `[${variable}]`;
    }
    
    result = result.replace(new RegExp(`\\{\\{${variable}\\}\\}`, 'g'), replacement);
  }
  
  return result;
}

/**
 * Get character count for SMS (with variable placeholders)
 */
export function getSMSCharacterCount(template: string): number {
  // Replace variables with estimated lengths for character count
  let estimated = template;
  const variables = extractVariables(template);
  
  for (const variable of variables) {
    const varDef = templateVariables.find(v => v.id === variable);
    const estimatedLength = varDef?.example.length || 20;
    estimated = estimated.replace(
      new RegExp(`\\{\\{${variable}\\}\\}`, 'g'),
      'x'.repeat(estimatedLength)
    );
  }
  
  return estimated.length;
}

/**
 * Get variables by category
 */
export function getVariablesByCategory(category: TemplateVariable['category']): TemplateVariable[] {
  return templateVariables.filter(v => v.category === category);
}

/**
 * Get variable by ID
 */
export function getVariableById(id: string): TemplateVariable | undefined {
  return templateVariables.find(v => v.id === id);
}
