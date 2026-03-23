// lib/screens/patient/patient_profile_details.dart
import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class PatientProfileDetails extends StatefulWidget {
  const PatientProfileDetails({super.key});
  @override
  State<PatientProfileDetails> createState() => _PatientProfileDetailsState();
}

class _PatientProfileDetailsState extends State<PatientProfileDetails> {
  Map<String, dynamic>? _profile;
  bool _isLoading = true;
  bool _isEditing = false;
  
  final _nameCtrl = TextEditingController();
  final _ageCtrl = TextEditingController();
  final _genderCtrl = TextEditingController();
  final _bloodCtrl = TextEditingController();

  @override
  void initState() { super.initState(); _fetch(); }

  Future<void> _fetch() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.getPatientProfile();
      final data = res['data'] as Map<String, dynamic>;
      if (mounted) setState(() {
        _profile = data;
        _nameCtrl.text = data['full_name'] ?? '';
        _ageCtrl.text = (data['age'] ?? '').toString();
        _genderCtrl.text = data['gender'] ?? '';
        _bloodCtrl.text = data['blood_group'] ?? '';
        _isLoading = false;
      });
    } catch (_) { if (mounted) setState(() => _isLoading = false); }
  }

  Future<void> _save() async {
    setState(() => _isLoading = true);
    try {
      await ApiService.updatePatientProfile({
        'full_name': _nameCtrl.text.trim(),
        'age': int.tryParse(_ageCtrl.text) ?? 0,
        'gender': _genderCtrl.text.trim(),
        'blood_group': _bloodCtrl.text.trim(),
      });
      _isEditing = false;
      _fetch();
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        actions: [
          if (!_isLoading)
            IconButton(
              icon: Icon(_isEditing ? Icons.save : Icons.edit),
              onPressed: () {
                if (_isEditing) _save();
                else setState(() => _isEditing = true);
              },
            )
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                _buildField('Full Name', _nameCtrl, editable: true),
                _buildField('Age', _ageCtrl, editable: true, isNumber: true),
                _buildField('Gender', _genderCtrl, editable: true),
                _buildField('Blood Group', _bloodCtrl, editable: true),
              ],
            ),
    );
  }

  Widget _buildField(String label, TextEditingController ctrl, {required bool editable, bool isNumber = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.grey)),
        const SizedBox(height: 4),
        if (_isEditing && editable)
           TextField(
             controller: ctrl,
             keyboardType: isNumber ? TextInputType.number : TextInputType.text,
             decoration: const InputDecoration(isDense: true),
           )
        else
           Text(ctrl.text.isEmpty ? '—' : ctrl.text, style: const TextStyle(fontSize: 16)),
      ]),
    );
  }
}
