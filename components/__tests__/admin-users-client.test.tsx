import { render, screen } from '@testing-library/react';
import { AdminUsersClient } from '../admin-users-client';

describe('AdminUsersClient', () => {
  test('should render admin users table', () => {
    const mockUsers = [
      {
        id: '1',
        email: 'admin@test.com',
        name: 'Test Admin',
        role: 'MANAGER',
        created_at: '2025-12-01'
      }
    ];

    render(<AdminUsersClient initialUsers={mockUsers} />);
    
    expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    expect(screen.getByText('Test Admin')).toBeInTheDocument();
    expect(screen.getByText('MANAGER')).toBeInTheDocument();
  });
});
