import { render, screen } from '@testing-library/react';
import { ReviewsClient } from '../reviews-client';

describe('ReviewsClient', () => {
  test('should render reviews cards', () => {
    const mockReviews = [
      {
        id: '1',
        rating: 5,
        comment: 'Great service!',
        customer_name: 'John Doe'
      }
    ];

    render(<ReviewsClient initialReviews={mockReviews} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Great service!')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
