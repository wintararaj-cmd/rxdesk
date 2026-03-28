// lib/screens/doctor/doctor_prescribe_screen.dart
import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class DoctorPrescribeScreen extends StatefulWidget {
  const DoctorPrescribeScreen({super.key});

  @override
  State<DoctorPrescribeScreen> createState() => _DoctorPrescribeScreenState();
}

class _DoctorPrescribeScreenState extends State<DoctorPrescribeScreen> {
  bool _isLoading = false;

  final _patientNameCtrl = TextEditingController();
  final _patientPhoneCtrl = TextEditingController();
  final _medicineNameCtrl = TextEditingController();
  final _dosageCtrl = TextEditingController();
  final _frequencyCtrl = TextEditingController();
  final _durationCtrl = TextEditingController();
  final _instructionsCtrl = TextEditingController();

  List<Map<String, dynamic>> _patientSuggestions = [];
  Timer? _patientDebounce;
  List<Map<String, dynamic>> _medicineSuggestions = [];
  Timer? _medicineDebounce;

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _patientNameCtrl.dispose();
    _patientPhoneCtrl.dispose();
    _medicineNameCtrl.dispose();
    _dosageCtrl.dispose();
    _frequencyCtrl.dispose();
    _durationCtrl.dispose();
    _instructionsCtrl.dispose();
    _patientDebounce?.cancel();
    _medicineDebounce?.cancel();
    super.dispose();
  }

  void _searchPatients(String q) {
    _patientDebounce?.cancel();
    if (q.length < 3) {
      setState(() => _patientSuggestions = []);
      return;
    }
    _patientDebounce = Timer(const Duration(milliseconds: 250), () async {
      try {
        final results = await ApiService.searchPatients(q);
        if (mounted) setState(() => _patientSuggestions = results.cast<Map<String, dynamic>>());
      } catch (_) {}
    });
  }

  void _searchMedicines(String q) {
    _medicineDebounce?.cancel();
    if (q.length < 3) {
      setState(() => _medicineSuggestions = []);
      return;
    }
    _medicineDebounce = Timer(const Duration(milliseconds: 250), () async {
      try {
        final results = await ApiService.searchMedicines(q);
        if (mounted) setState(() => _medicineSuggestions = results.cast<Map<String, dynamic>>());
      } catch (_) {}
    });
  }

  Future<void> _savePrescription() async {
    // Basic validation
    if (_patientNameCtrl.text.isEmpty ||
        _medicineNameCtrl.text.isEmpty ||
        _dosageCtrl.text.isEmpty ||
        _frequencyCtrl.text.isEmpty ||
        _durationCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all required fields')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final payload = {
        'patient_name': _patientNameCtrl.text.trim(),
        'patient_phone': _patientPhoneCtrl.text.trim(),
        'medicine_name': _medicineNameCtrl.text.trim(),
        'dosage': _dosageCtrl.text.trim(),
        'frequency': _frequencyCtrl.text.trim(),
        'duration': _durationCtrl.text.trim(),
        'instructions': _instructionsCtrl.text.trim(),
      };
      final res = await ApiService.createPrescription(payload);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Prescription saved successfully!')),
        );
        // Clear form
        _patientNameCtrl.clear();
        _patientPhoneCtrl.clear();
        _medicineNameCtrl.clear();
        _dosageCtrl.clear();
        _frequencyCtrl.clear();
        _durationCtrl.clear();
        _instructionsCtrl.clear();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save prescription: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Prescribe Medicine'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Patient Search
            TextField(
              controller: _patientNameCtrl,
              decoration: const InputDecoration(
                labelText: 'Patient Name',
                prefixIcon: Icon(Icons.person_outline),
              ),
              onChanged: (v) {
                _searchPatients(v);
              },
            ),
            if (_patientSuggestions.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 4),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Column(
                  children: _patientSuggestions.take(3).map((p) => ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: Color(0xFFEDE9FE),
                      child: Icon(Icons.person, color: Color(0xFF7C3AED), size: 18),
                    ),
                    title: Text(p['patient_name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(p['patient_phone'] ?? ''),
                    onTap: () {
                      _patientNameCtrl.text = p['patient_name'] ?? '';
                      _patientPhoneCtrl.text = p['patient_phone'] ?? '';
                      setState(() => _patientSuggestions = []);
                    },
                  )).toList(),
                ),
              ),
            const SizedBox(height: 12),
            
            // --- Templates Row ---
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Prescription Details', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                TextButton.icon(
                  onPressed: _showTemplatePicker,
                  icon: const Icon(Icons.bookmarks_outlined, color: Color(0xFF7C3AED), size: 18),
                  label: const Text('Load Quick Template', style: TextStyle(color: Color(0xFF7C3AED))),
                  style: TextButton.styleFrom(
                    backgroundColor: const Color(0xFFEDE9FE),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Medicine Search
            TextField(
              controller: _medicineNameCtrl,
              decoration: const InputDecoration(
                labelText: 'Medicine Name',
                prefixIcon: Icon(Icons.medication_outlined),
              ),
              onChanged: (v) {
                _searchMedicines(v);
              },
            ),
            if (_medicineSuggestions.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 4),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Column(
                  children: _medicineSuggestions.take(3).map((m) => ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: Color(0xFFEDE9FE),
                      child: Icon(Icons.medication, color: Color(0xFF7C3AED), size: 18),
                    ),
                    title: Text(m['medicine_name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(m['generic_name'] ?? ''),
                    onTap: () {
                      _medicineNameCtrl.text = m['medicine_name'] ?? '';
                      setState(() => _medicineSuggestions = []);
                    },
                  )).toList(),
                ),
              ),
            const SizedBox(height: 12),

            // Dosage
            TextField(
              controller: _dosageCtrl,
              decoration: const InputDecoration(
                labelText: 'Dosage (e.g., 500mg)',
                prefixIcon: Icon(Icons.numbers_outlined),
              ),
              keyboardType: TextInputType.text,
            ),
            const SizedBox(height: 12),

            // Frequency
            TextField(
              controller: _frequencyCtrl,
              decoration: const InputDecoration(
                labelText: 'Frequency (e.g., twice daily)',
                prefixIcon: Icon(Icons.timer_outlined),
              ),
              keyboardType: TextInputType.text,
            ),
            const SizedBox(height: 12),

            // Duration
            TextField(
              controller: _durationCtrl,
              decoration: const InputDecoration(
                labelText: 'Duration (e.g., 5 days)',
                prefixIcon: Icon(Icons.calendar_today_outlined),
              ),
              keyboardType: TextInputType.text,
            ),
            const SizedBox(height: 12),

            // Instructions
            TextField(
              controller: _instructionsCtrl,
              decoration: const InputDecoration(
                labelText: 'Instructions',
                prefixIcon: Icon(Icons.description_outlined),
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 24),

            // Save Buttons
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: ElevatedButton.icon(
                    onPressed: _isLoading ? null : _savePrescription,
                    icon: _isLoading
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Icon(Icons.save),
                    label: Text(_isLoading ? 'Saving...' : 'Save Prescription'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      backgroundColor: const Color(0xFF7C3AED),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 1,
                  child: OutlinedButton.icon(
                    onPressed: _isLoading ? null : _saveAsTemplate,
                    icon: const Icon(Icons.bookmark_add_outlined, color: Color(0xFF7C3AED)),
                    label: const Text('Save as Template', style: TextStyle(color: Color(0xFF7C3AED))),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      side: const BorderSide(color: Color(0xFF7C3AED)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showTemplatePicker() async {
    setState(() => _isLoading = true);
    try {
      final templates = await ApiService.getDoctorTemplates();
      if (!mounted) return;
      
      showModalBottomSheet(
        context: context,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (ctx) {
          if (templates.isEmpty) {
            return const Padding(
              padding: EdgeInsets.all(32.0),
              child: Text('No templates saved yet.', textAlign: TextAlign.center, style: TextStyle(fontSize: 16)),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: templates.length,
            itemBuilder: (ctx, i) {
              final t = templates[i];
              return Card(
                elevation: 0,
                color: const Color(0xFFF9FAFB),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFFE5E7EB))),
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: const CircleAvatar(
                    backgroundColor: Color(0xFFEDE9FE),
                    child: Icon(Icons.bookmark, color: Color(0xFF7C3AED)),
                  ),
                  title: Text(t['name'] ?? 'Unnamed Template', style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text(
                     (t['items'] != null && (t['items'] as List).isNotEmpty) 
                      ? (t['items'][0]['medicine_name'] ?? 'Unknown Medicine') 
                      : 'No items',
                  ),
                  trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                  onTap: () {
                    Navigator.pop(ctx);
                    if (t['items'] != null && (t['items'] as List).isNotEmpty) {
                      final item = t['items'][0];
                      _medicineNameCtrl.text = item['medicine_name'] ?? '';
                      _dosageCtrl.text = item['dosage'] ?? '';
                      _frequencyCtrl.text = item['frequency'] ?? '';
                      _durationCtrl.text = item['duration'] ?? '';
                      _instructionsCtrl.text = item['instructions'] ?? '';
                      setState((){});
                    }
                  },
                ),
              );
            },
          );
        },
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to load templates: $e')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _saveAsTemplate() {
    if (_medicineNameCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a medicine name to save as template.')));
      return;
    }
    
    final nameCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Save Quick Template'),
        content: TextField(
          controller: nameCtrl,
          decoration: const InputDecoration(labelText: 'Template Name', hintText: 'e.g., Standard Viral Fever'),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final name = nameCtrl.text.trim();
              if (name.isEmpty) return;
              Navigator.pop(ctx);
              setState(() => _isLoading = true);
              try {
                await ApiService.createDoctorTemplate({
                  'name': name,
                  'items': [
                    {
                      'medicine_name': _medicineNameCtrl.text.trim(),
                      'dosage': _dosageCtrl.text.trim(),
                      'frequency': _frequencyCtrl.text.trim(),
                      'duration': _durationCtrl.text.trim(),
                      'instructions': _instructionsCtrl.text.trim(),
                    }
                  ],
                });
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Template saved!')));
              } catch (e) {
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to save template: $e')));
              } finally {
                if (mounted) setState(() => _isLoading = false);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}