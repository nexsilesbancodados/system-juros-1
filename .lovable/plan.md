I will implement a comprehensive improvements to the Admin Panel to make it truly functional for platform management.

### Proposed Changes

#### 1. Unified Admin Dashboard (`src/pages/Admin.tsx`)
*   **New Design**: Implement a more modern, dashboard-style interface with a side navigation specific for admin tasks.
*   **Enhanced Statistics**: Add deeper insights like MRR (Monthly Recurring Revenue), churn rate estimation, and global system health.
*   **User Management 2.0**:
    *   Inline editing for user subscription plans and expiration dates.
    *   Direct "Login as user" capability (security permitting, or a deep-link to view user-specific data).
    *   Enhanced filtering by registration date range and activity status.
*   **System Logs Integration**: Embed the system logs directly into the admin panel for easier monitoring.

#### 2. White Label & Global Settings (`src/pages/Configuracoes.tsx`)
*   Refactor the global settings to distinguish between "Platform Defaults" (set by super admin) and "User Settings".
*   Add a "Super Admin" settings tab only visible to the owner to manage global platform parameters (e.g., default trial period, maintenance mode).

#### 3. Support & Communication (`src/components/admin/SupportInbox.tsx`)
*   Improve the ticket management with priority labeling and "Internal Notes" only visible to admins.
*   Add automated replies for common categories.

#### 4. Audit & Security (`src/pages/Auditoria.tsx`)
*   Enhance the audit trail to capture sensitive actions across the entire platform.

### Technical Details
*   **Auth**: Continue using `isSuperAdminEmail` from `src/lib/admin.ts` to protect routes.
*   **UI Components**: Use existing `glass-card` and `text-shimmer` patterns for consistency with the premium look.
*   **Real-time**: Leverage Supabase Realtime for instant updates on new user signups or support tickets.
