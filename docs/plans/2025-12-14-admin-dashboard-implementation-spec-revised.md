# Admin Dashboard Implementation Specification - REVISED

## Overview
Berdasarkan audit menyeluruh admin dashboard Kalanara Spa dan review dari 3 expert skills (backend-dev, frontend-design, frontend-ui-integration), spesifikasi ini telah diperbaiki untuk mencakup rencana implementasi lengkap 5 missing features dengan fokus pada backend integration, consistent design, dan proper UI/UX patterns.

## 🎯 **FITUR PRIORITAS IMPLEMENTASI**

### **Phase 1: Backend Foundation (1-2 hari)**
**1. Admin User Management Backend**
- File: `lib/actions/admin-users.ts` (NEW)
- Functions:
  - `createAdminUser()` - Create admin via Supabase Auth
  - `getAdminUsers()` - List all admin users 
  - `updateAdminUserRole()` - Role management (SUPER_ADMIN, MANAGER, STAFF)
  - `deactivateAdminUser()` - Soft delete pattern
- Security: Role-based access control (RBAC)
- Database: RLS policies untuk `admins` table
- Audit: Admin action logging untuk compliance

**2. Security Enhancement**
- Input validation dan sanitization utilities
- Admin action middleware
- Permission-based component rendering

### **Phase 2: Core Admin Features (3-4 hari) - HIGH PRIORITY**

**1. Orders Management** 
- Status: Backend EXISTS, Frontend MISSING
- Files: `app/admin/orders/page.tsx`, `components/admin/orders-client.tsx`
- Features:
  - Data table dengan filtering (status, date range, customer)
  - Search functionality (customer name, email, order ID)
  - Status update dengan optimistic UI (PENDING → COMPLETED/FAILED/REFUNDED)
  - Pagination dengan server-side data
  - Export to CSV/PDF functionality
  - Order detail modal dengan full information
- UI Design: Table layout dengan inline status badges, action buttons
- Integration: Existing `lib/actions/orders.ts` (getOrders, updateOrderStatus)

**2. Reviews Management**
- Status: Backend EXISTS, Frontend MISSING  
- Files: `app/admin/reviews/page.tsx`, `components/admin/reviews-client.tsx`
- Features:
  - Card-based layout untuk reviews display
  - Rating visualization dengan star components
  - Moderation tools: Approve, Reject, Delete inappropriate reviews
  - Bulk actions untuk efficiency
  - Filter by rating (1-5 stars)
  - Search by customer name atau comment content
- UI Design: Card layout dengan moderation actions panel
- Integration: Existing `lib/actions/reviews.ts` (getReviews, deleteReview)

### **Phase 3: Administrative Tools (2-3 hari) - MEDIUM PRIORITY**

**3. Admin User Management**
- Status: Database EXISTS, Backend & Frontend MISSING
- Files: `app/admin/users/page.tsx`, `components/admin/admin-users-client.tsx`
- Features:
  - User creation form dengan role assignment
  - Role management interface dengan badges (SUPER_ADMIN, MANAGER, STAFF)
  - Deactivation workflows dengan confirmation
  - Permission matrix display
  - Search dan filter functionality
- UI Design: Management table dengan role badges, action dropdown
- Integration: New `lib/actions/admin-users.ts`

**4. Settings Page**
- Status: Referenced di sidebar, NOT implemented
- Files: `app/admin/settings/page.tsx`, `components/admin/settings-client.tsx`  
- Features:
  - System configuration forms
  - Business hours management
  - Email template settings (via Resend API)
  - Payment method configuration
  - Voucher expiration settings
  - Backup/restore functionality
- UI Design: Form sections dengan validation, tabbed interface
- Backend: Settings storage (database table atau file-based)

### **Phase 4: Support Features (1-2 hari) - LOW PRIORITY**

**5. Help Center**
- Status: Referenced di sidebar, NOT implemented
- Files: `app/admin/help/page.tsx`, `components/admin/help-client.tsx`
- Features:
  - Admin documentation dengan search
  - FAQ section dengan collapsible items
  - Troubleshooting guides
  - Video tutorials embedding
  - Contact support form
- UI Design: Documentation layout dengan sidebar navigation
- Content: Markdown-based atau database-driven

## 🎨 **AESTHETIC DIRECTION & DESIGN SYSTEM**

### **Visual Consistency**
```css
/* Kalanara Admin Design Tokens */
--admin-primary: 93 94 84; /* Sage green dari existing palette */
--admin-secondary: 210 40% 98%; /* Soft background */
--admin-accent: 142 76% 36%; /* Action buttons */
--admin-surface: 0 0% 100%; /* Cards dan panels */
--admin-border: 220 13% 91%; /* Subtle borders */
--admin-muted: 220 9% 46%; /* Secondary text */
```

### **Component Patterns**
- **Orders**: Data table dengan inline status editing, progressive disclosure
- **Reviews**: Card-based dengan moderation actions, rating visualization
- **Users**: Management table dengan role badges, permission indicators
- **Settings**: Form sections dengan validation, tabbed navigation
- **Help**: Documentation dengan search, collapsible sections

