// lib/screens/patient/patient_home.dart

import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../login_screen.dart';
import 'patient_profile_details.dart';

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
                ...upcoming.map((a) => _PatientApptCard(a, onCancel: _load)),
                const SizedBox(height: 20),
              ],
              if (past.isNotEmpty) ...[
                const Text('Past Visits', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF6B7280))),
                const SizedBox(height: 12),
                ...past.map((a) => _PatientApptCard(a, onCancel: _load)),
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
          : _records.isEmpty
              ? const Center(child: Padding(padding: EdgeInsets.all(40), child: Text('No prescriptions yet')))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _records.length,
                  itemBuilder: (_, i) {
                    final r = _records[i];
                    final medicines = r['medicines'] as List<dynamic>? ?? [];
                    final doctor = r['doctor'] as Map<String, dynamic>? ?? {};
                    final chamber = r['chamber'] as Map<String, dynamic>? ?? {};
                    
                    return Card(
                      margin: const EdgeInsets.only(bottom: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 2,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () => _showPrescriptionDetail(context, r),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF7C3AED).withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Icon(Icons.description_outlined, color: Color(0xFF7C3AED), size: 24),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          r['diagnosis'] ?? 'Visit Result',
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1F2937)),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          'Dr. ${doctor['full_name'] ?? 'Unknown'} • ${chamber['name'] ?? 'Clinic'}',
                                          style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        r['created_at']?.toString().substring(0, 10) ?? '',
                                        style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
                                      ),
                                      const SizedBox(height: 4),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: Colors.green.withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          '${medicines.length} medicine${medicines.length != 1 ? 's' : ''}',
                                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.green),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              const Divider(height: 1),
                              const SizedBox(height: 12),
                              if (medicines.isNotEmpty) ...[
                                const Text('Medicines', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                                const SizedBox(height: 8),
                                ...medicines.take(3).map((m) => Padding(
                                  padding: const EdgeInsets.only(bottom: 6),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.medication, size: 16, color: Color(0xFF7C3AED)),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          '${m['medicine_name'] ?? 'Medicine'}',
                                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                                        ),
                                      ),
                                    ],
                                  ),
                                )),
                                if (medicines.length > 3)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(
                                      '+${medicines.length - 3} more medicines',
                                      style: const TextStyle(fontSize: 12, color: Color(0xFF7C3AED), fontWeight: FontWeight.w500),
                                    ),
                                  ),
                              ],
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF7C3AED).withOpacity(0.05),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.visibility_outlined, size: 18, color: Color(0xFF7C3AED)),
                                    SizedBox(width: 8),
                                    Text('View Full Prescription', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF7C3AED))),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
    );
  }

  void _showPrescriptionDetail(BuildContext context, Map<String, dynamic> prescription) {
    final medicines = prescription['medicines'] as List<dynamic>? ?? [];
    final doctor = prescription['doctor'] as Map<String, dynamic>? ?? {};
    final chamber = prescription['chamber'] as Map<String, dynamic>? ?? {};

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (context, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40, height: 4,
                decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF7C3AED).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.description, color: Color(0xFF7C3AED), size: 28),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Prescription', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF1F2937))),
                          const SizedBox(height: 4),
                          Text(prescription['created_at']?.toString().substring(0, 10) ?? '', style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280))),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(20),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const CircleAvatar(
                            backgroundColor: Color(0xFF7C3AED),
                            child: Icon(Icons.person, color: Colors.white),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Dr. ${doctor['full_name'] ?? 'Unknown'}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                const SizedBox(height: 2),
                                Text(chamber['name'] ?? 'Clinic', style: const TextStyle(color: Color(0xFF6B7280), fontSize: 14)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text('Diagnosis', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                    const SizedBox(height: 8),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEEF2FF),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF7C3AED).withOpacity(0.2)),
                      ),
                      child: Text(
                        prescription['diagnosis'] ?? 'No diagnosis recorded',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Color(0xFF1F2937)),
                      ),
                    ),
                    const SizedBox(height: 24),
                    if (prescription['symptoms'] != null && prescription['symptoms'].toString().isNotEmpty) ...[
                      const Text('Symptoms', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                      const SizedBox(height: 8),
                      Text(prescription['symptoms'].toString(), style: const TextStyle(fontSize: 15)),
                      const SizedBox(height: 20),
                    ],
                    Row(
                      children: [
                        const Text('Medicines', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1F2937))),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(color: const Color(0xFF7C3AED), borderRadius: BorderRadius.circular(10)),
                          child: Text('${medicines.length}', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ...medicines.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final m = entry.value as Map<String, dynamic>;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 28, height: 28,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF7C3AED).withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Center(child: Text('${idx + 1}', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF7C3AED), fontSize: 12))),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    m['medicine_name'] ?? 'Medicine',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                _MedicineInfoChip(icon: Icons.speed, label: 'Dosage', value: m['dosage'] ?? '-'),
                                const SizedBox(width: 8),
                                _MedicineInfoChip(icon: Icons.repeat, label: 'Frequency', value: m['frequency'] ?? '-'),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                _MedicineInfoChip(icon: Icons.calendar_today, label: 'Duration', value: m['duration'] ?? '-'),
                                const SizedBox(width: 8),
                                _MedicineInfoChip(icon: Icons.info_outline, label: 'Instructions', value: m['instructions'] ?? '-', flex: 2),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 20),
                    if (prescription['notes'] != null && prescription['notes'].toString().isNotEmpty) ...[
                      const Text('Doctor\'s Notes', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                      const SizedBox(height: 8),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.orange.withOpacity(0.3)),
                        ),
                        child: Text(
                          prescription['notes'].toString(),
                          style: const TextStyle(fontSize: 14, color: Color(0xFF92400E)),
                        ),
                      ),
                    ],
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MedicineInfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final int flex;
  const _MedicineInfoChip({required this.icon, required this.label, required this.value, this.flex = 1});
  @override
  Widget build(BuildContext context) {
    return Expanded(
      flex: flex,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(icon, size: 14, color: const Color(0xFF6B7280)),
            const SizedBox(width: 6),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF))),
                  Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1F2937)), overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PatientProfileTab extends StatelessWidget {
  const PatientProfileTab({super.key});
  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(24), children: [
      const CircleAvatar(radius: 50, backgroundColor: Color(0xFFEDE9FE), child: Icon(Icons.person, size: 50, color: Color(0xFF7C3AED))),
      const SizedBox(height: 20),
      const Text('Account Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      const SizedBox(height: 12),
      ListTile(leading: const Icon(Icons.person_outline), title: const Text('Personal Info'), trailing: const Icon(Icons.chevron_right), onTap: () {
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PatientProfileDetails()));
      }),
      ListTile(leading: const Icon(Icons.history), title: const Text('Medical History'), trailing: const Icon(Icons.chevron_right), onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Medical History coming soon')));
      }),
      ListTile(leading: const Icon(Icons.security), title: const Text('Change Password'), trailing: const Icon(Icons.chevron_right), onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password change coming soon')));
      }),
      const Divider(),
      ListTile(leading: const Icon(Icons.help_outline), title: const Text('Support'), trailing: const Icon(Icons.chevron_right), onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Contact support at support@rxdesk.in')));
      }),
    ]);
  }
}
class _PatientApptCard extends StatelessWidget {
  final dynamic appt;
  final VoidCallback? onCancel;
  const _PatientApptCard(this.appt, {this.onCancel});

