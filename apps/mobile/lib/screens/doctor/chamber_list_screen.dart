import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import 'chamber_schedule_screen.dart';

class ChamberListScreen extends StatefulWidget {
  const ChamberListScreen({Key? key}) : super(key: key);

  @override
  State<ChamberListScreen> createState() => _ChamberListScreenState();
}

class _ChamberListScreenState extends State<ChamberListScreen> {
  bool _loading = true;
  List<dynamic> _chambers = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiService.getDoctorChambers();
      setState(() {
        _chambers = res;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading chambers: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('My Clinics', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: -0.5)),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _load,
          )
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _chambers.isEmpty
              ? _buildEmptyState()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(20),
                    itemCount: _chambers.length,
                    itemBuilder: (context, index) {
                      final chamber = _chambers[index];
                      return _buildChamberCard(chamber);
                    },
                  ),
                ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.business_rounded, size: 80, color: Colors.blue.withOpacity(0.2)),
          const SizedBox(height: 24),
          const Text(
            'No Clinics Linked',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF1E293B)),
          ),
          const SizedBox(height: 8),
          const Text(
            'Lodge a request with a medical shop\nto start practicing.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey, fontSize: 13, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }

  Widget _buildChamberCard(dynamic chamber) {
    final shop = chamber['shop'];
    final status = chamber['status'] as String;
    final fee = chamber['consultation_fee'];

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.05),
            blurRadius: 15,
            offset: const Offset(0, 5),
          )
        ],
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: Colors.blue[50],
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(Icons.medication_rounded, color: Colors.blue, size: 28),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              shop['shop_name'],
                              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF1E293B)),
                            ),
                          ),
                          _buildStatusBadge(status),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${shop['address_line']}, ${shop['city']}',
                        style: TextStyle(color: Colors.grey[500], fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              children: [
                const Icon(Icons.payments_outlined, size: 16, color: Colors.grey),
                const SizedBox(width: 8),
                Text(
                  'Fee: ₹$fee',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF64748B)),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: status == 'active' ? () => _manageSchedule(chamber) : null,
                  icon: const Icon(Icons.schedule_rounded, size: 16),
                  label: const Text('Work Schedule'),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.blue[800],
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                  ),
                ),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    if (status == 'active') {
      color = Colors.teal;
    } else if (status == 'pending') {
      color = Colors.orange;
    } else {
      color = Colors.red;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 0.5),
      ),
    );
  }

  void _manageSchedule(dynamic chamber) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => ChamberScheduleScreen(chamber: chamber)),
    ).then((_) => _load());
  }
}
