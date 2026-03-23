// lib/screens/shop/shop_appointments_tab.dart

import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class ShopAppointmentsTab extends StatefulWidget {
  const ShopAppointmentsTab({super.key});
  @override
  State<ShopAppointmentsTab> createState() => _ShopAppointmentsTabState();
}

class _ShopAppointmentsTabState extends State<ShopAppointmentsTab> {
  List<dynamic> _appts = [];
  bool _loading = true;
  String _selectedDate = _today();

  static String _today() => DateTime.now().toIso8601String().substring(0, 10);

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final list = await ApiService.getTodayAppointments(date: _selectedDate);
      if (mounted) setState(() { _appts = list; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      // Date picker row
      Container(
        color: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(children: [
          const Icon(Icons.calendar_today, size: 16, color: Color(0xFF7C3AED)),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () async {
              final d = await showDatePicker(
                context: context,
                initialDate: DateTime.parse(_selectedDate),
                firstDate: DateTime(2024), lastDate: DateTime(2026),
              );
              if (d != null) {
                _selectedDate = d.toIso8601String().substring(0, 10);
                _load();
              }
            },
            child: Text(_selectedDate, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF7C3AED))),
          ),
          const SizedBox(width: 12),
          if (_selectedDate != _today())
            TextButton(onPressed: () { _selectedDate = _today(); _load(); },
              child: const Text('Today', style: TextStyle(color: Color(0xFF7C3AED), fontSize: 12))),
          const Spacer(),
          IconButton(icon: const Icon(Icons.refresh, size: 18), onPressed: _load),
        ]),
      ),
      // Stats
      Container(
        color: const Color(0xFFF9FAFB),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(children: [
          _Chip('Total', '${_appts.length}', const Color(0xFF7C3AED)),
          const SizedBox(width: 8),
          _Chip('Waiting', '${_appts.where((a) => ['booked','arrived','confirmed'].contains(a['status'])).length}', const Color(0xFFD97706)),
          const SizedBox(width: 8),
          _Chip('Done', '${_appts.where((a) => a['status'] == 'completed').length}', const Color(0xFF059669)),
        ]),
      ),
      // List
      Expanded(
        child: RefreshIndicator(
          onRefresh: _load,
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _appts.isEmpty
              ? const Center(child: Text('No appointments', style: TextStyle(color: Color(0xFF9CA3AF))))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: _appts.length,
                  itemBuilder: (_, i) => _ApptCard(_appts[i], onUpdate: _load),
                ),
        ),
      ),
    ]);
  }
}

class _Chip extends StatelessWidget {
  final String label, value;
  final Color color;
  const _Chip(this.label, this.value, this.color);
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: TextStyle(fontWeight: FontWeight.w800, color: color, fontSize: 13)),
      const SizedBox(width: 4),
      Text(label, style: TextStyle(color: color.withOpacity(0.8), fontSize: 11)),
    ]),
  );
}

class _ApptCard extends StatelessWidget {
  final dynamic appt;
  final VoidCallback onUpdate;
  const _ApptCard(this.appt, {required this.onUpdate});

  @override
  Widget build(BuildContext context) {
    final status = appt['status'] ?? '';
    final patient = appt['patient'] as Map? ?? {};
    final chamber = appt['chamber'] as Map? ?? {};
    final doctor  = chamber['doctor'] as Map? ?? {};

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
      'booked': 'Booked', 'confirmed': 'Confirmed', 'arrived': 'Arrived',
      'in_consultation': 'In Progress', 'completed': 'Completed',
      'cancelled': 'Cancelled', 'no_show': 'No Show',
    }[status] ?? status;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: Color(0xFFE5E7EB)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            // Token
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFEDE9FE),
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Text('#${appt['token_number'] ?? '?'}',
                style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF7C3AED), fontSize: 13)),
            ),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(patient['full_name'] ?? 'Patient', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              if ((patient['user'] as Map?)?['phone'] != null)
                Text(patient['user']['phone'], style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
            ])),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
              child: Text(statusLabel, style: TextStyle(color: statusColor, fontWeight: FontWeight.w700, fontSize: 11)),
            ),
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, size: 20, color: Color(0xFF9CA3AF)),
              onSelected: (v) {
                if (v == 'cancel') _updateStatus(context, appt['id'], 'cancelled');
                if (v == 'no_show') _updateStatus(context, appt['id'], 'no_show');
                if (v == 'booked') _updateStatus(context, appt['id'], 'booked');
                if (v == 'confirmed') _updateStatus(context, appt['id'], 'confirmed');
              },
              itemBuilder: (ctx) => [
                const PopupMenuItem(value: 'booked', child: Text('Mark as Booked')),
                const PopupMenuItem(value: 'confirmed', child: Text('Mark as Confirmed')),
                const PopupMenuItem(value: 'no_show', child: Text('Mark as No Show')),
                const PopupMenuItem(value: 'cancel', child: Text('Cancel Appointment', style: TextStyle(color: Colors.red))),
              ],
            ),
          ]),
          if (doctor['full_name'] != null) ...[
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.medical_services_outlined, size: 13, color: Color(0xFF9CA3AF)),
              const SizedBox(width: 4),
              Text('Dr. ${doctor['full_name']}', style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
              if (appt['slot_start_time'] != null) ...[
                const SizedBox(width: 12),
                const Icon(Icons.access_time, size: 13, color: Color(0xFF9CA3AF)),
                const SizedBox(width: 4),
                Text('${appt['slot_start_time']}', style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
              ],
            ]),
          ],
          // Action buttons
          if (!['completed','cancelled','no_show'].contains(status)) ...[
            const SizedBox(height: 10),
            Row(children: [
              if (['booked','confirmed','arrived'].contains(status))
                _ActionBtn('Start', const Color(0xFF2563EB), () => _updateStatus(context, appt['id'], 'in_consultation')),
              if (status == 'in_consultation')
                _ActionBtn('Complete ✓', const Color(0xFF059669), () => _updateStatus(context, appt['id'], 'completed')),
              const SizedBox(width: 8),
              if (['booked','confirmed'].contains(status))
                _ActionBtn('No Show', const Color(0xFF9CA3AF), () => _updateStatus(context, appt['id'], 'no_show')),
            ]),
          ],
        ]),
      ),
    );
  }

  Future<void> _updateStatus(BuildContext ctx, String id, String status) async {
    try {
      await ApiService.updateAppointmentStatus(id, status);
      onUpdate();
    } catch (e) {
      if (ctx.mounted) {
        ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }
}

class _ActionBtn extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionBtn(this.label, this.color, this.onTap);
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(8)),
      child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
    ),
  );
}
