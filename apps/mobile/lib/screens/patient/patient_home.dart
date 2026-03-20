// lib/screens/patient/patient_home.dart

import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../login_screen.dart';

class PatientHome extends StatefulWidget {
  const PatientHome({super.key});
  @override
  State<PatientHome> createState() => _PatientHomeState();
}

class _PatientHomeState extends State<PatientHome> {
  int _tab = 0;
  String _name = 'Patient';

  @override
  void initState() {
    super.initState();
    _loadName();
  }

  Future<void> _loadName() async {
    final name = await AuthService.getName();
    if (mounted) setState(() => _name = name ?? 'Patient');
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
    final pages = [
      const PatientDashboardTab(),
      const PatientExploreTab(),
      const PatientRecordsTab(),
      const PatientProfileTab(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          Image.asset('assets/images/logo.png', height: 32),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('RxDesk', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF7C3AED))),
            Text('Hi, $_name 👋', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Color(0xFF1F2937))),
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
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.search), selectedIcon: Icon(Icons.search), label: 'Explore'),
          NavigationDestination(icon: Icon(Icons.assignment_outlined), selectedIcon: Icon(Icons.assignment), label: 'Records'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

// ── Tab 1: Dashboard ────────────────────────────────────────────────────────
class PatientDashboardTab extends StatefulWidget {
  const PatientDashboardTab({super.key});
  @override
  State<PatientDashboardTab> createState() => _PatientDashboardTabState();
}

class _PatientDashboardTabState extends State<PatientDashboardTab> {
  List<dynamic> _appts = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final appts = await ApiService.getPatientAppointments();
      if (mounted) setState(() { _appts = appts; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    final upcoming = _appts.where((a) => ['booked','confirmed','arrived'].contains(a['status'])).toList();
    final past     = _appts.where((a) => ['completed','cancelled','no_show'].contains(a['status'])).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(16), children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF7C3AED), Color(0xFF4F46E5)]),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(children: [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Your Appointments', style: TextStyle(color: Colors.white70, fontSize: 13)),
                    const SizedBox(height: 4),
                    Text('${upcoming.length} upcoming', style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 4),
                    Text('${past.length} past visits', style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13)),
                  ]),
                  const Spacer(),
                  const Icon(Icons.calendar_month_rounded, color: Colors.white30, size: 60),
                ]),
              ),
              const SizedBox(height: 24),
              if (upcoming.isNotEmpty) ...[
                const Text('Upcoming', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                ...upcoming.map((a) => _PatientApptCard(a)),
                const SizedBox(height: 20),
              ],
              if (past.isNotEmpty) ...[
                const Text('Past Visits', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF6B7280))),
                const SizedBox(height: 12),
                ...past.map((a) => _PatientApptCard(a)),
              ],
              if (_appts.isEmpty)
                const Center(child: Padding(padding: EdgeInsets.all(40), child: Text('No appointments yet'))),
            ]),
    );
  }
}

// ── Tab 2: Explore ──────────────────────────────────────────────────────────
class PatientExploreTab extends StatefulWidget {
  const PatientExploreTab({super.key});
  @override
  State<PatientExploreTab> createState() => _PatientExploreTabState();
}

class _PatientExploreTabState extends State<PatientExploreTab> {
  List<dynamic> _doctors = [];
  bool _loading = false;
  final _searchCtrl = TextEditingController();

  Future<void> _search(String q) async {
    if (q.length < 2) return;
    setState(() => _loading = true);
    try {
      final res = await ApiService.searchDoctors(q: q);
      if (mounted) setState(() { _doctors = res['data'] ?? []; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(16),
        child: TextField(
          controller: _searchCtrl,
          decoration: InputDecoration(
            hintText: 'Search doctors or specializations...',
            prefixIcon: const Icon(Icons.search),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            filled: true, fillColor: Colors.grey[100],
          ),
          onSubmitted: _search,
        ),
      ),
      Expanded(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: _doctors.length,
                itemBuilder: (_, i) {
                  final d = _doctors[i];
                  return Card(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      leading: CircleAvatar(backgroundColor: Colors.deepPurple[50], child: const Icon(Icons.person, color: Colors.deepPurple)),
                      title: Text('Dr. ${d['full_name']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text(d['specialization'] ?? 'Doctor'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please visit clinic to book appointment')));
                      },
                    ),
                  );
                },
              ),
      ),
    ]);
  }
}

// ── Tab 3: Records ──────────────────────────────────────────────────────────
class PatientRecordsTab extends StatefulWidget {
  const PatientRecordsTab({super.key});
  @override
  State<PatientRecordsTab> createState() => _PatientRecordsTabState();
}

class _PatientRecordsTabState extends State<PatientRecordsTab> {
  List<dynamic> _records = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiService.getPatientPrescriptions();
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
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  child: ListTile(
                    leading: const Icon(Icons.description_outlined, color: Colors.blue),
                    title: Text('Diagnosis: ${r['diagnosis'] ?? 'Visit Result'}'),
                    subtitle: Text('Issued on: ${r['created_at']?.toString().substring(0, 10)}'),
                    trailing: const Icon(Icons.download, size: 20),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Downloading PDF...')));
                    },
                  ),
                );
              },
            ),
    );
  }
}

// ── Tab 4: Profile ───────────────────────────────────────────────────────────
class PatientProfileTab extends StatelessWidget {
  const PatientProfileTab({super.key});
  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(24), children: [
      const CircleAvatar(radius: 50, backgroundColor: Color(0xFFEDE9FE), child: Icon(Icons.person, size: 50, color: Color(0xFF7C3AED))),
      const SizedBox(height: 20),
      const Text('Account Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      const SizedBox(height: 12),
      ListTile(leading: const Icon(Icons.person_outline), title: const Text('Personal Info'), trailing: const Icon(Icons.chevron_right), onTap: () {}),
      ListTile(leading: const Icon(Icons.history), title: const Text('Medical History'), trailing: const Icon(Icons.chevron_right), onTap: () {}),
      ListTile(leading: const Icon(Icons.security), title: const Text('Change Password'), trailing: const Icon(Icons.chevron_right), onTap: () {}),
      const Divider(),
      ListTile(leading: const Icon(Icons.help_outline), title: const Text('Support'), trailing: const Icon(Icons.chevron_right), onTap: () {}),
    ]);
  }
}

// ── Utilities ───────────────────────────────────────────────────────────────
class _PatientApptCard extends StatelessWidget {
  final dynamic appt;
  const _PatientApptCard(this.appt);
  @override
  Widget build(BuildContext context) {
    final status = appt['status'] ?? '';
    final doctor = ((appt['chamber'] ?? {})['doctor'] ?? {});
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ListTile(
         leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: Colors.deepPurple[50], borderRadius: BorderRadius.circular(10)),
           child: const Icon(Icons.calendar_today, color: Colors.deepPurple, size: 18)),
         title: Text('Dr. ${doctor['full_name'] ?? 'Doctor'}', style: const TextStyle(fontWeight: FontWeight.bold)),
         subtitle: Text('${appt['appointment_date']?.toString().substring(0, 10)} at ${appt['slot_start_time'] ?? ''}'),
         trailing: Text(status.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey)),
      ),
    );
  }
}
