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
  int _total = 0;
  final _searchCtrl = TextEditingController();
  Timer? _debounce;

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _searchCtrl.dispose(); _debounce?.cancel(); super.dispose(); }

  Future<void> _load({bool reset = false}) async {
    setState(() => _loading = true);
    try {
      final q = _searchCtrl.text.trim();
      final res = await ApiService.getInventoryMaster(q: q.isEmpty ? null : q);
      final data = (res['data'] as List?) ?? [];
      if (mounted) setState(() {
        _items = data;
        _total = data.length;
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
    return Scaffold(
      body: Column(children: [
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
                  itemCount: _items.length,
                  itemBuilder: (_, i) => InventoryMasterCard(
                    item: _items[i] as Map,
                    onEdit: (it) => _showMasterEditDialog(it),
                    onRefresh: () => _load(reset: true),
                  ),
                ),
        ),
      ),
      ]),
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
    final hsnCtrl = TextEditingController();
    
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
            Row(children: [
              Expanded(child: TextField(controller: batchCtrl, decoration: const InputDecoration(labelText: 'Batch Number'))),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: hsnCtrl, decoration: const InputDecoration(labelText: 'HSN Code'))),
            ]),
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
                  'hsn_code': hsnCtrl.text.trim(),
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

  void _showMasterEditDialog(Map item) {
    final nameCtrl = TextEditingController(text: item['medicine_name']);
    final hsnCtrl = TextEditingController(text: item['hsn_code']);
    final rackCtrl = TextEditingController(text: item['rack_location']);
    final reorderCtrl = TextEditingController(text: item['reorder_level']?.toString());
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit Medicine Master', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: nameCtrl, readOnly: true, decoration: const InputDecoration(labelText: 'Medicine Name', filled: true)),
            const SizedBox(height: 12),
            TextField(controller: hsnCtrl, decoration: const InputDecoration(labelText: 'HSN Code')),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: rackCtrl, decoration: const InputDecoration(labelText: 'Rack Location'))),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: reorderCtrl, decoration: const InputDecoration(labelText: 'Reorder Level'), keyboardType: TextInputType.number)),
            ]),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              try {
                await ApiService.patchInventoryMaster(item['id'], {
                  'hsn_code': hsnCtrl.text.trim(),
                  'rack_location': rackCtrl.text.trim(),
                  'reorder_level': int.tryParse(reorderCtrl.text) ?? 10,
                });
                if (mounted) {
                  Navigator.pop(ctx);
                  _load(reset: true);
                }
              } catch (e) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
              }
            },
            child: const Text('Save Master'),
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

class InventoryMasterCard extends StatefulWidget {
  final Map item;
  final Function(Map) onEdit;
  final VoidCallback onRefresh;
  const InventoryMasterCard({super.key, required this.item, required this.onEdit, required this.onRefresh});
  @override
  State<InventoryMasterCard> createState() => _InventoryMasterCardState();
}

class _InventoryMasterCardState extends State<InventoryMasterCard> {
  bool _expanded = false;
  List<dynamic> _batches = [];
  bool _batchesLoading = false;

  Future<void> _loadBatches() async {
    setState(() => _batchesLoading = true);
    try {
      final data = await ApiService.getMasterBatches(widget.item['id']);
      if (mounted) setState(() { _batches = data; _batchesLoading = false; });
    } catch (_) { if (mounted) setState(() => _batchesLoading = false); }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final stock = item['total_stock'] as num? ?? 0;
    final reorder = item['reorder_level'] as num? ?? 10;
    final isLow = stock <= reorder;

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: isLow ? const Color(0xFFFCA5A5) : const Color(0xFFF3F4F6)),
      ),
      child: Column(
        children: [
          ListTile(
            onTap: () {
              setState(() => _expanded = !_expanded);
              if (_expanded && _batches.isEmpty) _loadBatches();
            },
            leading: Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: isLow ? const Color(0xFFFEF2F2) : const Color(0xFFF5F3FF),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                _expanded ? Icons.keyboard_arrow_up : Icons.medication_outlined,
                color: isLow ? const Color(0xFFDC2626) : const Color(0xFF7C3AED),
              ),
            ),
            title: Text(item['medicine_name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1F2937))),
            subtitle: Text(
              'Stock: $stock  |  HSN: ${item['hsn_code'] ?? '—'}\n'
              'Rack: ${item['rack_location'] ?? '—'}',
              style: const TextStyle(fontSize: 10, color: Color(0xFF6B7280)),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (isLow)
                  Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFFFE4E6), borderRadius: BorderRadius.circular(6)),
                    child: const Text('LOW', style: TextStyle(color: Color(0xFFE11D48), fontSize: 9, fontWeight: FontWeight.w900)),
                  ),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_horiz, color: Color(0xFF9CA3AF)),
                  onSelected: (v) {
                    if (v == 'edit') widget.onEdit(item);
                  },
                  itemBuilder: (ctx) => [
                    const PopupMenuItem(value: 'edit', child: Text('Master Edit')),
                  ],
                ),
              ],
            ),
          ),
          if (_expanded) ...[
            const Divider(height: 1),
            if (_batchesLoading)
              const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)))
            else if (_batches.isEmpty)
              const Padding(padding: EdgeInsets.all(12), child: Text("No batches found.", style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic)))
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _batches.length,
                separatorBuilder: (_, __) => const Divider(height: 1, indent: 60),
                itemBuilder: (ctx, idx) {
                  final b = _batches[idx];
                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
                    visualDensity: VisualDensity.compact,
                    title: Text(b['batch_number'] ?? 'No Batch', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'monospace')),
                    subtitle: Text('Exp: ${b['expiry_date'] != null ? (b['expiry_date'] as String).split('T')[0] : '—'} | MRP: ₹${b['mrp']}', style: const TextStyle(fontSize: 10)),
                    trailing: Text('${b['stock_qty']} units', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Color(0xFF111827))),
                    onTap: () => _showBatchEditDialog(ctx, b),
                  );
                },
              ),
          ],
        ],
      ),
    );
  }

  void _showBatchEditDialog(BuildContext context, Map b) {
    // Basic dialog for stock correction or MRP change
    final qtyCtrl = TextEditingController(text: b['stock_qty'].toString());
    final mrpCtrl = TextEditingController(text: b['mrp'].toString());
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Edit Batch: ${b['batch_number']}'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: qtyCtrl, decoration: const InputDecoration(labelText: 'Stock Quantity'), keyboardType: TextInputType.number),
          TextField(controller: mrpCtrl, decoration: const InputDecoration(labelText: 'MRP (₹)'), keyboardType: TextInputType.number),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(onPressed: () async {
            try {
              await ApiService.updateInventoryItem(b['id'], {
                'stock_qty': int.tryParse(qtyCtrl.text) ?? 0,
                'mrp': double.tryParse(mrpCtrl.text) ?? 0,
              });
              Navigator.pop(ctx);
              _loadBatches();
              widget.onRefresh();
            } catch (e) {
              ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text('Error: $e')));
            }
          }, child: const Text('Correction')),
        ],
      ),
    );
  }
}
