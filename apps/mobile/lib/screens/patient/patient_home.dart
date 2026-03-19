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
  List<dynamic> _appts = [];
  bool _loading = true;
  String _name = 'Patient';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final name = await AuthService.getName();
      final appts = await ApiService.getPatientAppointments();
      if (mounted) setState(() {
        _name = name ?? 'Patient';
        _appts = appts;
        _loading = false;
      });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _logout() async {
    await ApiService.logout();
    if (mounted) Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final upcoming = _appts.where((a) => ['booked','confirmed','arrived'].contains(a['status'])).toList();
    final past     = _appts.where((a) => ['completed','cancelled','no_show'].contains(a['status'])).toList();

    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('RxDesk', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: Color(0xFF7C3AED))),
          Text('Hi, $_name 👋', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Color(0xFF1F2937))),
        ]),
        actions: [
          IconButton(icon: const Icon(Icons.logout_rounded, size: 20, color: Color(0xFF6B7280)), onPressed: _logout),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(padding: const EdgeInsets.all(16), children: [

                // Hero card
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF7C3AED), Color(0xFF4F46E5)],
                      begin: Alignment.topLeft, end: Alignment.bottomRight,
                    ),
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

                const SizedBox(height: 20),

                if (upcoming.isNotEmpty) ...[
                  const Text('Upcoming', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 10),
                  ...upcoming.map((a) => _PatientApptCard(a)),
                  const SizedBox(height: 20),
                ],

                if (past.isNotEmpty) ...[
                  const Text('Past Visits', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF6B7280))),
                  const SizedBox(height: 10),
                  ...past.map((a) => _PatientApptCard(a)),
                ],

                if (_appts.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.all(40),
                      child: Column(children: const [
                        Icon(Icons.calendar_today_outlined, size: 48, color: Color(0xFFE5E7EB)),
                        SizedBox(height: 12),
                        Text('No appointments yet', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 15)),
                        SizedBox(height: 4),
                        Text('Visit a clinic to book your first appointment', style: TextStyle(color: Color(0xFFD1D5DB), fontSize: 12), textAlign: TextAlign.center),
                      ]),
                    ),
                  ),
              ]),
      ),
    );
  }
}

class _PatientApptCard extends StatelessWidget {
  final dynamic appt;
  const _PatientApptCard(this.appt);

  @override
  Widget build(BuildContext context) {
    final chamber = (appt['chamber'] as Map?) ?? {};
    final doctor  = (chamber['doctor'] as Map?) ?? {};
    final shop    = (chamber['medical_shop'] as Map?) ?? {};
    final status  = appt['status'] ?? '';
    final date    = appt['appointment_date']?.toString().substring(0, 10) ?? '';
    final time    = appt['slot_start_time'] ?? '';

    final statusColor = {
      'booked': const Color(0xFFD97706),
      'confirmed': const Color(0xFF2563EB),
      'arrived': const Color(0xFFEA580C),
      'in_consultation': const Color(0xFF2563EB),
      'completed': const Color(0xFF059669),
      'cancelled': const Color(0xFFDC2626),
      'no_show': const Color(0xFF9CA3AF),
    }[status] ?? const Color(0xFF6B7280);

    final statusLabel = {
      'booked': 'Booked', 'confirmed': 'Confirmed',
      'arrived': 'Arrived', 'in_consultation': 'In Progress',
      'completed': 'Completed', 'cancelled': 'Cancelled', 'no_show': 'No Show',
    }[status] ?? status;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: statusColor.withOpacity(0.2)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 42, height: 42,
              decoration: BoxDecoration(
                color: statusColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: Text('#${appt['token_number'] ?? '?'}',
                style: TextStyle(fontWeight: FontWeight.w900, color: statusColor, fontSize: 13)),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (doctor['full_name'] != null)
                Text('Dr. ${doctor['full_name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              if (doctor['specialization'] != null)
                Text('${doctor['specialization']}', style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
            ])),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
              child: Text(statusLabel, style: TextStyle(color: statusColor, fontWeight: FontWeight.w700, fontSize: 11)),
            ),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            const Icon(Icons.calendar_today_outlined, size: 12, color: Color(0xFF9CA3AF)),
            const SizedBox(width: 4),
            Text(date, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
            if (time.isNotEmpty) ...[
              const SizedBox(width: 10),
              const Icon(Icons.access_time, size: 12, color: Color(0xFF9CA3AF)),
              const SizedBox(width: 4),
              Text(time, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
            ],
            if (shop['shop_name'] != null) ...[
              const SizedBox(width: 10),
              const Icon(Icons.store_outlined, size: 12, color: Color(0xFF9CA3AF)),
              const SizedBox(width: 4),
              Expanded(child: Text('${shop['shop_name']}', style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12), overflow: TextOverflow.ellipsis)),
            ],
          ]),
          if (appt['chief_complaint'] != null) ...[
            const SizedBox(height: 6),
            Text(appt['chief_complaint'], style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12, fontStyle: FontStyle.italic)),
          ],
        ]),
      ),
    );
  }
}
