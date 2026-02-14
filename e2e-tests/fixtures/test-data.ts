/**
 * Test data generators using Faker.
 *
 * Provides unique, realistic test data for citizens, reports, and municipalities.
 * All generators produce random data per invocation for test isolation.
 */

import { faker } from '@faker-js/faker';

/**
 * South African provinces
 */
const SA_PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];

/**
 * Report categories
 */
const REPORT_CATEGORIES = [
  'Water & Sanitation',
  'Electricity',
  'Roads & Potholes',
  'Waste Management',
  'Public Safety',
  'Housing',
  'Other',
];

/**
 * Fixed test municipalities (created by global-setup.ts)
 */
export const TEST_MUNICIPALITIES = [
  {
    id: 'test-jozi-001',
    name: 'City of Johannesburg (Test)',
    province: 'Gauteng',
    code: 'MUN001',
    contact_name: 'Test Contact Jozi',
    contact_email: 'contact@test-jozi-001.gov.za',
    contact_phone: '+27111234567',
  },
  {
    id: 'test-pretoria-001',
    name: 'City of Tshwane (Test)',
    province: 'Gauteng',
    code: 'MUN002',
    contact_name: 'Test Contact Tshwane',
    contact_email: 'contact@test-pretoria-001.gov.za',
    contact_phone: '+27123456789',
  },
];

/**
 * Generate random citizen data
 */
export interface CitizenData {
  email: string;
  password: string;
  phone: string;
  firstName: string;
  lastName: string;
  address: string;
}

export function generateCitizenData(tenantId?: string): CitizenData {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const suffix = tenantId ? `@${tenantId}.test` : '@test.local';

  return {
    email: faker.internet.email({ firstName, lastName }).toLowerCase() + suffix,
    password: process.env.TEST_PASSWORD || 'Test123!@#',
    phone: `+27${faker.number.int({ min: 600000000, max: 899999999 })}`,
    firstName,
    lastName,
    address: `${faker.location.streetAddress()}, ${faker.location.city()}, ${faker.helpers.arrayElement(SA_PROVINCES)}`,
  };
}

/**
 * Generate random report data
 */
export interface ReportData {
  category: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
}

export function generateReportData(category?: string): ReportData {
  return {
    category: category || faker.helpers.arrayElement(REPORT_CATEGORIES),
    description: faker.lorem.sentences(3),
    address: `${faker.location.streetAddress()}, ${faker.location.city()}, Gauteng`,
    // Johannesburg coordinates range
    latitude: faker.number.float({ min: -26.3, max: -26.1, fractionDigits: 6 }),
    longitude: faker.number.float({ min: 27.9, max: 28.1, fractionDigits: 6 }),
  };
}

/**
 * Generate random municipality data
 */
export interface MunicipalityData {
  name: string;
  province: string;
  code: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

export function generateMunicipalityData(): MunicipalityData {
  const province = faker.helpers.arrayElement(SA_PROVINCES);
  const cityName = faker.location.city();
  const municipalityName = `${cityName} Municipality`;

  return {
    name: municipalityName,
    province,
    code: `MUN${faker.number.int({ min: 1000, max: 9999 })}`,
    contactName: faker.person.fullName(),
    contactEmail: faker.internet.email({ firstName: 'contact', lastName: cityName }).toLowerCase(),
    contactPhone: `+27${faker.number.int({ min: 100000000, max: 899999999 })}`,
  };
}
