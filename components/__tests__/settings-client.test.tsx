import { render, screen } from '@testing-library/react';
import { SettingsClient } from '../settings-client';

describe('SettingsClient', () => {
  test('should render settings form sections', () => {
    const mockSettings = {
      businessHours: { start: '09:00', end: '18:00' },
      emailTemplates: { confirmation: 'Template' },
      voucherExpiration: 30
    };

    render(<SettingsClient initialSettings={mockSettings} />);
    
    expect(screen.getByText('Business Hours')).toBeInTheDocument();
    expect(screen.getByText('Email Templates')).toBeInTheDocument();
    expect(screen.getByText('Voucher Settings')).toBeInTheDocument();
  });
});
