// lib/screens/shop/shop_home.dart
// Shop owner bottom-nav shell: Dashboard | New Sale | Appointments | More

import 'package:flutter/material.dart';
import '../../services/auth_service.dart';
import '../../services/api_service.dart';
import '../login_screen.dart';
import 'shop_dashboard_tab.dart';
import 'shop_sale_screen.dart';
import 'shop_appointments_tab.dart';
import 'shop_inventory_tab.dart';

class ShopHome extends StatefulWidget {
  const ShopHome({super.key});
  @override
  State<ShopHome> createState() => _ShopHomeState();
}

class _ShopHomeState extends State<ShopHome> {
  int _tab = 0;
  String _shopName = 'My Shop';
  late final List<Widget> _pages;

  @override
  void initState() {
    super.initState();
    _loadShopName();
    _pages = [
      ShopDashboardTab(
        onNewSaleTap: () => setState(() => _tab = 1),
        onAppointmentsTap: () => setState(() => _tab = 2),
        onReportTap: () => {
          // TODO: Implement report navigation or show a message
          // For now, we can show a toast or dialog
        },
      ),
      ShopSaleScreen(),
      ShopAppointmentsTab(),
      ShopInventoryTab(),
    ];
  }

  Future<void> _loadShopName() async {
    try {
      final res = await ApiService.getMyShop();
      final shop = res['data'] as Map<String, dynamic>?;
      if (shop != null && mounted) {
        setState(() => _shopName = shop['shop_name']?.toString() ?? 'My Shop');
      }
    } catch (_) {}
  }

  Future<void> _logout() async {
    await ApiService.logout();
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _tab == 1
          ? null // Sale screen has its own AppBar
          : AppBar(
              title: Row(
                children: [
                  Image.asset('assets/images/logo.png', height: 32),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('RxDesk', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF7C3AED))),
                      Text(_shopName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: Color(0xFF1F2937))),
                    ],
                  ),
                ],
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.logout_rounded, size: 22, color: Color(0xFF6B7280)),
                  onPressed: _logout,
                  tooltip: 'Logout',
                ),
              ],
            ),
      body: IndexedStack(index: _tab, children: _pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        indicatorColor: const Color(0xFFEDE9FE),
        backgroundColor: Colors.white,
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard), label: 'Dashboard'),
          NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long), label: 'New Sale'),
          NavigationDestination(icon: Icon(Icons.calendar_today_outlined), selectedIcon: Icon(Icons.calendar_today), label: 'Appointments'),
          NavigationDestination(icon: Icon(Icons.inventory_2_outlined), selectedIcon: Icon(Icons.inventory_2), label: 'Inventory'),
        ],
      ),
    );
  }
}