  @override
  Widget build(BuildContext context) {
    final status = appt['status'] ?? '';
    final doctor = ((appt['chamber'] ?? {})['doctor'] ?? {});
    final isUpcoming = ['booked','confirmed','arrived'].contains(status);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ListTile(
         leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: Colors.deepPurple[50], borderRadius: BorderRadius.circular(10)),
           child: const Icon(Icons.calendar_today, color: Colors.deepPurple, size: 18)),
         title: Text('Dr. ${doctor['full_name'] ?? 'Doctor'}', style: const TextStyle(fontWeight: FontWeight.bold)),
         subtitle: Text('${appt['appointment_date']?.toString().substring(0, 10)} at ${appt['slot_start_time'] ?? ''}'),
         trailing: Row(
           mainAxisSize: MainAxisSize.min,
           children: [
             Text(status.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey)),
             if (isUpcoming) ...[
               const SizedBox(width: 8),
               PopupMenuButton(
                 icon: const Icon(Icons.more_vert, size: 18),
                 itemBuilder: (ctx) => [
                   const PopupMenuItem(value: 'cancel', child: Text('Cancel Appointment', style: TextStyle(color: Colors.red))),
                 ],
                 onSelected: (val) {
                   if (val == 'cancel') _confirmCancel(context);
                 },
               )
             ]
           ],
         ),
      ),
    );
  }

  void _confirmCancel(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Appointment?'),
        content: const Text('Are you sure you want to cancel this appointment?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('No')),
          TextButton(
            onPressed: () async {
              try {
                await ApiService.cancelAppointment(appt['id']);
                if (context.mounted) {
                   Navigator.pop(ctx);
                   onCancel?.call();
                }
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
              }
            },
            child: const Text('Yes, Cancel', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
