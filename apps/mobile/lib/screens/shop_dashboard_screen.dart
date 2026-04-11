import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'new_sale_screen.dart';
import 'shop/remote_scanner_screen.dart';

class ShopDashboardScreen extends StatefulWidget {
  const ShopDashboardScreen({Key? key}) : super(key: key);

  @override
  State<ShopDashboardScreen> createState() => _ShopDashboardScreenState();
}

class _ShopDashboardScreenState extends State<ShopDashboardScreen> {
  bool _isLoading = true;
  Map<String, dynamic> _data = {};
  Map<String, dynamic> _gstSummary = {};

  @override
  void initState() {
    super.initState();
    _loadData();
    _loadGstSummary();
  }

  Future<void> _loadGstSummary() async {
    try {
      final now = DateTime.now();
      final res = await ApiService.getGstSummary(month: now.month, year: now.year);
      if (mounted) {
        setState(() {
          _gstSummary = res['data'] ?? {};
        });
      }
    } catch (_) {}
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.getShopDashboard();
      setState(() {
        _data = res['data'] ?? {};
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading dashboard: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final appointments = _data['appointments'] as List? ?? [];
    
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('Shop Dashboard', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
          IconButton(
            icon: const Icon(Icons.account_circle_outlined),
            onPressed: () {},
          )
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Overview',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _buildSummaryCard('Today\'s Sales', '₹${_data['today_sales'] ?? 0}', Icons.currency_rupee, Colors.green)),
                  const SizedBox(width: 16),
                  Expanded(child: _buildSummaryCard('Pending Bills', '${_data['pending_bills'] ?? 0}', Icons.shopping_cart, Colors.blue)),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _buildSummaryCard('Low Stock', '${_data['low_stock_count'] ?? 0}', Icons.warning_amber_rounded, Colors.orange)),
                  const SizedBox(width: 16),
                  Expanded(child: _buildSummaryCard('Total Inventory', '${_data['total_inventory'] ?? 0}', Icons.inventory_2_outlined, Colors.purple)),
                ],
              ),
              const SizedBox(height: 32),
              
              // GST Insights Section
              if (_gstSummary.isNotEmpty) ...[
                const Text('GST Compliance Insights', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: [Colors.indigo.shade900, Colors.indigo.shade800]),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [BoxShadow(color: Colors.indigo.withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 4))],
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Est. Tax Liability', style: TextStyle(color: Colors.white60, fontSize: 12, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              Text('₹${_gstSummary['total_tax']?.toStringAsFixed(2) ?? '0.00'}', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.black)),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(10)),
                            child: const Text('GSTR-1 Ready', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                          )
                        ],
                      ),
                      const Divider(color: Colors.white10, height: 32),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildMiniGstStat('B2B Sales', '₹${_gstSummary['b2b_total'] ?? 0}'),
                          _buildMiniGstStat('B2CS Sales', '₹${_gstSummary['b2cs_total'] ?? 0}'),
                          _buildMiniGstStat('HSN Items', '${_gstSummary['hsn_count'] ?? 0}'),
                        ],
                      )
                    ],
                  ),
                ),
                const SizedBox(height: 32),
              ],

              const Text(
                'Quick Actions',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 3, // Changed to 3 for better fit
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.0,
                children: [
                   _buildActionCard(context, 'Billing Scanner', Icons.qr_code_scanner, Colors.deepOrange, onTrigger: () {
                     Navigator.push(context, MaterialPageRoute(builder: (_) => const RemoteScannerScreen()));
                   }),
                  _buildActionCard(context, 'Inventory', Icons.inventory, Colors.indigo),
                  _buildActionCard(context, 'Accounting', Icons.receipt_long, Colors.teal),
                  _buildActionCard(context, 'Settings', Icons.settings, Colors.blueAccent),
                  _buildActionCard(context, 'Payments', Icons.account_balance_wallet, Colors.green),
                ],
              ),
              const SizedBox(height: 32),
              const Text(
                'Today\'s Appointments',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              if (appointments.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: Text('No appointments today', style: TextStyle(color: Colors.grey))),
                )
              else
                _buildAppointmentList(appointments),
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const NewSaleScreen(),
            ),
          );
          _loadData();
        },
        icon: const Icon(Icons.add),
        label: const Text('New Sale'),
        backgroundColor: Colors.blueAccent,
      ),
    );
  }

  Widget _buildSummaryCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            spreadRadius: 2,
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: color, size: 28),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: TextStyle(fontSize: 14, color: Colors.grey[600]),
          ),
        ],
      ),
    );
  }

  Widget _buildActionCard(BuildContext context, String title, IconData icon, Color color, {VoidCallback? onTrigger}) {
    return InkWell(
      onTap: onTrigger ?? () {},
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: color.withOpacity(0.1), shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(height: 8),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: Colors.grey.shade800,
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildAppointmentList(List appointments) {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: appointments.length,
      itemBuilder: (context, index) {
        final apt = appointments[index];
        final patient = apt['patient'] ?? {};
        final chamber = apt['chamber'] ?? {};
        final doctor = chamber['doctor'] ?? {};

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            leading: CircleAvatar(
              backgroundColor: Colors.blue.withOpacity(0.1),
              child: const Icon(Icons.person, color: Colors.blue),
            ),
            title: Text(patient['full_name'] ?? 'Walk-in', style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('Doctor: ${doctor['full_name'] ?? 'N/A'}\nTime: ${apt['slot_start_time'] ?? ''}'),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(apt['status']?.toString().toUpperCase() ?? '', 
                   style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.blueAccent)),
                const SizedBox(height: 4),
                Text(apt['token_number'] != null ? '#${apt['token_number']}' : '', style: const TextStyle(color: Colors.grey)),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildMiniGstStat(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.black, fontSize: 16)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold)),
      ],
    );
  }
}
