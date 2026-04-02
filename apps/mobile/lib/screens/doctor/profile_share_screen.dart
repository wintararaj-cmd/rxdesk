import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../services/api_service.dart';

class ProfileShareScreen extends StatefulWidget {
  const ProfileShareScreen({Key? key}) : super(key: key);

  @override
  State<ProfileShareScreen> createState() => _ProfileShareScreenState();
}

class _ProfileShareScreenState extends State<ProfileShareScreen> {
  bool _loading = true;
  String? _doctorId;
  String? _doctorName;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final res = await ApiService.getDoctorProfile();
      setState(() {
        _doctorId = res['data']['id'];
        _doctorName = res['data']['full_name'];
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading profile: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileUrl = _doctorId != null ? 'https://rxdesk.in/doctor/$_doctorId' : '';

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Share Profile', style: TextStyle(fontWeight: FontWeight.w900)),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(32),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.grey.withOpacity(0.1),
                            blurRadius: 30,
                            offset: const Offset(0, 10),
                          )
                        ],
                      ),
                      child: Column(
                        children: [
                          if (profileUrl.isNotEmpty)
                            QrImageView(
                              data: profileUrl,
                              version: QrVersions.auto,
                              size: 200.0,
                              foregroundColor: const Color(0xFF0F172A),
                            ),
                          const SizedBox(height: 24),
                          Text(
                            'Dr. $_doctorName',
                            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -0.5),
                          ),
                          const Text(
                            'Scan to book an appointment',
                            style: TextStyle(color: Colors.grey, fontSize: 13, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 48),
                    const Text(
                      'DIRECT PROFILE LINK:',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.grey[50],
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.grey[200]!),
                      ),
                      child: Text(
                        profileUrl,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.indigo),
                      ),
                    ),
                    const SizedBox(height: 40),
                    Row(
                      children: [
                        Expanded(
                          child: _buildShareButton(
                            label: 'Copy Link',
                            icon: Icons.copy_rounded,
                            onPressed: () {
                              // TODO: Add clipboard functionality
                            },
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: _buildShareButton(
                            label: 'WhatsApp',
                            icon: Icons.share_rounded,
                            onPressed: () {
                              // TODO: Add sharing functionality
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildShareButton({required String label, required IconData icon, required VoidCallback onPressed}) {
    return ElevatedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 18),
      label: Text(label),
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.indigo[50],
        foregroundColor: Colors.indigo[800],
        elevation: 0,
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
      ),
    );
  }
}
