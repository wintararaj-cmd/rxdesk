// lib/screens/doctor/doctor_home.dart

import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../login_screen.dart';
import 'doctor_prescribe_screen.dart';
import 'doctor_profile_details.dart';
import 'doctor_prescription_detail.dart';

class DoctorHome extends StatefulWidget {
  const DoctorHome({super.key});
  @override
  State<DoctorHome> createState() => _DoctorHomeState();
}

class _DoctorHomeState extends State<DoctorHome> {
  int _tab = 0;
  String _name = 'Doctor';

  @override
  void initState() { super.initState(); _loadName(); }
  Future<void> _loadName() async {
    final name = await AuthService.getName();
    if (mounted) setState(() => _name = name ?? 'Doctor');
  }

  Future<void> _logout() async {
    await ApiService.logout();
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> pages = [
      const DoctorAppointmentsTab(),
      const DoctorHistoryTab(),
      DoctorPrescribeScreen(),
      const DoctorProfileTab(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          Image.asset('assets/images/logo.png', height: 32),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('RxDesk', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF7C3AED))),
            Text('Dr. $_name', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Color(0xFF1F2937))),
          ]),
        ]),
        actions: [
          IconButton(icon: const Icon(Icons.logout_rounded, size: 20, color: Color(0xFF6B7280)), onPressed: _logout),
        ],
      ),
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        indicatorColor: const Color(0xFFEDE9FE),
        backgroundColor: Colors.white,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.assignment_outlined), selectedIcon: Icon(Icons.assignment), label: 'Today'),
          NavigationDestination(icon: Icon(Icons.history), selectedIcon: Icon(Icons.history), label: 'History'),
          NavigationDestination(icon: Icon(Icons.medication_outlined), selectedIcon: Icon(Icons.medication), label: 'Prescribe'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

// ── Tab 1: Today Queue ──────────────────────────────────────────────────────
class DoctorAppointmentsTab extends StatefulWidget {
  const DoctorAppointmentsTab({super.key});
  @override
  State<DoctorAppointmentsTab> createState() => _DoctorAppointmentsTabState();
}

class _DoctorAppointmentsTabState extends State<DoctorAppointmentsTab> {
  List<dynamic> _appts = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final appts = await ApiService.getDoctorAppointments();
      if (mounted) setState(() { _appts = appts; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    final waiting = _appts.where((a) => ['booked','confirmed','arrived'].contains(a['status'])).length;
    final inProg  = _appts.where((a) => a['status'] == 'in_consultation').length;
    final done    = _appts.where((a) => a['status'] == 'completed').length;

    return RefreshIndicator(
      onRefresh: _load,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(16), children: [
              Row(children: [
                _StatCard('Waiting', waiting, Icons.access_time, const Color(0xFFD97706), const Color(0xFFFEF3C7)),
                const SizedBox(width: 10),
                _StatCard('Active', inProg, Icons.medical_services, const Color(0xFF2563EB), const Color(0xFFDBEAFE)),
                const SizedBox(width: 10),
                _StatCard('Done', done, Icons.check_circle_outline, const Color(0xFF059669), const Color(0xFFD1FAE5)),
              ]),
              const SizedBox(height: 24),
              const Text("Today's Queue", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              if (_appts.isEmpty)
                const Center(child: Padding(padding: EdgeInsets.all(40), child: Text('No appointments today')))
              else
                ..._appts.map((a) => _DoctorApptCard(a, onUpdate: _load)),
            ]),
    );
  }
}

// ── Tab 2: History ──────────────────────────────────────────────────────────
class DoctorHistoryTab extends StatefulWidget {
  const DoctorHistoryTab({super.key});
  @override
  State<DoctorHistoryTab> createState() => _DoctorHistoryTabState();
}

class _DoctorHistoryTabState extends State<DoctorHistoryTab> {
  List<dynamic> _records = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiService.getDoctorIssuedPrescriptions();
      if (mounted) setState(() { _records = res; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _records.length,
              itemBuilder: (_, i) {
                final r = _records[i];
                final patient = r['patient'] as Map? ?? {};
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  child: ListTile(
                    leading: CircleAvatar(backgroundColor: Colors.deepPurple[50], child: const Icon(Icons.person, color: Colors.deepPurple, size: 20)),
                    title: Text(patient['full_name'] ?? 'Patient', style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('Diagnosis: ${r['diagnosis'] ?? 'Visit Result'}'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () async {
                      final refresh = await Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => DoctorPrescriptionDetail(prescription: r)),
                      );
                      if (refresh == true) _load();
                    },
                  ),
                );
              },
            ),
    );
  }
}

