import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const configReady = /^https:\/\/.+\.supabase\.co$/.test(SUPABASE_URL) &&
  SUPABASE_PUBLISHABLE_KEY && !SUPABASE_PUBLISHABLE_KEY.includes('YOUR_');
const $ = (id) => document.getElementById(id);
const state = { sb: null, user: null, profile: null, units: [], letters: [], dispositions: [], tasks: [], documents: [], notifications: [], profiles: [], histories: [], activeView: 'dashboard' };
const roleLabels = { super_admin: 'Super Admin', admin: 'Admin Deputi', pimpinan: 'Pimpinan', asdep: 'Asisten Deputi', pegawai: 'Pegawai' };
const statusLabels = { diterima: 'Teragenda', disposisi: 'Disposisi', proses: 'Dalam Proses', verifikasi: 'Verifikasi', selesai: 'Selesai' };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toast(message, isError = false) {
  const el = $('toast'); el.textContent = message; el.classList.remove('hidden');
  el.className = `fixed bottom-4 right-4 max-w-sm rounded-xl px-4 py-3 shadow-xl text-sm ${isError ? 'bg-red-700' : 'bg-slate-900'} text-white`;
  window.clearTimeout(toast.timer); toast.timer = window.setTimeout(() => el.classList.add('hidden'), 4000);
}
function showScreen(id) {
  ['config-warning', 'auth-screen', 'pending-screen', 'app-shell'].forEach(x => $(x).classList.toggle('hidden', x !== id));
  $('userbar').classList.toggle('hidden', id !== 'app-shell');
  $('userbar').classList.toggle('flex', id === 'app-shell');
}
function isAdmin() { return ['admin', 'super_admin'].includes(state.profile?.role); }
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
function formatDate(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID') : '—'; }
function badgeStatus(status) {
  const colors = { diterima: 'bg-slate-100 text-slate-700', disposisi: 'bg-amber-100 text-amber-800', proses: 'bg-blue-100 text-blue-800', verifikasi: 'bg-purple-100 text-purple-800', selesai: 'bg-emerald-100 text-emerald-800' };
  return `<span class="rounded-full px-2.5 py-1 text-[11px] font-bold ${colors[status] || 'bg-slate-100 text-slate-700'}">${esc(statusLabels[status] || status)}</span>`;
}
function unitName(id) { return state.units.find(u => u.id === id)?.name || '—'; }
function fillUnitSelect(selectId, includeBlank = false) {
  const el = $(selectId); if (!el) return;
  el.innerHTML = (includeBlank ? '<option value="">— Pilih —</option>' : '') + state.units.map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');
}
function fillLetterSelect(selectId, allowBlank = false) {
  const el = $(selectId); if (!el) return;
  el.innerHTML = (allowBlank ? '<option value="">Tidak terkait surat</option>' : '') + state.letters.map(l => `<option value="${esc(l.id)}">${esc(l.tracking_code)} · ${esc(l.subject.slice(0, 60))}</option>`).join('');
}

async function loadUnits() {
  const { data, error } = await state.sb.from('units').select('id,code,name').order('sort_order');
  if (error) throw error;
  state.units = data || [];
  fillUnitSelect('register-unit', true);
  fillUnitSelect('letter-target-unit', true);
  fillUnitSelect('disposition-unit', true);
}
function switchAuthTab(tab) {
  $('login-form').classList.toggle('hidden', tab !== 'login');
  $('register-form').classList.toggle('hidden', tab !== 'register');
  $('show-login').className = tab === 'login' ? 'btn btn-primary' : 'btn btn-muted';
  $('show-register').className = tab === 'register' ? 'btn btn-primary' : 'btn btn-muted';
}
async function handleLogin(event) {
  event.preventDefault(); const data = formObject(event.currentTarget);
  $('auth-message').textContent = 'Memeriksa akun…';
  const { error } = await state.sb.auth.signInWithPassword({ email: data.email, password: data.password });
  if (error) $('auth-message').textContent = error.message;
}
async function handleRegister(event) {
  event.preventDefault(); const data = formObject(event.currentTarget);
  $('auth-message').textContent = 'Mendaftarkan akun…';
  const { data: result, error } = await state.sb.auth.signUp({
    email: data.email, password: data.password,
    options: { data: { full_name: data.full_name, unit_id: data.unit_id } }
  });
  if (error) { $('auth-message').textContent = error.message; return; }
  $('auth-message').textContent = result.session
    ? 'Pendaftaran berhasil. Akun menunggu persetujuan admin.'
    : 'Pendaftaran diterima. Periksa email bila konfirmasi email diaktifkan; setelah itu akun menunggu persetujuan admin.';
}
async function handleLogout() { await state.sb.auth.signOut(); state.user = null; state.profile = null; showScreen('auth-screen'); }

async function loadProfileAndRoute(user) {
  state.user = user;
  const { data: profile, error } = await state.sb.from('profiles').select('id,email,full_name,unit_id,role,status').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (!profile || profile.status !== 'active') { state.profile = profile; showScreen('pending-screen'); return; }
  state.profile = profile;
  await loadApp();
}

async function loadApp() {
  $('user-name').textContent = state.profile.full_name || state.user.email;
  $('user-role').textContent = roleLabels[state.profile.role] || state.profile.role;
  $('unit-name').textContent = unitName(state.profile.unit_id);
  $('users-nav').classList.toggle('hidden', !isAdmin());
  showScreen('app-shell');
  await refreshAll();
}

async function refreshAll() {
  const jobs = await Promise.all([
    state.sb.from('letters').select('*').order('created_at', { ascending: false }),
    state.sb.from('dispositions').select('*').order('created_at', { ascending: false }),
    state.sb.from('tasks').select('*').order('created_at', { ascending: false }),
    state.sb.from('documents').select('*').order('created_at', { ascending: false }),
    state.sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
    state.sb.from('profiles').select('id,email,full_name,unit_id,role,status').order('created_at', { ascending: false }),
    state.sb.from('letter_history').select('*').order('created_at', { ascending: true })
  ]);
  for (const item of jobs) if (item.error) throw item.error;
  [state.letters, state.dispositions, state.tasks, state.documents, state.notifications, state.profiles, state.histories] = jobs.map(x => x.data || []);
  renderAll();
}
function renderAll() {
  renderDashboard(); renderLetters(); renderDispositions(); renderTasks(); renderDocuments(); renderNotifications(); renderReports();
  fillLetterSelect('disposition-letter'); fillLetterSelect('task-letter', true); fillLetterSelect('archive-letter');
  const assignee = $('task-assignee');
  const assignable = state.profiles.filter(p => p.status === 'active' && (p.unit_id === state.profile.unit_id || isAdmin()));
  assignee.innerHTML = assignable.map(p => `<option value="${esc(p.id)}">${esc(p.full_name || p.email)}</option>`).join('');
  $('notif-count').textContent = state.notifications.filter(n => !n.read_at).length;
  if (isAdmin()) renderUsers();
}
function renderKpi(label, value, icon, color = 'text-slate-800') {
  return `<div class="panel p-4"><div class="text-xs text-slate-500">${esc(label)}</div><div class="flex items-center justify-between mt-2"><strong class="text-2xl ${color}">${value}</strong><i class="fa-solid ${icon} text-slate-300 text-xl"></i></div></div>`;
}
function renderDashboard() {
  const total = state.letters.length, open = state.letters.filter(x => x.status !== 'selesai').length;
  const tasksOpen = state.tasks.filter(x => x.status !== 'selesai').length;
  const unread = state.notifications.filter(x => !x.read_at).length;
  $('kpi-grid').innerHTML = [renderKpi('Surat terlihat', total, 'fa-envelope'), renderKpi('Surat belum selesai', open, 'fa-clock', 'text-amber-600'), renderKpi('Tugas belum selesai', tasksOpen, 'fa-list-check', 'text-blue-700'), renderKpi('Notifikasi belum dibaca', unread, 'fa-bell', 'text-red-600')].join('');
  $('recent-letters').innerHTML = letterTable(state.letters.slice(0, 8), false);
}
function letterTable(rows, actions = true) {
  if (!rows.length) return '<p class="text-sm text-slate-400 py-5 text-center">Belum ada data yang dapat ditampilkan.</p>';
  return `<table class="w-full text-xs text-left"><thead class="bg-slate-50 text-slate-500"><tr><th class="p-3">Kode / Nomor</th><th class="p-3">Perihal</th><th class="p-3">Unit tujuan</th><th class="p-3">Status</th>${actions ? '<th class="p-3">Aksi</th>' : ''}</tr></thead><tbody>${rows.map(l => `<tr class="border-t"><td class="p-3"><strong>${esc(l.tracking_code)}</strong><div class="text-slate-500">${esc(l.letter_number)}</div></td><td class="p-3"><div class="font-semibold">${esc(l.subject)}</div><div class="text-slate-500">${esc(l.sender)}</div></td><td class="p-3">${esc(unitName(l.target_unit_id))}</td><td class="p-3">${badgeStatus(l.status)}</td>${actions ? `<td class="p-3"><button class="btn btn-muted" data-open-letter="${esc(l.id)}">Detail</button></td>` : ''}</tr>`).join('')}</tbody></table>`;
}
function renderLetters() {
  const query = ($('letter-search')?.value || '').toLowerCase().trim();
  const rows = state.letters.filter(l => [l.tracking_code,l.letter_number,l.subject,l.sender].some(v => String(v || '').toLowerCase().includes(query)));
  $('letters-table').innerHTML = letterTable(rows, true);
}
function renderDispositions() {
  if (!state.dispositions.length) { $('dispositions-table').innerHTML = '<p class="text-sm text-slate-400 py-4">Belum ada disposisi.</p>'; return; }
  $('dispositions-table').innerHTML = `<table class="w-full text-xs text-left"><thead class="bg-slate-50"><tr><th class="p-3">Instruksi</th><th class="p-3">Unit tujuan</th><th class="p-3">Tenggat</th><th class="p-3">Status / pembaruan</th></tr></thead><tbody>${state.dispositions.map(d => `<tr class="border-t"><td class="p-3">${esc(d.instruction)}</td><td class="p-3">${esc(unitName(d.to_unit_id))}</td><td class="p-3">${formatDate(d.due_date)}</td><td class="p-3"><select class="field min-w-28" data-disposition-status="${esc(d.id)}"><option value="dikirim" ${d.status==='dikirim'?'selected':''}>Dikirim</option><option value="diterima" ${d.status==='diterima'?'selected':''}>Diterima</option><option value="diproses" ${d.status==='diproses'?'selected':''}>Diproses</option><option value="selesai" ${d.status==='selesai'?'selected':''}>Selesai</option></select></td></tr>`).join('')}</tbody></table>`;
}
function renderTasks() {
  if (!state.tasks.length) { $('tasks-table').innerHTML = '<p class="text-sm text-slate-400 py-4">Belum ada tugas.</p>'; return; }
  $('tasks-table').innerHTML = `<table class="w-full text-xs text-left"><thead class="bg-slate-50"><tr><th class="p-3">Tugas</th><th class="p-3">PIC</th><th class="p-3">Tenggat</th><th class="p-3">Prioritas</th><th class="p-3">Status</th><th class="p-3">Aksi</th></tr></thead><tbody>${state.tasks.map(t => { const p = state.profiles.find(x => x.id === t.assigned_to); return `<tr class="border-t"><td class="p-3"><strong>${esc(t.title)}</strong><div class="text-slate-500">${esc(t.description || '')}</div></td><td class="p-3">${esc(p?.full_name || p?.email || 'Pengguna')}</td><td class="p-3">${formatDate(t.due_date)}</td><td class="p-3">${esc(t.priority)}</td><td class="p-3">${esc(t.status)}</td><td class="p-3"><select class="field min-w-28" data-task-status="${esc(t.id)}"><option value="belum_mulai" ${t.status==='belum_mulai'?'selected':''}>Belum mulai</option><option value="proses" ${t.status==='proses'?'selected':''}>Proses</option><option value="selesai" ${t.status==='selesai'?'selected':''}>Selesai</option></select></td></tr>`; }).join('')}</tbody></table>`;
}
function renderDocuments() {
  if (!state.documents.length) { $('documents-table').innerHTML = '<p class="text-sm text-slate-400 py-4">Belum ada dokumen.</p>'; return; }
  $('documents-table').innerHTML = `<table class="w-full text-xs text-left"><thead class="bg-slate-50"><tr><th class="p-3">Nama dokumen</th><th class="p-3">Ukuran</th><th class="p-3">Tanggal unggah</th><th class="p-3">Aksi</th></tr></thead><tbody>${state.documents.map(d => `<tr class="border-t"><td class="p-3">${esc(d.file_name)}</td><td class="p-3">${(d.size_bytes/1024).toFixed(1)} KB</td><td class="p-3">${new Date(d.created_at).toLocaleString('id-ID')}</td><td class="p-3"><button class="btn btn-muted" data-download-doc="${esc(d.id)}">Unduh</button></td></tr>`).join('')}</tbody></table>`;
}
function renderNotifications() {
  if (!state.notifications.length) { $('notifications-list').innerHTML = '<p class="text-sm text-slate-400 py-4">Tidak ada notifikasi.</p>'; return; }
  $('notifications-list').innerHTML = state.notifications.map(n => `<div class="border rounded-lg p-3 flex items-start justify-between gap-3 ${n.read_at ? 'bg-white' : 'bg-amber-50'}"><div><div class="font-bold text-sm">${esc(n.title)}</div><div class="text-sm text-slate-600">${esc(n.body)}</div><div class="text-[11px] text-slate-400 mt-1">${new Date(n.created_at).toLocaleString('id-ID')}</div></div>${n.read_at ? '' : `<button class="btn btn-muted shrink-0" data-read-notif="${esc(n.id)}">Tandai dibaca</button>`}</div>`).join('');
}
function renderReports() {
  const total = state.letters.length;
  const byStatus = ['diterima','disposisi','proses','verifikasi','selesai'].map(s => ({ status:s, count:state.letters.filter(l=>l.status===s).length }));
  $('report-summary').innerHTML = byStatus.map(x => `<div class="panel p-4"><div class="text-xs text-slate-500">${esc(statusLabels[x.status])}</div><div class="text-2xl font-extrabold mt-1">${x.count}</div></div>`).join('');
  const perUnit = state.units.map(u => ({ name:u.name, count:state.letters.filter(l=>l.origin_unit_id===u.id || l.target_unit_id===u.id).length })).filter(x=>x.count>0);
  $('unit-report').innerHTML = perUnit.length ? `<table class="w-full text-xs"><tbody>${perUnit.map(u=>`<tr class="border-t"><td class="p-3">${esc(u.name)}</td><td class="p-3 text-right font-bold">${u.count}</td></tr>`).join('')}</tbody></table>` : `<p class="text-sm text-slate-400">Belum ada data laporan. Total surat: ${total}.</p>`;
}
function renderUsers() {
  const pending = state.profiles.filter(p => p.status === 'pending');
  const active = state.profiles.filter(p => p.status === 'active');
  $('pending-users').innerHTML = pending.length ? `<table class="w-full text-xs"><tbody>${pending.map(p=>`<tr class="border-t"><td class="p-3"><strong>${esc(p.full_name)}</strong><div>${esc(p.email)}</div><div class="text-slate-500">${esc(unitName(p.unit_id))}</div></td><td class="p-3"><select class="field" data-approve-role="${esc(p.id)}"><option value="pegawai">Pegawai</option><option value="asdep">Asdep</option><option value="pimpinan">Pimpinan</option></select></td><td class="p-3"><button class="btn btn-primary" data-approve-user="${esc(p.id)}">Setujui</button> <button class="btn btn-danger" data-reject-user="${esc(p.id)}">Tolak</button></td></tr>`).join('')}</tbody></table>` : '<p class="text-sm text-slate-400">Tidak ada pendaftaran yang menunggu.</p>';
  $('active-users').innerHTML = active.length ? `<table class="w-full text-xs"><tbody>${active.map(p=>`<tr class="border-t"><td class="p-3"><strong>${esc(p.full_name)}</strong><div>${esc(p.email)}</div></td><td class="p-3">${esc(unitName(p.unit_id))}</td><td class="p-3">${esc(roleLabels[p.role] || p.role)}</td></tr>`).join('')}</tbody></table>` : '<p class="text-sm text-slate-400">Belum ada akun aktif.</p>';
}

async function createLetter(event) {
  event.preventDefault(); const form = event.currentTarget; const f = formObject(form);
  if (!f.target_unit_id) return toast('Pilih unit tujuan.', true);
  const tracking = `TRK-${new Date().toISOString().slice(0,7).replace('-','')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const payload = { tracking_code: tracking, direction:f.direction, letter_number:f.letter_number.trim(), letter_date:f.letter_date,
    sender:f.sender.trim(), recipient:f.recipient.trim(), confidentiality:f.confidentiality, classification:f.classification,
    subject:f.subject.trim(), initial_note:f.initial_note.trim() || null, origin_unit_id:state.profile.unit_id,
    target_unit_id:f.target_unit_id, created_by:state.user.id, status:'diterima' };
  const { error } = await state.sb.from('letters').insert(payload);
  if (error) throw error;
  form.reset(); await refreshAll(); toast(`Surat tersimpan. Kode tracking: ${tracking}`);
}
async function createDisposition(event) {
  event.preventDefault(); const form = event.currentTarget; const f = formObject(form);
  const { error } = await state.sb.from('dispositions').insert({ letter_id:f.letter_id, to_unit_id:f.to_unit_id, instruction:f.instruction.trim(), due_date:f.due_date || null, from_user_id:state.user.id, status:'dikirim' });
  if (error) throw error; form.reset(); await refreshAll(); toast('Disposisi berhasil dikirim. Notifikasi unit tujuan dibuat otomatis.');
}
async function createTask(event) {
  event.preventDefault(); const form = event.currentTarget; const f = formObject(form);
  const { error } = await state.sb.from('tasks').insert({ title:f.title.trim(), description:f.description.trim() || null, assigned_to:f.assigned_to, created_by:state.user.id, unit_id:state.profile.unit_id, due_date:f.due_date || null, priority:f.priority, letter_id:f.letter_id || null, status:'belum_mulai' });
  if (error) throw error; form.reset(); await refreshAll(); toast('Tugas berhasil dibuat. Penerima mendapat notifikasi.');
}
async function uploadDocument(event) {
  event.preventDefault(); const form = event.currentTarget; const f = formObject(form); const file = form.elements.file.files[0];
  if (!file) return toast('Pilih file terlebih dahulu.', true);
  if (file.size > 10 * 1024 * 1024) return toast('Ukuran file maksimum 10 MB untuk pengujian.', true);
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${f.letter_id}/${Date.now()}-${cleanName}`;
  const { error: uploadError } = await state.sb.storage.from('surat-arsip').upload(path, file, { upsert:false, contentType:file.type || 'application/octet-stream' });
  if (uploadError) throw uploadError;
  const { error } = await state.sb.from('documents').insert({ letter_id:f.letter_id, file_name:file.name, storage_path:path, mime_type:file.type || null, size_bytes:file.size, uploaded_by:state.user.id });
  if (error) { await state.sb.storage.from('surat-arsip').remove([path]); throw error; }
  form.reset(); await refreshAll(); toast('Dokumen berhasil diarsipkan.');
}
async function openLetter(id) {
  const l = state.letters.find(x => x.id === id); if (!l) return;
  $('tracking-result').classList.remove('hidden');
  $('tracking-result').innerHTML = `<div class="flex flex-wrap justify-between gap-3"><div><div class="text-xs text-slate-500">${esc(l.tracking_code)} · ${esc(l.letter_number)}</div><h2 class="text-lg font-extrabold mt-1">${esc(l.subject)}</h2><div class="text-sm text-slate-500 mt-1">${esc(l.sender)} → ${esc(l.recipient)}</div></div><div>${badgeStatus(l.status)}</div></div>
  <div class="grid md:grid-cols-3 gap-3 mt-4 text-sm"><div><span class="text-slate-500">Tanggal surat</span><div class="font-semibold">${formatDate(l.letter_date)}</div></div><div><span class="text-slate-500">Unit asal</span><div class="font-semibold">${esc(unitName(l.origin_unit_id))}</div></div><div><span class="text-slate-500">Unit tujuan</span><div class="font-semibold">${esc(unitName(l.target_unit_id))}</div></div><div><span class="text-slate-500">Sifat</span><div class="font-semibold">${esc(l.confidentiality)}</div></div><div><span class="text-slate-500">Klasifikasi</span><div class="font-semibold">${esc(l.classification)}</div></div></div>
  <div class="mt-5 border-t pt-4"><h3 class="font-bold text-sm mb-2">Riwayat perjalanan surat</h3><div class="space-y-2">${state.histories.filter(h=>h.letter_id===l.id).map(h=>`<div class="border-l-2 border-sky-500 pl-3 py-1"><div class="text-xs font-bold">${esc(h.title)} · ${esc(statusLabels[h.status] || h.status)}</div><div class="text-xs text-slate-500">${esc(h.note || '')} · ${new Date(h.created_at).toLocaleString('id-ID')}</div></div>`).join('') || '<div class="text-xs text-slate-400">Riwayat belum tersedia.</div>'}</div></div>
  <div class="mt-5 border-t pt-4"><label class="label">Perbarui status (sesuai izin)</label><div class="flex flex-wrap gap-2"><select id="detail-status" class="field max-w-xs">${Object.entries(statusLabels).map(([k,v])=>`<option value="${k}" ${l.status===k?'selected':''}>${v}</option>`).join('')}</select><button id="save-status" data-id="${esc(l.id)}" class="btn btn-primary">Simpan status</button></div><p class="text-xs text-slate-500 mt-2">Perubahan status dicatat otomatis pada riwayat surat.</p></div>
  ${isAdmin() ? `<div class="mt-5 border-t pt-4"><label class="label">Berikan akses khusus ke surat Rahasia</label><div class="flex flex-wrap gap-2"><select id="grant-user" class="field max-w-sm">${state.profiles.filter(p=>p.status==='active').map(p=>`<option value="${esc(p.id)}">${esc(p.full_name || p.email)} · ${esc(unitName(p.unit_id))}</option>`).join('')}</select><button id="grant-access" data-id="${esc(l.id)}" class="btn btn-dark">Berikan akses</button></div><p class="text-xs text-slate-500 mt-2">Akses ini diperlukan agar pengguna/unit lain dapat membuka surat Rahasia atau Sangat Rahasia.</p></div>` : ''}
  <div class="mt-4 flex justify-end"><button id="close-detail" class="btn btn-muted">Tutup</button></div>`;
  $('save-status').addEventListener('click', () => run((async () => {
    const status = $('detail-status').value;
    const { error } = await state.sb.from('letters').update({ status }).eq('id', l.id);
    if (error) throw error; await refreshAll(); toast('Status surat diperbarui.'); openLetter(l.id);
  })()));
  $('close-detail').addEventListener('click', () => $('tracking-result').classList.add('hidden'));
  if ($('grant-access')) $('grant-access').addEventListener('click', () => run((async () => { const userId = $('grant-user').value; const { error } = await state.sb.from('letter_access').upsert({ letter_id:l.id, user_id:userId, granted_by:state.user.id }, { onConflict:'letter_id,user_id' }); if (error) throw error; await refreshAll(); toast('Akses khusus berhasil diberikan.'); openLetter(l.id); })()));
}
async function trackingSearch() {
  const q = $('tracking-search').value.trim(); if (!q) return toast('Masukkan kode tracking atau nomor surat.', true);
  const found = state.letters.find(l => l.tracking_code.toLowerCase() === q.toLowerCase() || l.letter_number.toLowerCase().includes(q.toLowerCase()));
  if (!found) { $('tracking-result').classList.add('hidden'); return toast('Surat tidak ditemukan atau akun tidak memiliki akses.', true); }
  await openLetter(found.id);
}
async function updateTask(id, status) {
  const { error } = await state.sb.from('tasks').update({ status }).eq('id', id);
  if (error) throw error; await refreshAll(); toast('Status tugas diperbarui.');
}
async function updateDisposition(id, status) {
  const { error } = await state.sb.from('dispositions').update({ status }).eq('id', id);
  if (error) throw error; await refreshAll(); toast('Status disposisi diperbarui.');
}
async function downloadDocument(id) {
  const doc = state.documents.find(d => d.id === id); if (!doc) return;
  const { data, error } = await state.sb.storage.from('surat-arsip').createSignedUrl(doc.storage_path, 60);
  if (error) throw error; window.open(data.signedUrl, '_blank', 'noopener');
}
async function markNotification(id) {
  const { error } = await state.sb.from('notifications').update({ read_at:new Date().toISOString() }).eq('id', id);
  if (error) throw error; await refreshAll();
}
async function approveUser(id, status) {
  const role = status === 'active' ? document.querySelector(`[data-approve-role="${CSS.escape(id)}"]`)?.value || 'pegawai' : 'pegawai';
  const { error } = await state.sb.from('profiles').update({ status, role }).eq('id', id);
  if (error) throw error; await refreshAll(); toast(status === 'active' ? 'Akun disetujui.' : 'Pendaftaran ditolak.');
}
function exportCsv() {
  const cols = ['tracking_code','direction','letter_number','letter_date','sender','recipient','subject','confidentiality','status'];
  const csv = [cols.join(','), ...state.letters.map(row => cols.map(k => `"${String(row[k] ?? '').replace(/"/g,'""')}"`).join(','))].join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type:'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'register-esurat-test.csv'; a.click(); URL.revokeObjectURL(url);
}
function setView(view) {
  if (view === 'users' && !isAdmin()) return toast('Menu hanya tersedia untuk admin.', true);
  state.activeView = view;
  document.querySelectorAll('.app-view').forEach(x => x.classList.add('hidden'));
  $(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(x => x.classList.toggle('nav-active', x.dataset.view === view));
  if (view === 'letters') renderLetters();
}

function bindEvents() {
  $('show-login').addEventListener('click', () => switchAuthTab('login'));
  $('show-register').addEventListener('click', () => switchAuthTab('register'));
  $('login-form').addEventListener('submit', e => run(handleLogin(e)));
  $('register-form').addEventListener('submit', e => run(handleRegister(e)));
  ['logout-btn','pending-logout'].forEach(id => $(id).addEventListener('click', () => run(handleLogout())));
  $('letter-form').addEventListener('submit', e => run(createLetter(e)));
  $('disposition-form').addEventListener('submit', e => run(createDisposition(e)));
  $('task-form').addEventListener('submit', e => run(createTask(e)));
  $('upload-form').addEventListener('submit', e => run(uploadDocument(e)));
  $('tracking-search-btn').addEventListener('click', () => run(trackingSearch()));
  $('tracking-search').addEventListener('keydown', e => { if (e.key === 'Enter') run(trackingSearch()); });
  $('letter-search').addEventListener('input', renderLetters);
  $('refresh-btn').addEventListener('click', () => run(refreshAll()));
  $('export-csv').addEventListener('click', exportCsv);
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  document.addEventListener('click', e => {
    const letter = e.target.closest('[data-open-letter]'); if (letter) { setView('tracking'); $('tracking-result').classList.remove('hidden'); run(openLetter(letter.dataset.openLetter)); }
    const notif = e.target.closest('[data-read-notif]'); if (notif) run(markNotification(notif.dataset.readNotif));
    const doc = e.target.closest('[data-download-doc]'); if (doc) run(downloadDocument(doc.dataset.downloadDoc));
    const approve = e.target.closest('[data-approve-user]'); if (approve) run(approveUser(approve.dataset.approveUser, 'active'));
    const reject = e.target.closest('[data-reject-user]'); if (reject) run(approveUser(reject.dataset.rejectUser, 'rejected'));
  });
  document.addEventListener('change', e => {
    const task = e.target.closest('[data-task-status]'); if (task) run(updateTask(task.dataset.taskStatus, task.value));
    const disposition = e.target.closest('[data-disposition-status]'); if (disposition) run(updateDisposition(disposition.dataset.dispositionStatus, disposition.value));
  });
}
async function run(promise) {
  try { await promise; } catch (error) { console.error(error); toast(error?.message || 'Terjadi kesalahan. Periksa konfigurasi dan hak akses.', true); }
}

async function boot() {
  bindEvents();
  if (!configReady) { showScreen('config-warning'); return; }
  state.sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
  try {
    await loadUnits();
    const { data: { session } } = await state.sb.auth.getSession();
    if (session) await loadProfileAndRoute(session.user); else { showScreen('auth-screen'); switchAuthTab('login'); }
    state.sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) window.setTimeout(() => run(loadProfileAndRoute(session.user)), 0);
      else { state.user = null; state.profile = null; showScreen('auth-screen'); }
    });
  } catch (error) { console.error(error); showScreen('auth-screen'); $('auth-message').textContent = `Gagal menghubungkan Supabase: ${error.message}`; }
}
boot();
