import { render, screen } from '@testing-library/react';
import { HelpClient } from '../help-client';

describe('HelpClient', () => {
  test('should render help center sections', () => {
    render(<HelpClient />);
    
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('FAQ')).toBeInTheDocument();
    expect(screen.getByText('Contact Support')).toBeInTheDocument();
  });
});
