/**
 * Global setup for Playwright tests.
 *
 * Responsibilities:
 * - Load environment variables from .env.test
 * - Create test municipalities in database (upsert pattern)
 * - Create all 10 test users with proper roles and app_metadata
 * - Log setup actions for debugging
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { supabaseAdmin } from './fixtures/supabase-test-client.js';
import { TEST_MUNICIPALITIES } from './fixtures/test-data.js';

// Import all profiles
import { profile as citizenNew } from './profiles/public/citizen-new.profile.js';
import { profile as citizenReturning } from './profiles/public/citizen-returning.profile.js';
import { profile as citizenGbv } from './profiles/public/citizen-gbv.profile.js';
import { profile as citizenMulti } from './profiles/public/citizen-multireport.profile.js';
import { profile as citizenTracking } from './profiles/public/citizen-tracking.profile.js';
import { profile as admin } from './profiles/municipal/admin.profile.js';
import { profile as manager } from './profiles/municipal/manager.profile.js';
import { profile as managerPretoria } from './profiles/municipal/manager-pretoria.profile.js';
import { profile as fieldWorker } from './profiles/municipal/field-worker.profile.js';
import { profile as sapsLiaison } from './profiles/municipal/saps-liaison.profile.js';
import { profile as wardCouncillor } from './profiles/municipal/ward-councillor.profile.js';
import { profile as cfo } from './profiles/municipal/cfo.profile.js';
import { profile as municipalManager } from './profiles/municipal/municipal-manager.profile.js';
import { profile as executiveMayor } from './profiles/municipal/executive-mayor.profile.js';
import { profile as auditCommittee } from './profiles/municipal/audit-committee.profile.js';
import { profile as internalAuditor } from './profiles/municipal/internal-auditor.profile.js';
import { profile as mpacMember } from './profiles/municipal/mpac-member.profile.js';
import { profile as salgaAdmin } from './profiles/municipal/salga-admin.profile.js';
import { profile as section56Director } from './profiles/municipal/section56-director.profile.js';

// Load .env.test
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.test') });

async function globalSetup() {
  console.log('\n🔧 Running global setup...\n');

  try {
    // 0. Clear stale auth cache to force fresh logins
    // Previous teardown deletes test users, so cached tokens become invalid
    const authDir = join(__dirname, '.auth');
    if (fs.existsSync(authDir)) {
      const files = fs.readdirSync(authDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(join(authDir, file));
        }
      }
      console.log(`🗑️  Cleared ${files.length} cached auth files`);
    }

    // 1. Create test municipalities
    console.log('📍 Creating test municipalities...');
    for (const muni of TEST_MUNICIPALITIES) {
      const { data, error } = await supabaseAdmin
        .from('municipalities')
        .upsert(
          {
            id: muni.id,
            name: muni.name,
            province: muni.province,
            code: muni.code,
            contact_email: muni.contact_email,
            population: muni.population,
            is_active: muni.is_active,
          },
          {
            onConflict: 'id',
          }
        )
        .select()
        .single();

      if (error && error.code !== '23505') {
        // Ignore duplicate key errors
        console.warn(`  ⚠️  Warning creating municipality ${muni.id}:`, error.message);
      } else {
        console.log(`  ✓ Municipality: ${muni.name} (${muni.id})`);
      }
    }

    // 2. Create all test users
    console.log('\n👥 Creating test users...');

    const allProfiles = [
      citizenNew,
      citizenReturning,
      citizenGbv,
      citizenMulti,
      citizenTracking,
      admin,
      manager,
      managerPretoria,
      fieldWorker,
      sapsLiaison,
      wardCouncillor,
      cfo,
      municipalManager,
      executiveMayor,
      auditCommittee,
      internalAuditor,
      mpacMember,
      salgaAdmin,
      section56Director,
    ];

    for (const profile of allProfiles) {
      try {
        // Check if user already exists
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const existing = existingUser?.users?.find((u) => u.email === profile.email);

        if (existing) {
          // Update existing user password and metadata to ensure consistency
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            existing.id,
            {
              password: profile.password,
              email_confirm: true,
              phone_confirm: true,
              user_metadata: {
                full_name: profile.metadata.full_name || profile.name,
                residence_verified: profile.metadata.residence_verified ?? false,
              },
              app_metadata: {
                role: profile.role,
                tenant_id: profile.tenantId,
                ...('app_metadata' in profile.metadata ? profile.metadata.app_metadata : {}),
              },
            }
          );

          if (updateError) {
            console.warn(`  ⚠️  Warning updating user ${profile.email}:`, updateError.message);
          } else {
            console.log(`  ↩️  User updated: ${profile.email} (${profile.role})`);
          }
          continue;
        }

        // Create user with email confirmation
        const { data: newUser, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email: profile.email,
            password: profile.password,
            phone: profile.phone,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: {
              full_name: profile.metadata.full_name || profile.name,
              residence_verified: profile.metadata.residence_verified ?? false,
            },
            app_metadata: {
              role: profile.role,
              tenant_id: profile.tenantId,
              ...('app_metadata' in profile.metadata ? profile.metadata.app_metadata : {}),
            },
          });

        if (createError) {
          console.error(`  ❌ Error creating user ${profile.email}:`, createError.message);
        } else {
          console.log(`  ✓ User created: ${profile.email} (${profile.role})`);
        }
      } catch (err) {
        console.error(`  ❌ Failed to create user ${profile.email}:`, err);
      }
    }

    console.log('\n✅ Global setup complete!\n');
  } catch (error) {
    console.error('\n❌ Global setup failed:', error);
    throw error;
  }
}

export default globalSetup;
