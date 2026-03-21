// lib/screens/shop/shop_dashboard_tab.dart

import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class ShopDashboardTab extends StatefulWidget {
  const ShopDashboardTab({
    super.key,
    this.onNewSaleTap,
    this.onAppointmentsTap,
    this.onReportTap,
  });
  final VoidCallback? onNewSaleTap;
  final VoidCallback? onAppointmentsTap;
  final VoidCallback? onReportTap;
  @override
  State<ShopDashboardTab> createState() => _ShopDashboardTabState();
}

class _ShopDashboardTabState extends State<ShopDashboardTab> {
  Map<String, dynamic>? _dash;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiService.getShopDashboard();
      if (mounted) setState(() { _dash = res['data'] as Map<String, dynamic>?; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final d = _dash ?? {};
    final todaySales = d['today_sales'] ?? d['total_revenue'] ?? 0;
    final todayBills = d['today_bills'] ?? d['total_bills'] ?? 0;
    final lowStock   = d['low_stock_count'] ?? 0;
    final inventory  = d['total_inventory'] ?? 0;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Greeting
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF7C3AED), Color(0xFF4F46E5)],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Good day! 👋', style: TextStyle(color: Colors.white70, fontSize: 14)),
              const SizedBox(height: 4),
              const Text("Today's Revenue", style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text('₹${_fmt(todaySales)}',
                style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              Text('$todayBills bills generated today',
                style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13)),
            ]),
          ),
          const SizedBox(height: 20),
          const _SectionTitle('Overview'),
          const SizedBox(height: 12),
          GridView.count(
            shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12,
            childAspectRatio: 1.6,
            children: [
              _StatCard('Today Bills', '$todayBills', Icons.receipt_long, const Color(0xFF7C3AED), const Color(0xFFEDE9FE)),
              _StatCard('Today Sales', '₹${_fmt(todaySales)}', Icons.currency_rupee, const Color(0xFF059669), const Color(0xFFD1FAE5)),
              _StatCard('Low Stock', '$lowStock', Icons.warning_amber_rounded, const Color(0xFFD97706), const Color(0xFFFEF3C7)),
              _StatCard('Total Items', '$inventory', Icons.inventory_2_outlined, const Color(0xFF2563EB), const Color(0xFFDBEAFE)),
            ],
          ),
          const SizedBox(height: 24),

          const _SectionTitle('Quick Actions'),
          const SizedBox(height: 12),
           _QuickAction(
             icon: Icons.receipt_long_rounded,
             label: 'New Sale / Bill',
             color: const Color(0xFF7C3AED),
             onTap: widget.onNewSaleTap,
           ),
           const SizedBox(height: 10),
           _QuickAction(
             icon: Icons.people_alt_outlined,
             label: 'Today\'s Appointments',
             color: const Color(0xFF2563EB),
             onTap: widget.onAppointmentsTap,
           ),
           const SizedBox(height: 10),
           _QuickAction(
             icon: Icons.bar_chart_rounded,
             label: 'Sales Report',
             color: const Color(0xFF059669),
             onTap: widget.onReportTap,
           ),
           const SizedBox(height: 10),
           _QuickAction(
             icon: Icons.settings_rounded,
             label: 'Settings',
             color: const Color(0xFF6B7280),
             onTap: () {
               Navigator.pushNamed(context, '/shop/settings');
             },
           ),
        ],
      ),
    );
  }

  String _fmt(dynamic v) {
    final n = (v is num ? v.toDouble() : double.tryParse(v.toString()) ?? 0);
    if (n >= 100000) return '${(n / 100000).toStringAsFixed(1)}L';
    if (n >= 1000)   return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toStringAsFixed(0);
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);
  @override
  Widget build(BuildContext context) => Text(text,
    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF1F2937)));
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color, bg;
  const _StatCard(this.label, this.value, this.icon, this.color, this.bg);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(16)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(icon, color: color, size: 22),
        const SizedBox(height: 8),
        Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
      ]),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;
  const _QuickAction({required this.icon, required this.label, required this.color, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE5E7EB)),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 2))],
        ),
        child: Row(children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 14),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Color(0xFF1F2937))),
          const Spacer(),
          const Icon(Icons.chevron_right, color: Color(0xFFD1D5DB)),
        ]),
      ),
    );
  }
}
