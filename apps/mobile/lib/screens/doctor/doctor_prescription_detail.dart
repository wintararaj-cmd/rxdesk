// lib/screens/doctor/doctor_prescription_detail.dart
import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class DoctorPrescriptionDetail extends StatefulWidget {
  final Map prescription;
  const DoctorPrescriptionDetail({super.key, required this.prescription});

  @override
  State<DoctorPrescriptionDetail> createState() => _DoctorPrescriptionDetailState();
}

class _DoctorPrescriptionDetailState extends State<DoctorPrescriptionDetail> {
  late Map _data;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _data = widget.prescription;
  }

  @override
  Widget build(BuildContext context) {
    final patient = _data['patient'] as Map? ?? {};
    final items = _data['items'] as List? ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Prescription Details'),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline, color: Colors.red),
            onPressed: () => _confirmDelete(),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text('Patient: ${patient['full_name'] ?? 'N/A'}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          Text('Diagnosis: ${_data['diagnosis'] ?? 'No diagnosis recorded'}'),
          const Divider(height: 40),
          const Text('Medicines', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          ...items.map((i) => ListTile(
                title: Text(i['medicine_name'] ?? 'Unknown'),
                subtitle: Text('${i['dosage']} | ${i['frequency']} | ${i['duration']}'),
              )),
          if (items.isEmpty) const Text('No medicines recorded'),
        ],
      ),
    );
  }

  void _confirmDelete() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Prescription?'),
        content: const Text('Are you sure you want to delete this prescription? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              try {
                // Assuming we have a delete method
                await ApiService.deletePrescription(_data['id']);
                if (mounted) {
                  Navigator.pop(ctx); // Dialog
                  Navigator.pop(context, true); // Screen (return true to refresh list)
                }
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
              }
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          )
        ],
      ),
    );
  }
}
