/**
 * Global teardown for Playwright tests.
 *
 * Responsibilities:
 * - Delete test tickets (by tenant ID)
 * - Delete test users (by email pattern)
 * - Delete test municipalities
 * - Handle errors gracefully (log and continue, don't fail teardown)
 */

import { supabaseAdmin } from './fixtures/supabase-test-client.js';
import { TEST_MUNICIPALITIES } from './fixtures/test-data.js';

async function globalTeardown() {
  console.log('\n🧹 Running global teardown...\n');

  try {
    // 1. Delete test tickets (by tenant_id)
    console.log('🎫 Deleting test tickets...');
    const testTenantIds = TEST_MUNICIPALITIES.map((m) => m.id);

    for (const tenantId of testTenantIds) {
      try {
        const { error: ticketsError } = await supabaseAdmin
          .from('tickets')
          .delete()
          .eq('tenant_id', tenantId);

        if (ticketsError) {
          console.warn(`  ⚠️  Warning deleting tickets for ${tenantId}:`, ticketsError.message);
        } else {
          console.log(`  ✓ Tickets deleted for tenant: ${tenantId}`);
        }
      } catch (err) {
        console.warn(`  ⚠️  Error deleting tickets for ${tenantId}:`, err);
      }
    }

    // 2. Delete test users (by email pattern)
    console.log('\n👥 Deleting test users...');
    try {
      const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();

      if (allUsers?.users) {
        for (const user of allUsers.users) {
          // Delete users with @test-*.test email domain
          if (user.email?.includes('@test-') && user.email?.endsWith('.test')) {
            try {
              const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
                user.id
              );

              if (deleteError) {
                console.warn(`  ⚠️  Warning deleting user ${user.email}:`, deleteError.message);
              } else {
                console.log(`  ✓ User deleted: ${user.email}`);
              }
            } catch (err) {
              console.warn(`  ⚠️  Error deleting user ${user.email}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.warn('  ⚠️  Error listing users for deletion:', err);
    }

    // 3. Delete test municipalities
    console.log('\n📍 Deleting test municipalities...');
    for (const muni of TEST_MUNICIPALITIES) {
      try {
        const { error } = await supabaseAdmin
          .from('municipalities')
          .delete()
          .eq('id', muni.id);

        if (error) {
          console.warn(`  ⚠️  Warning deleting municipality ${muni.id}:`, error.message);
        } else {
          console.log(`  ✓ Municipality deleted: ${muni.id}`);
        }
      } catch (err) {
        console.warn(`  ⚠️  Error deleting municipality ${muni.id}:`, err);
      }
    }

    console.log('\n✅ Global teardown complete!\n');
  } catch (error) {
    console.error('\n⚠️  Global teardown encountered errors (continuing):', error);
    // Don't throw - we want teardown to complete even with errors
  }
}

export default globalTeardown;
