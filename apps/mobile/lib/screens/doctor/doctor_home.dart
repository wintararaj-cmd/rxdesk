// lib/screens/doctor/doctor_home.dart

import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/auth_service.dart';
import '../login_screen.dart';

class DoctorHome extends StatefulWidget {
  const DoctorHome({super.key});
  @override
  State<DoctorHome> createState() => _DoctorHomeState();
}

class _DoctorHomeState extends State<DoctorHome> {
  List<dynamic> _appts = [];
  Map<String, dynamic>? _profile;
  bool _loading = true;
  String _name = 'Doctor';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService.getDoctorProfile().catchError((_) => <String, dynamic>{}),
        ApiService.getDoctorAppointments().catchError((_) => <dynamic>[]),
      ]);
      if (mounted) setState(() {
        final prof = results[0] as Map<String, dynamic>;
        _profile = (prof['data'] as Map<String, dynamic>?) ?? {};
        _name = _profile?['full_name']?.toString() ?? 'Doctor';
        _appts = (results[1] as List);
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
    final waiting = _appts.where((a) => ['booked','confirmed','arrived'].contains(a['status'])).length;
    final inProg  = _appts.where((a) => a['status'] == 'in_consultation').length;
    final done    = _appts.where((a) => a['status'] == 'completed').length;

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
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(padding: const EdgeInsets.all(16), children: [
                // Stat row
                Row(children: [
                  _DoctorStatCard('Waiting', waiting, Icons.access_time, const Color(0xFFD97706), const Color(0xFFFEF3C7)),
                  const SizedBox(width: 10),
                  _DoctorStatCard('In Progress', inProg, Icons.medical_services, const Color(0xFF2563EB), const Color(0xFFDBEAFE)),
                  const SizedBox(width: 10),
                  _DoctorStatCard('Done', done, Icons.check_circle_outline, const Color(0xFF059669), const Color(0xFFD1FAE5)),
                ]),
                const SizedBox(height: 20),
                const Text("Today's Queue", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                if (_appts.isEmpty)
                  const Center(child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Text('No appointments today', style: TextStyle(color: Color(0xFF9CA3AF))),
                  ))
                else
                  ..._appts.map((a) => _DoctorApptCard(a, onUpdate: _load)),
              ]),
      ),
    );
  }
}

class _DoctorStatCard extends StatelessWidget {
  final String label;
  final int value;
  final IconData icon;
  final Color color, bg;
  const _DoctorStatCard(this.label, this.value, this.icon, this.color, this.bg);
  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Column(children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(height: 4),
        Text('$value', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: color)),
        Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
      ]),
    ),
  );
}

class _DoctorApptCard extends StatelessWidget {
  final dynamic appt;
  final VoidCallback onUpdate;
  const _DoctorApptCard(this.appt, {required this.onUpdate});

  @override
  Widget build(BuildContext context) {
    final patient = appt['patient'] as Map? ?? {};
    final status  = appt['status'] ?? '';
    final statusColor = {
      'booked': const Color(0xFFD97706),
      'in_consultation': const Color(0xFF2563EB),
      'completed': const Color(0xFF059669),
    }[status] ?? const Color(0xFF9CA3AF);

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: Color(0xFFE5E7EB)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 44, height: 44,
          decoration: BoxDecoration(
            color: const Color(0xFFEDE9FE),
            borderRadius: BorderRadius.circular(12),
          ),
          alignment: Alignment.center,
          child: Text('#${appt['token_number'] ?? '?'}',
            style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF7C3AED))),
        ),
        title: Text(patient['full_name'] ?? 'Patient', style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (appt['slot_start_time'] != null)
            Text('${appt['slot_start_time']}', style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          if (appt['chief_complaint'] != null)
            Text('${appt['chief_complaint']}', style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
        ]),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
          child: Text(status, style: TextStyle(color: statusColor, fontWeight: FontWeight.w700, fontSize: 11)),
        ),
      ),
    );
  }
}
