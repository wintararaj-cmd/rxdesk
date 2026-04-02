import 'package:flutter/material.dart';
import 'dart:ui';
import 'doctor/earnings_analysis_screen.dart';
import 'doctor/prescription_template_screen.dart';
import 'doctor/profile_share_screen.dart';
import 'doctor/doctor_prescribe_screen.dart';

class DoctorDashboardScreen extends StatefulWidget {
  const DoctorDashboardScreen({Key? key}) : super(key: key);

  @override
  State<DoctorDashboardScreen> createState() => _DoctorDashboardScreenState();
}

class _DoctorDashboardScreenState extends State<DoctorDashboardScreen> with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.2).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  IconData _getGreetingIcon() {
    final hour = DateTime.now().hour;
    if (hour < 12) return Icons.wb_sunny_rounded;
    if (hour < 18) return Icons.wb_cloudy_rounded;
    return Icons.nightlight_round;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 140.0,
            floating: false,
            pinned: true,
            backgroundColor: Colors.teal[700],
            elevation: 0,
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsets.only(left: 20, bottom: 16),
              title: Text(
                _getGreeting(),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                  letterSpacing: -0.5,
                ),
              ),
              background: Stack(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Colors.teal[800]!, Colors.teal[600]!],
                      ),
                    ),
                  ),
                  Positioned(
                    right: -20,
                    top: -20,
                    child: Icon(
                      _getGreetingIcon(),
                      size: 150,
                      color: Colors.white.withOpacity(0.1),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.notifications_none_rounded, color: Colors.white),
                onPressed: () {},
              ),
              const Padding(
                padding: EdgeInsets.only(right: 16.0),
                child: CircleAvatar(
                  radius: 16,
                  backgroundColor: Colors.white24,
                  child: Icon(Icons.person, size: 20, color: Colors.white),
                ),
              ),
            ],
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Glassmorphic Stats Section
                  Row(
                    children: [
                      Expanded(
                        child: _buildGlassCard(
                          title: "Appointments",
                          value: "12",
                          icon: Icons.calendar_today_rounded,
                          color: Colors.teal,
                          isLive: true,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _buildGlassCard(
                          title: "Total Revenue",
                          value: "₹4,500",
                          icon: Icons.account_balance_wallet_rounded,
                          color: Colors.indigo,
                          onTap: () {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => const EarningsAnalysisScreen()));
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  
                  // Today's Schedule
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        "Queue Timeline",
                        style: TextStyle(
                          fontSize: 20, 
                          fontWeight: FontWeight.w900, 
                          color: Color(0xFF1E293B),
                          letterSpacing: -0.5,
                        ),
                      ),
                      TextButton(
                        onPressed: () {},
                        style: TextButton.styleFrom(foregroundColor: Colors.teal),
                        child: const Text('View All', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  
                  _buildAppointmentTimelineItem(
                    time: '09:00 AM',
                    name: 'Michael Brown',
                    type: 'Routine Checkup',
                    isOnline: false,
                    status: 'Completed',
                  ),
                  _buildAppointmentTimelineItem(
                    time: '10:30 AM',
                    name: 'Sarah Davis',
                    type: 'Consultation',
                    isOnline: true,
                    status: 'In Progress',
                  ),
                  _buildAppointmentTimelineItem(
                    time: '11:45 AM',
                    name: 'Emily Wilson',
                    type: 'Follow-up',
                    isOnline: true,
                    status: 'Upcoming',
                  ),
                  
                  const SizedBox(height: 32),
                  
                  // Premium Tools Grid
                  const Text(
                    'Practice Tools',
                    style: TextStyle(
                      fontSize: 20, 
                      fontWeight: FontWeight.w900, 
                      color: Color(0xFF1E293B),
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 16),
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    mainAxisSpacing: 16,
                    crossAxisSpacing: 16,
                    childAspectRatio: 1.5,
                    children: [
                      _buildToolCard('Prescribe', Icons.edit_note_rounded, Colors.teal, () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => DoctorPrescribeScreen()));
                      }),
                      _buildToolCard('Templates', Icons.auto_awesome_rounded, Colors.fuchsia, () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const PrescriptionTemplateScreen()));
                      }),
                      _buildToolCard('Analytics', Icons.bar_chart_rounded, Colors.indigo, () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const EarningsAnalysisScreen()));
                      }),
                      _buildToolCard('Share Profile', Icons.qr_code_2_rounded, Colors.orange, () {
                        Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfileShareScreen()));
                      }),
                    ],
                  ),
                  const SizedBox(height: 80), // Footer spacer
                ],
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: Colors.teal[800],
        onPressed: () {},
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Quick Prescription', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildGlassCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
    bool isLive = false,
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.8),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white.withOpacity(0.5)),
              boxShadow: [
                BoxShadow(
                  color: color.withOpacity(0.1),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                )
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(icon, color: color, size: 20),
                    ),
                    if (isLive)
                      ScaleTransition(
                        scale: _pulseAnimation,
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Colors.red,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 24, 
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1E293B),
                  ),
                ),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 12, 
                    color: Colors.grey[600],
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildToolCard(String title, IconData icon, Color color, VoidCallback onTap) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(24),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.grey[200]!),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14, 
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF334155),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppointmentTimelineItem({
    required String time, 
    required String name, 
    required String type, 
    required bool isOnline,
    required String status,
  }) {
    Color statusColor;
    if (status == 'Completed') {
      statusColor = Colors.emerald;
    } else if (status == 'In Progress') {
      statusColor = Colors.orange;
    } else {
      statusColor = Colors.blue;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Column(
            children: [
              Text(
                time.split(' ')[0],
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
              Text(
                time.split(' ')[1],
                style: TextStyle(color: Colors.grey[400], fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(width: 20),
          Container(width: 1, height: 40, color: Colors.grey[100]),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B)),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(isOnline ? Icons.videocam_rounded : Icons.person_pin_circle_rounded, size: 12, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(
                      type,
                      style: TextStyle(color: Colors.grey[500], fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              status.toUpperCase(),
              style: TextStyle(fontSize: 10, color: statusColor, fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }
}
