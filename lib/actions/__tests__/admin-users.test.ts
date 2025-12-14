import { createAdminUser, getAdminUsers, updateAdminUserRole } from '../admin-users';

describe('Admin User Management', () => {
  test('should create new admin user', async () => {
    const uniqueEmail = `test-admin-${Date.now()}@test.com`;
    const result = await createAdminUser({
      email: uniqueEmail,
      name: 'Test Admin',
      role: 'MANAGER'
    });
    expect(result).toBeDefined();
    expect(result?.email).toBe(uniqueEmail);
  });

  test('should get all admin users', async () => {
    const result = await getAdminUsers();
    expect(Array.isArray(result)).toBe(true);
  });

  test('should handle update with invalid UUID gracefully', async () => {
    const result = await updateAdminUserRole('invalid-uuid', 'MANAGER');
    // Should return null due to invalid UUID
    expect(result).toBeNull();
  });
});
