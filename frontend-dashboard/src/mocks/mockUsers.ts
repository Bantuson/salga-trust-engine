/**
 * Mock user data for municipal dashboard fallback rendering.
 * 30+ SA-authentic profiles across all 6 roles.
 */

export interface MockUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export const mockUsers: MockUser[] = [
  // Citizens (~18)
  { id: 'u-001-sipho-ndlovu', email: 'sipho.ndlovu@gmail.com', full_name: 'Sipho Ndlovu', role: 'citizen' },
  { id: 'u-002-nomsa-khumalo', email: 'nomsa.khumalo@gmail.com', full_name: 'Nomsa Khumalo', role: 'citizen' },
  { id: 'u-003-thabo-mkhize', email: 'thabo.mkhize@webmail.co.za', full_name: 'Thabo Mkhize', role: 'citizen' },
  { id: 'u-004-zanele-dlamini', email: 'zanele.dlamini@gmail.com', full_name: 'Zanele Dlamini', role: 'citizen' },
  { id: 'u-005-bongani-nkosi', email: 'bongani.nkosi@yahoo.com', full_name: 'Bongani Nkosi', role: 'citizen' },
  { id: 'u-006-lindiwe-zulu', email: 'lindiwe.zulu@gmail.com', full_name: 'Lindiwe Zulu', role: 'citizen' },
  { id: 'u-007-siyabonga-mbeki', email: 'siyabonga.mbeki@webmail.co.za', full_name: 'Siyabonga Mbeki', role: 'citizen' },
  { id: 'u-008-nompumelelo-sithole', email: 'nompumelelo.sithole@gmail.com', full_name: 'Nompumelelo Sithole', role: 'citizen' },
  { id: 'u-009-sbusiso-cele', email: 'sbusiso.cele@gmail.com', full_name: 'Sbusiso Cele', role: 'citizen' },
  { id: 'u-010-ayanda-mthembu', email: 'ayanda.mthembu@yahoo.com', full_name: 'Ayanda Mthembu', role: 'citizen' },
  { id: 'u-011-pieter-van-der-merwe', email: 'pieter.vdmerwe@mweb.co.za', full_name: 'Pieter van der Merwe', role: 'citizen' },
  { id: 'u-012-annemarie-botha', email: 'annemarie.botha@gmail.com', full_name: 'Annemarie Botha', role: 'citizen' },
  { id: 'u-013-sarah-thompson', email: 'sarah.thompson@gmail.com', full_name: 'Sarah Thompson', role: 'citizen' },
  { id: 'u-014-fatima-adams', email: 'fatima.adams@icloud.com', full_name: 'Fatima Adams', role: 'citizen' },
  { id: 'u-015-raj-naidoo', email: 'raj.naidoo@gmail.com', full_name: 'Raj Naidoo', role: 'citizen' },
  { id: 'u-016-david-mokoena', email: 'david.mokoena@gmail.com', full_name: 'David Mokoena', role: 'citizen' },
  { id: 'u-017-lerato-molefe', email: 'lerato.molefe@webmail.co.za', full_name: 'Lerato Molefe', role: 'citizen' },
  { id: 'u-018-michael-oconnor', email: 'michael.oconnor@gmail.com', full_name: "Michael O'Connor", role: 'citizen' },

  // Managers (~4)
  { id: 'u-019-thandi-dube', email: 'thandi.dube@emthanjeni.gov.za', full_name: 'Thandi Dube', role: 'manager' },
  { id: 'u-020-johan-du-plessis', email: 'johan.duplessis@emthanjeni.gov.za', full_name: 'Johan du Plessis', role: 'manager' },
  { id: 'u-021-riana-venter', email: 'riana.venter@emthanjeni.gov.za', full_name: 'Riana Venter', role: 'manager' },
  { id: 'u-022-nkosinathi-gumede', email: 'nkosinathi.gumede@emthanjeni.gov.za', full_name: 'Nkosinathi Gumede', role: 'manager' },

  // Admins (~2)
  { id: 'u-023-priya-govender', email: 'priya.govender@emthanjeni.gov.za', full_name: 'Priya Govender', role: 'admin' },
  { id: 'u-024-hendrik-pretorius', email: 'hendrik.pretorius@emthanjeni.gov.za', full_name: 'Hendrik Pretorius', role: 'admin' },

  // Field workers (~8)
  { id: 'u-025-lungelo-sithole', email: 'lungelo.sithole@emthanjeni.gov.za', full_name: 'Lungelo Sithole', role: 'field_worker' },
  { id: 'u-026-musa-hadebe', email: 'musa.hadebe@emthanjeni.gov.za', full_name: 'Musa Hadebe', role: 'field_worker' },
  { id: 'u-027-zodwa-ntuli', email: 'zodwa.ntuli@emthanjeni.gov.za', full_name: 'Zodwa Ntuli', role: 'field_worker' },
  { id: 'u-028-siphamandla-zungu', email: 'siphamandla.zungu@emthanjeni.gov.za', full_name: 'Siphamandla Zungu', role: 'field_worker' },
  { id: 'u-029-jabulani-shabalala', email: 'jabulani.shabalala@emthanjeni.gov.za', full_name: 'Jabulani Shabalala', role: 'field_worker' },
  { id: 'u-030-andile-dlamini', email: 'andile.dlamini@emthanjeni.gov.za', full_name: 'Andile Dlamini', role: 'field_worker' },
  { id: 'u-031-nomvula-ngcobo', email: 'nomvula.ngcobo@emthanjeni.gov.za', full_name: 'Nomvula Ngcobo', role: 'field_worker' },
  { id: 'u-032-sifiso-mthethwa', email: 'sifiso.mthethwa@emthanjeni.gov.za', full_name: 'Sifiso Mthethwa', role: 'field_worker' },

  // SAPS Liaison (~3)
  { id: 'u-033-colonel-bhengu', email: 'n.bhengu@saps.gov.za', full_name: 'Colonel Nozipho Bhengu', role: 'saps_liaison' },
  { id: 'u-034-captain-moyo', email: 't.moyo@saps.gov.za', full_name: 'Captain Thandeka Moyo', role: 'saps_liaison' },
  { id: 'u-035-sergeant-jacobs', email: 'd.jacobs@saps.gov.za', full_name: 'Sergeant Desiree Jacobs', role: 'saps_liaison' },

  // Ward Councillors (~4)
  { id: 'u-036-cllr-moloi', email: 'cllr.moloi@emthanjeni.gov.za', full_name: 'Cllr Busisiwe Moloi', role: 'ward_councillor' },
  { id: 'u-037-cllr-du-toit', email: 'cllr.dutoit@emthanjeni.gov.za', full_name: 'Cllr Francois du Toit', role: 'ward_councillor' },
  { id: 'u-038-cllr-naidoo', email: 'cllr.naidoo@emthanjeni.gov.za', full_name: 'Cllr Samantha Naidoo', role: 'ward_councillor' },
  { id: 'u-039-cllr-mnguni', email: 'cllr.mnguni@emthanjeni.gov.za', full_name: 'Cllr Bonginkosi Mnguni', role: 'ward_councillor' },
];
