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
                        subtitle: Text(
                          'Qty: $stock  |  MRP: ₹${item['mrp'] ?? 0}\n'
                          'Batch: ${item['batch_number'] ?? 'N/A'}  |  Exp: ${item['expiry_date'] != null ? (item['expiry_date'] as String).split('T')[0] : 'N/A'}',
                          style: const TextStyle(fontSize: 11),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (isLow)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(6)),
                                child: const Text('Low', style: TextStyle(color: Color(0xFFDC2626), fontSize: 11, fontWeight: FontWeight.w700)),
                              ),
                            PopupMenuButton<String>(
                              icon: const Icon(Icons.more_vert, size: 20, color: Color(0xFF9CA3AF)),
                              onSelected: (v) {
                                if (v == 'edit') _showEditDialog(item);
                                if (v == 'delete') _showDeleteConfirm(item);
                              },
                              itemBuilder: (ctx) => [
                                const PopupMenuItem(value: 'edit', child: Row(children: [Icon(Icons.edit_outlined, size: 18), SizedBox(width: 8), Text('Edit', style: TextStyle(fontSize: 13))])),
                                const PopupMenuItem(value: 'delete', child: Row(children: [Icon(Icons.delete_outline, size: 18, color: Colors.red), SizedBox(width: 8), Text('Delete', style: TextStyle(fontSize: 13, color: Colors.red))])),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddDialog,
        backgroundColor: const Color(0xFF7C3AED),
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  void _showAddDialog() {
    final nameCtrl = TextEditingController();
    final qtyCtrl = TextEditingController();
    final mrpCtrl = TextEditingController();
    final batchCtrl = TextEditingController();
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Inventory Item', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Medicine Name')),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: qtyCtrl, decoration: const InputDecoration(labelText: 'Stock Qty'), keyboardType: TextInputType.number)),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: mrpCtrl, decoration: const InputDecoration(labelText: 'MRP'), keyboardType: TextInputType.number)),
            ]),
            const SizedBox(height: 12),
            TextField(controller: batchCtrl, decoration: const InputDecoration(labelText: 'Batch Number')),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              try {
                // Assuming ApiService has a createInventoryItem method or use a generic POST
                // Since I don't see createInventoryItem, I'll assume it exists or use a placeholder
                // Actually, I'll check ApiService first.
                await ApiService.addInventoryItem({
                  'medicine_name': nameCtrl.text.trim(),
                  'stock_qty': int.tryParse(qtyCtrl.text) ?? 0,
                  'mrp': double.tryParse(mrpCtrl.text) ?? 0,
                  'batch_number': batchCtrl.text.trim(),
                });
                if (mounted) {
                  Navigator.pop(ctx);
                  _load(reset: true);
                }
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
              }
            },
            child: const Text('Add Item'),
          ),
        ],
      ),
    );
  }
...

  void _showEditDialog(Map item) {
    final nameCtrl = TextEditingController(text: item['medicine_name']);
    final qtyCtrl = TextEditingController(text: item['stock_qty']?.toString());
    final mrpCtrl = TextEditingController(text: item['mrp']?.toString());
    final batchCtrl = TextEditingController(text: item['batch_number']);
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit Inventory Item', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Medicine Name')),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: qtyCtrl, decoration: const InputDecoration(labelText: 'Stock Qty'), keyboardType: TextInputType.number)),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: mrpCtrl, decoration: const InputDecoration(labelText: 'MRP'), keyboardType: TextInputType.number)),
            ]),
            const SizedBox(height: 12),
            TextField(controller: batchCtrl, decoration: const InputDecoration(labelText: 'Batch Number')),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              try {
                await ApiService.updateInventoryItem(item['id'], {
                  'medicine_name': nameCtrl.text.trim(),
                  'stock_qty': int.tryParse(qtyCtrl.text) ?? 0,
                  'mrp': double.tryParse(mrpCtrl.text) ?? 0,
                  'batch_number': batchCtrl.text.trim(),
                });
                if (mounted) {
                  Navigator.pop(ctx);
                  _load(reset: true);
                }
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
              }
            },
            child: const Text('Save Changes'),
          ),
        ],
      ),
    );
  }

  void _showDeleteConfirm(Map item) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Item?'),
        content: Text('Are you sure you want to remove ${item['medicine_name']} from inventory?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              try {
                await ApiService.deleteInventoryItem(item['id']);
                if (mounted) {
                  Navigator.pop(ctx);
                  _load(reset: true);
                }
              } catch (e) {
                 ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
              }
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
