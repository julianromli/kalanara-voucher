import { render, screen } from '@testing-library/react';
import { OrdersClient } from '../orders-client';

describe('OrdersClient', () => {
  test('should render orders table', () => {
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

    render(<OrdersClient initialOrders={mockOrders} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('500,000')).toBeInTheDocument();
  });
});
