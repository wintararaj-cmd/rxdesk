// lib/screens/shop/shop_inventory_tab.dart

import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class ShopInventoryTab extends StatefulWidget {
  const ShopInventoryTab({super.key});
  @override
  State<ShopInventoryTab> createState() => _ShopInventoryTabState();
}

class _ShopInventoryTabState extends State<ShopInventoryTab> {
  List<dynamic> _items = [];
  bool _loading = true;
  int _total = 0, _page = 1;
  final _searchCtrl = TextEditingController();
  Timer? _debounce;

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _searchCtrl.dispose(); _debounce?.cancel(); super.dispose(); }

  Future<void> _load({bool reset = false}) async {
    if (reset) _page = 1;
    setState(() => _loading = true);
    try {
      final q = _searchCtrl.text.trim();
      final res = await ApiService.getInventory(page: _page, q: q.isEmpty ? null : q);
      final data = (res['data'] as List?) ?? [];
      final pagination = res['pagination'] as Map? ?? {};
      if (mounted) setState(() {
        _items = reset || _page == 1 ? data : [..._items, ...data];
        _total = pagination['total'] as int? ?? data.length;
        _loading = false;
      });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => _load(reset: true));
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      // Search bar
      Container(
        color: Colors.white,
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
        child: TextField(
          controller: _searchCtrl,
          decoration: InputDecoration(
            hintText: 'Search medicines…',
            prefixIcon: const Icon(Icons.search, size: 18),
            suffixIcon: _searchCtrl.text.isNotEmpty
                ? IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: () {
                    _searchCtrl.clear(); _load(reset: true);
                  })
                : null,
            isDense: true,
          ),
          onChanged: _onSearch,
        ),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Row(children: [
          Text('$_total items total', style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          const Spacer(),
          IconButton(icon: const Icon(Icons.refresh, size: 18), onPressed: () => _load(reset: true)),
        ]),
      ),
      Expanded(
        child: RefreshIndicator(
          onRefresh: () => _load(reset: true),
          child: _loading && _items.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                  itemCount: _items.length + (_items.length < _total ? 1 : 0),
                  itemBuilder: (_, i) {
                    if (i == _items.length) {
                      return Center(
                        child: TextButton(
                          onPressed: () { _page++; _load(); },
                          child: const Text('Load more'),
                        ),
                      );
                    }
                    final item = _items[i] as Map;
                    final stock = item['stock_qty'] as int? ?? 0;
                    final reorder = item['reorder_level'] as int? ?? 10;
                    final isLow = stock <= reorder;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: isLow ? const Color(0xFFFCA5A5) : const Color(0xFFE5E7EB)),
                      ),
                      child: ListTile(
                        leading: Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(
                            color: isLow ? const Color(0xFFFEF2F2) : const Color(0xFFEDE9FE),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            isLow ? Icons.warning_amber_rounded : Icons.medication_outlined,
                            color: isLow ? const Color(0xFFDC2626) : const Color(0xFF7C3AED),
                            size: 20,
                          ),
                        ),
                        title: Text(item['medicine_name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        subtitle: Text('Qty: $stock  |  MRP: ₹${item['mrp'] ?? 0}', style: const TextStyle(fontSize: 12)),
                        trailing: isLow
                            ? Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(6)),
                                child: const Text('Low', style: TextStyle(color: Color(0xFFDC2626), fontSize: 11, fontWeight: FontWeight.w700)),
                              )
                            : null,
                      ),
                    );
                  },
                ),
        ),
      ),
    ]);
  }
}