### **Interaction Design**
- Optimistic updates untuk better perceived performance
- Progressive disclosure untuk complex forms
- Contextual actions berdasarkan user role
- Consistent loading states dengan skeleton components
- Toast notifications untuk user feedback

## 🔧 **TECHNICAL ARCHITECTURE**

### **Frontend Structure**
```
components/admin/
├── orders-client.tsx          # NEW - Orders management table
├── reviews-client.tsx         # NEW - Reviews moderation  
├── admin-users-client.tsx     # NEW - User management
├── settings-client.tsx        # NEW - Configuration forms
└── help-client.tsx            # NEW - Documentation

app/admin/
├── orders/
│   ├── page.tsx               # NEW
│   └── loading.tsx            # NEW - Skeleton states
├── reviews/
│   ├── page.tsx               # NEW  
│   └── loading.tsx            # NEW
├── users/
│   ├── page.tsx               # NEW
│   └── loading.tsx            # NEW
├── settings/
│   ├── page.tsx               # NEW
│   └── loading.tsx            # NEW
└── help/
    ├── page.tsx               # NEW
    └── loading.tsx            # NEW
```

### **Backend Integration**
```
lib/actions/
├── orders.ts                  # EXISTS - Frontend integration needed
├── reviews.ts                 # EXISTS - Frontend integration needed
└── admin-users.ts             # NEW - CRUD operations

lib/types/
└── database.types.ts          # UPDATE - Add admin user types
```

### **Navigation Updates**
- Update `components/admin/sidebar.tsx` dengan proper navigation
- Add breadcrumb navigation untuk deep pages
- Active state management untuk current page indication

## 🚀 **IMPLEMENTATION APPROACH**

### **Phase 1: Backend Foundation**
1. Create `lib/actions/admin-users.ts` dengan full CRUD operations
2. Add TypeScript types untuk admin users
3. Implement RLS policies dan security middleware
4. Add audit logging untuk admin actions

### **Phase 2: Core Admin Features**  
1. Orders Management:
   - Implement data table dengan filtering dan search
   - Add optimistic updates untuk status changes
   - Include export functionality
2. Reviews Management:
   - Create card-based layout dengan moderation tools
   - Implement bulk actions
   - Add filtering dan search capabilities

### **Phase 3: Admin Tools**
1. User Management:
   - Build user creation dan role assignment interface
   - Implement permission-based rendering
   - Add deactivation workflows
2. Settings:
   - Create configuration forms dengan validation
   - Implement business hours management
   - Add email template editing

### **Phase 4: Support Features**
1. Help Center:
   - Build documentation dengan search
   - Add FAQ section
   - Implement troubleshooting guides

## 📊 **SUCCESS CRITERIA**

### **Technical Quality**
- ✅ All TypeScript types properly defined
- ✅ Server actions dengan proper error handling  
- ✅ RLS policies tested dan working
- ✅ Loading states implemented dengan skeletons
- ✅ Responsive design across all breakpoints
- ✅ Comprehensive test coverage

### **User Experience**
- ✅ Consistent dengan existing design system
- ✅ Optimistic updates untuk better perceived performance
- ✅ Proper error states dengan actionable messages
- ✅ Keyboard navigation support
- ✅ Screen reader compatibility (ARIA labels)
- ✅ Smooth animations dan transitions

### **Integration Quality**
- ✅ Proper navigation integration dengan sidebar updates
- ✅ Consistent dengan existing component patterns
- ✅ No breaking changes to existing features
- ✅ Proper state management patterns (Zustand, React Query)
- ✅ Performance optimization dengan caching

## 🔍 **QUALITY ASSURANCE**

### **Testing Strategy**
- Unit tests untuk component logic
- Integration tests untuk API interactions
- End-to-end tests untuk user workflows
- Accessibility testing untuk compliance
- Performance testing untuk load times

### **Security Validation**
- RLS policies verification
- Role-based access testing
- Input validation testing
- Audit logging verification

### **Performance Monitoring**
- Server action response times
- Component render performance
- Database query optimization
- Bundle size monitoring

## 📝 **DELIVERABLES**

1. **5 New Admin Pages** dengan full functionality
2. **Backend Actions** untuk admin user management
3. **Updated Navigation** dengan new menu items
4. **Comprehensive Testing** coverage
5. **Documentation** untuk new features
6. **Migration Guide** untuk rollout

## 🎯 **TIMELINE ESTIMATION**
- **Total Duration**: 7-10 hari development
- **Phase 1**: 1-2 hari (Backend foundation)
- **Phase 2**: 3-4 hari (Core features) 
- **Phase 3**: 2-3 hari (Admin tools)
- **Phase 4**: 1-2 hari (Support features)

**Critical Path**: Orders Management → Reviews Management → Admin User Management → Settings → Help Center

Apakah spesifikasi yang sudah direvisi ini sudah sesuai dan siap untuk implementation?