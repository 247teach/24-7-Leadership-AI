-- Migration: seed_agents_and_storage (20260615202358)
-- =====================================================================
-- Seed the agent catalog + demo review queue, and provision storage.
-- =====================================================================

insert into public.agents
  (id, name, icon, description, function_label, clearance_label, required_clearance, greeting, is_flagship, status, sort_order)
values
  ('rebecca', 'Rebecca-AI', 'sparkles',
   'Your company knowledge concierge across the governed knowledge base.',
   'Company knowledge', 'All team members', 'all',
   'Hi. I can search across our governed knowledge base, from policy to playbooks. What do you need?',
   true, 'active', 0),
  ('strategy', 'Strategy Agent', 'compass',
   'Company strategy, priorities, and the thinking behind big decisions.',
   'Strategy and leadership', 'Leadership', 'leadership',
   'Hi. I can help you think through priorities, tradeoffs, and decisions, grounded in the strategy notes on file. Where do you want to start?',
   false, 'active', 1),
  ('integration', 'AI Integration Agent', 'branch',
   'The agentic buildout, internal tooling, and AI workflow design.',
   'AI and engineering', 'Build team', 'build',
   'Hi. Ask me about the agentic buildout, our tooling, or how a workflow is wired. What are you looking into?',
   false, 'active', 2),
  ('academic', 'Academic and Instructional Agent', 'cap',
   'Curriculum, pedagogy, and the Learn, Do, Be model.',
   'Academics', 'Academic team', 'academic',
   'Hi. I can help with curriculum, pedagogy, and the Learn, Do, Be model. What are we designing?',
   false, 'active', 3),
  ('marketing', 'Marketing Agent', 'megaphone',
   'Brand, campaigns, and content production.',
   'Marketing', 'Coming soon', 'marketing', null, false, 'coming_soon', 4),
  ('admissions', 'Admissions Agent', 'usercheck',
   'Enrollment, applicant guidance, and intake.',
   'Admissions', 'Requires higher clearance', 'admissions', null, false, 'restricted', 5),
  ('operations', 'Operations Agent', 'activity',
   'Logistics, vendors, and day to day operations.',
   'Operations', 'Coming soon', 'operations', null, false, 'coming_soon', 6);

insert into public.review_items
  (type, title, submitted_name, source, snippet, target, agent_id, status, created_at)
values
  ('document', 'Q2 Board Notes.pdf', 'Maya Okafor', 'From a Strategy Agent conversation',
   'Workforce orgs close faster than districts and pay from operating budgets, so we are less exposed to grant timing.',
   'Strategy Agent knowledge', 'strategy', 'pending', now() - interval '2 hours'),
  ('document', 'Summer Cohort Refund Policy v3.docx', 'Daniel Reyes', 'Uploaded directly',
   'Full refunds up to 7 days before start. Scholarship seats are credit only. Refunds over $1,000 require Finance sign off.',
   'Rebecca-AI (company knowledge)', 'rebecca', 'pending', now() - interval '3 hours'),
  ('correction', 'Correction to Academic and Instructional Agent', 'Priya Nadar', 'Flagged on an agent response',
   'The Do block should be 90 minutes, not 60. Hands on practice is where the session earns its value.',
   'Academic and Instructional Agent', 'academic', 'pending', now() - interval '1 day'),
  ('document', 'Vendor SOC2 Letter.pdf', 'Maya Okafor', 'Uploaded directly',
   'Independent audit confirms controls for security, availability, and confidentiality through the current period.',
   'Operations Agent (pending launch)', 'operations', 'pending', now() - interval '3 days');

-- Private bucket for chat / knowledge uploads. Files are foldered by user id:
-- uploads/<auth.uid()>/<conversation>/<file>.
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false)
on conflict (id) do nothing;

create policy "uploads read own" on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "uploads insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "uploads delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "uploads read reviewer" on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and public.is_reviewer());
