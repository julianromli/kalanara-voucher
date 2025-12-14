import { render, screen } from '@testing-library/react';
import { PurchasesClient } from '../purchases-client';

describe('PurchasesClient', () => {
  test('should render purchases table', () => {
    const mockOrders = [
      {
        id: '1',
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        total_amount: 500000,
        payment_status: 'PENDING',
        created_at: '2025-12-01'
      }
    ];

    render(<PurchasesClient initialOrders={mockOrders} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('500,000')).toBeInTheDocument();
  });
});