// ── Tab 3: Profile ───────────────────────────────────────────────────────────
class DoctorProfileTab extends StatelessWidget {
  const DoctorProfileTab({super.key});
  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(24), children: [
      const CircleAvatar(radius: 50, backgroundColor: Color(0xFFEDE9FE), child: Icon(Icons.medical_services_outlined, size: 50, color: Color(0xFF7C3AED))),
      const SizedBox(height: 20),
      const Text('Practice Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      const SizedBox(height: 12),
       ListTile(leading: const Icon(Icons.person_outline), title: const Text('Profile Details'), trailing: const Icon(Icons.chevron_right), onTap: () {
         Navigator.of(context).push(MaterialPageRoute(builder: (_) => const DoctorProfileDetails()));
       }),
       ListTile(leading: const Icon(Icons.account_balance_outlined), title: const Text('Linked Chambers'), trailing: const Icon(Icons.chevron_right), onTap: () {
         // TODO: Implement linked chambers screen
         ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Linked Chambers coming soon')));
       }),
       ListTile(leading: const Icon(Icons.schedule_outlined), title: const Text('Work Schedule'), trailing: const Icon(Icons.chevron_right), onTap: () {
         // TODO: Implement work schedule screen
         ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Work Schedule coming soon')));
       }),
       const Divider(),
       ListTile(leading: const Icon(Icons.security), title: const Text('Security & Privacy'), trailing: const Icon(Icons.chevron_right), onTap: () {
         // TODO: Implement security & privacy screen
         ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Security & Privacy coming soon')));
       }),
    ]);
  }
}

// ── Utilities ───────────────────────────────────────────────────────────────
class _StatCard extends StatelessWidget {
  final String label; final int value; final IconData icon; final Color color, bg;
  const _StatCard(this.label, this.value, this.icon, this.color, this.bg);
  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Column(children: [
        Icon(icon, color: color, size: 18), const SizedBox(height: 4),
        Text('$value', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: color)),
        Text(label, style: const TextStyle(fontSize: 10, color: Colors.black54)),
      ]),
    ),
  );
}

class _DoctorApptCard extends StatelessWidget {
  final dynamic appt; final VoidCallback onUpdate;
  const _DoctorApptCard(this.appt, {required this.onUpdate});

  @override
  Widget build(BuildContext context) {
    final patient = appt['patient'] as Map? ?? {};
    final status  = appt['status'] ?? '';
    final statusColor = { 'booked': const Color(0xFFD97706), 'in_consultation': const Color(0xFF2563EB), 'completed': const Color(0xFF059669) }[status] ?? const Color(0xFF9CA3AF);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFE5E7EB))),
      child: ListTile(
        contentPadding: const EdgeInsets.all(12),
        leading: Container(width: 44, height: 44, decoration: BoxDecoration(color: const Color(0xFFEDE9FE), borderRadius: BorderRadius.circular(12)),
          alignment: Alignment.center, child: Text('#${appt['token_number'] ?? '?'}', style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF7C3AED)))),
        title: Text(patient['full_name'] ?? 'Patient', style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text('Age: ${patient['age'] ?? 'N/A'} | Status: $status'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Starting consultation...')));
        },
      ),
    );
  }
}
