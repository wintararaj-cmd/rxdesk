// lib/screens/shop/shop_bills_screen.dart
import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class ShopBillsScreen extends StatefulWidget {
  const ShopBillsScreen({super.key});
  @override
  State<ShopBillsScreen> createState() => _ShopBillsScreenState();
}

class _ShopBillsScreenState extends State<ShopBillsScreen> {
  List<dynamic> _bills = [];
  bool _loading = true;
  int _page = 1;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load({bool reset = false}) async {
    if (reset) _page = 1;
    setState(() => _loading = true);
    try {
      final list = await ApiService.getBills(page: _page);
      if (mounted) setState(() { 
        _bills = reset ? list : [..._bills, ...list];
        _loading = false; 
      });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sales History')),
      body: RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: _loading && _bills.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: _bills.length + 1,
                itemBuilder: (_, i) {
                  if (i == _bills.length) {
                    return Center(child: TextButton(onPressed: () { _page++; _load(); }, child: const Text('Load more')));
                  }
                  final b = _bills[i] as Map;
                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: ListTile(
                      title: Text(b['bill_number'] ?? 'N/A', style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text('Date: ${(b['created_at'] as String).substring(0, 10)} | Total: ₹${b['total_amount']}'),
                      trailing: PopupMenuButton<String>(
                        onSelected: (v) {
                          if (v == 'void') _confirmVoid(b);
                        },
                        itemBuilder: (ctx) => [
                          const PopupMenuItem(value: 'void', child: Text('Void (Cancel)', style: TextStyle(color: Colors.red))),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }

  void _confirmVoid(Map bill) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Void Bill?'),
        content: Text('Are you sure you want to void bill ${bill['bill_number']}? This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('No')),
          TextButton(
            onPressed: () async {
              try {
                await ApiService.voidBill(bill['id']);
                if (mounted) {
                  Navigator.pop(ctx);
                  _load(reset: true);
                }
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
              }
            },
            child: const Text('Yes, Void', style: TextStyle(color: Colors.red)),
          )
        ],
      ),
    );
  }
}
