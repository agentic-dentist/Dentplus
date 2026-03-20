-- ============================================
-- AGENTIC DENTIST — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Clinics (each is an independent workspace)
create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  address text,
  phone text,
  email text,
  timezone text default 'America/Toronto',
  logo_url text,
  created_at timestamptz default now()
);

-- Providers (portable identity — one login, multiple clinics)
create table providers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  specialty text, -- dentist, hygienist, etc
  avatar_url text,
  created_at timestamptz default now()
);

-- Clinic memberships (many-to-many: provider ↔ clinic + role)
create table clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade not null,
  provider_id uuid references providers(id) on delete cascade not null,
  role text not null default 'associate', -- owner | dentist | hygienist | receptionist | billing
  created_at timestamptz default now(),
  unique(clinic_id, provider_id)
);

-- Patients (scoped per clinic — data never crosses clinic boundaries)
create table patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade not null,
  external_ref uuid default gen_random_uuid() unique, -- agents only see this token
  full_name text not null,
  date_of_birth date,
  phone text,
  email text,
  insurance_provider text,
  insurance_number text,
  medical_notes text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Appointments
create table appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade not null,
  patient_id uuid references patients(id) not null,
  provider_id uuid references providers(id),
  start_time timestamptz not null,
  end_time timestamptz not null,
  appointment_type text not null, -- cleaning | checkup | emergency | filling | consultation
  reason text,
  status text default 'scheduled', -- scheduled | confirmed | cancelled | completed | no_show
  notes text,
  booked_via text default 'web_agent', -- web_agent | phone | manual
  created_at timestamptz default now()
);

-- Chat conversations (one per patient session)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) on delete cascade not null,
  patient_id uuid references patients(id),
  appointment_id uuid references appointments(id),
  status text default 'active', -- active | completed | abandoned
  created_at timestamptz default now()
);

-- Chat messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null, -- user | assistant
  content text not null,
  created_at timestamptz default now()
);

-- Audit log (immutable — no updates or deletes)
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table clinics enable row level security;
alter table patients enable row level security;
alter table appointments enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Public read for clinic info (for widget)
create policy "clinic_public_read" on clinics for select using (true);

-- Service role bypasses RLS (used by your API routes)
-- Your SUPABASE_SERVICE_ROLE_KEY handles this automatically

-- ============================================
-- SEED DATA — Demo Clinic
-- ============================================

insert into clinics (id, name, slug, address, phone, email, timezone) values
(
  '00000000-0000-0000-0000-000000000001',
  'Clinique Dentaire Montréal',
  'demo',
  '1234 Rue Sainte-Catherine O, Montréal, QC H3G 1P3',
  '514-555-0100',
  'info@cliniquedemomtl.ca',
  'America/Toronto'
);

-- Demo patients
insert into patients (clinic_id, full_name, phone, email, insurance_provider) values
('00000000-0000-0000-0000-000000000001', 'Marie Tremblay', '514-555-0201', 'marie.tremblay@email.com', 'Sun Life'),
('00000000-0000-0000-0000-000000000001', 'Jean-François Lapointe', '514-555-0202', 'jf.lapointe@email.com', 'Manulife'),
('00000000-0000-0000-0000-000000000001', 'Sarah Johnson', '514-555-0203', 'sarah.j@email.com', 'Great-West Life'),
('00000000-0000-0000-0000-000000000001', 'Ahmed Benali', '514-555-0204', 'ahmed.benali@email.com', 'Desjardins');
