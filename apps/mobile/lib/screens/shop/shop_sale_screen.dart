// lib/screens/shop/shop_sale_screen.dart
// Full-featured billing screen — customer search, medicine autocomplete, JWT auth

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../services/api_service.dart';

class ShopSaleScreen extends StatefulWidget {
  const ShopSaleScreen({super.key});
  @override
  State<ShopSaleScreen> createState() => _ShopSaleScreenState();
}

class _ShopSaleScreenState extends State<ShopSaleScreen> {
  bool _isLoading = false;

  final _nameCtrl     = TextEditingController(text: 'Walk-in Customer');
  final _discountCtrl = TextEditingController();
  String _customerPhone = '';
  String _paymentMethod = 'cash';

  final _paymentOptions = const [
    ('cash', 'Cash', Icons.payments_outlined),
    ('upi', 'UPI', Icons.qr_code),
    ('card', 'Card', Icons.credit_card),
    ('pending', 'Pay Later', Icons.schedule),
  ];

  // Items list
  final List<_SaleItem> _items = [];

  double _subtotal = 0, _total = 0;

  // Customer search
  List<Map<String, dynamic>> _customerSuggestions = [];
  Timer? _customerDebounce;

  @override
  void initState() {
    super.initState();
    _addItem();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _discountCtrl.dispose();
    for (var i in _items) { i.dispose(); }
    _customerDebounce?.cancel();
    super.dispose();
  }

  void _addItem() {
    final item = _SaleItem(onChanged: _recalc);
    setState(() => _items.add(item));
  }

  void _removeItem(int index) {
    if (_items.length <= 1) return;
    final item = _items[index];
    setState(() => _items.removeAt(index));
    item.dispose();
    _recalc();
  }

  void _recalc() {
    double sub = 0;
    double itemDiscTotal = 0;
    double gstTotal = 0;

    for (final item in _items) {
      final qty = int.tryParse(item.qtyCtrl.text) ?? 0;
      final mrp = double.tryParse(item.mrpCtrl.text) ?? 0.0;
      final discVal = double.tryParse(item.discCtrl.text) ?? 0.0;

      final itemSub = qty * mrp;
      sub += itemSub;

      final itemDisc = item.discountType == 'percentage'
          ? (itemSub * discVal) / 100
          : (qty * discVal);
      itemDiscTotal += itemDisc;

      final taxVal = ((itemSub - itemDisc) * item.gstRate) / 100;
      gstTotal += taxVal;
    }
    
    final globalDisc = double.tryParse(_discountCtrl.text) ?? 0.0;
    final totalDisc = itemDiscTotal + globalDisc;

    setState(() { 
      _subtotal = sub; 
      _total = (sub - totalDisc + gstTotal).clamp(0, double.infinity); 
    });
  }

  Future<void> _searchCustomers(String q) async {
    _customerDebounce?.cancel();
    if (q.length < 3) { setState(() => _customerSuggestions = []); return; }
    _customerDebounce = Timer(const Duration(milliseconds: 250), () async {
      try {
        final results = await ApiService.searchCustomers(q);
        if (mounted) setState(() => _customerSuggestions = results.cast<Map<String, dynamic>>());
      } catch (_) {}
    });
  }

  Future<void> _generateBill() async {
    final payloadItems = <Map<String, dynamic>>[];
    for (final item in _items) {
      final name = item.nameCtrl.text.trim();
      final qty  = int.tryParse(item.qtyCtrl.text) ?? 0;
      final mrp  = double.tryParse(item.mrpCtrl.text) ?? 0.0;
      if (name.isNotEmpty && qty > 0) {
        payloadItems.add({
          'medicine_name': name,
          'mrp': mrp,
          'quantity': qty,
          'inventory_id': item.inventoryId,
          'unit': item.unit,
          'batch_number': item.batchNumber,
          if (item.expiryDate.isNotEmpty) 'expiry_date': item.expiryDate,
          'gst_rate': item.gstRate,
          'discount_type': item.discountType,
          'discount_value': double.tryParse(item.discCtrl.text) ?? 0.0,
        });
      }
    }

    if (payloadItems.isEmpty) {
      _snack('Add at least one medicine with quantity', error: true); return;
    }

    setState(() => _isLoading = true);
    try {
      final payload = {
        'customer_phone': _customerPhone.trim(),
        'customer_name': _nameCtrl.text.trim(),
        'items': payloadItems,
        'discount_amount': double.tryParse(_discountCtrl.text) ?? 0.0,
        'payment_method': _paymentMethod,
      };
      await ApiService.createManualBill(payload);
      _snack('✅ Bill saved successfully!');
      _reset();
    } on ApiException catch (e) {
      _snack(e.message, error: true);
    } catch (e) {
      _snack('Network error — check connection', error: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _reset() {
    _nameCtrl.text = 'Walk-in Customer';
    _discountCtrl.clear();
    _customerPhone = '';
    for (final item in _items) { item.dispose(); }
    _items.clear();
    _addItem();
    _recalc();
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? const Color(0xFFDC2626) : const Color(0xFF059669),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: const Text('New Sale', style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: Colors.white,
        actions: [
          TextButton.icon(
            onPressed: _reset,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Reset'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [

          // ── Customer ──────────────────────────────────────────────────────
          _SectionCard(
            number: '1', title: 'Customer Details', subtitle: '(optional)',
            child: Column(children: [
              // Phone autocomplete
              TextField(
                keyboardType: TextInputType.phone,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: const InputDecoration(
                  labelText: 'Phone (search customer)',
                  hintText: '9XXXXXXXXX',
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
                onChanged: (v) { _customerPhone = v; _searchCustomers(v); },
              ),
              if (_customerSuggestions.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 8)],
                  ),
                  child: Column(
                    children: _customerSuggestions.take(4).map((c) => ListTile(
                      leading: const CircleAvatar(
                        backgroundColor: Color(0xFFEDE9FE),
                        child: Icon(Icons.person, color: Color(0xFF7C3AED), size: 18),
                      ),
                      title: Text(c['customer_phone'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(c['customer_name'] ?? ''),
                      onTap: () {
                        _customerPhone = c['customer_phone'] ?? '';
                        if ((c['customer_name'] ?? '').toString().isNotEmpty) {
                          _nameCtrl.text = c['customer_name'];
                        }
                        setState(() => _customerSuggestions = []);
                      },
                    )).toList(),
                  ),
                ),
              const SizedBox(height: 10),
              TextField(
                controller: _nameCtrl,
                decoration: const InputDecoration(
                  labelText: 'Customer Name',
                  prefixIcon: Icon(Icons.person_outline),
                ),
              ),
            ]),
          ),

          const SizedBox(height: 12),

          // ── Medicines ─────────────────────────────────────────────────────
          _SectionCard(
            number: '2', title: 'Medicines',
            child: Column(children: [
              ...List.generate(_items.length, (i) => _MedicineRow(
                key: ValueKey(i),
                item: _items[i],
                onRemove: _items.length > 1 ? () => _removeItem(i) : null,
              )),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: _addItem,
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add Medicine'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF7C3AED),
                  side: const BorderSide(color: Color(0xFF7C3AED)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ]),
          ),

          const SizedBox(height: 12),

          // ── Discount + Payment ────────────────────────────────────────────
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: _SectionCard(
                number: '3', title: 'Discount (₹)',
                child: TextField(
                  controller: _discountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(hintText: '0'),
                  onChanged: (_) => _recalc(),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: _SectionCard(
                number: '4', title: 'Payment',
                child: Wrap(
                  spacing: 8, runSpacing: 8,
                  children: _paymentOptions.map((opt) {
                    final selected = _paymentMethod == opt.$1;
                    return GestureDetector(
                      onTap: () => setState(() => _paymentMethod = opt.$1),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: selected ? const Color(0xFF7C3AED) : Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: selected ? const Color(0xFF7C3AED) : const Color(0xFFE5E7EB),
                          ),
                        ),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(opt.$3, size: 14, color: selected ? Colors.white : const Color(0xFF6B7280)),
                          const SizedBox(width: 4),
                          Text(opt.$2, style: TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w600,
                            color: selected ? Colors.white : const Color(0xFF374151),
                          )),
                        ]),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ]),

          const SizedBox(height: 16),

          // ── Bill summary ──────────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFF5F3FF), Color(0xFFEDE9FE)],
                begin: Alignment.topLeft, end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFDDD6FE)),
            ),
            child: Column(children: [
              _BillRow('Subtotal', '₹${_subtotal.toStringAsFixed(2)}'),
              if (double.tryParse(_discountCtrl.text) != null && double.tryParse(_discountCtrl.text)! > 0) ...[
                const SizedBox(height: 6),
                _BillRow('Discount', '−₹${_discountCtrl.text}', color: const Color(0xFF059669)),
              ],
              const Divider(height: 24, color: Color(0xFFDDD6FE)),
              Row(children: [
                const Text('Total', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF7C3AED))),
                const Spacer(),
                Text('₹${_total.toStringAsFixed(2)}', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Color(0xFF7C3AED))),
              ]),
            ]),
          ),
          const SizedBox(height: 20),

          // ── Generate Bill button ─────────────────────────────────────────
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isLoading ? null : _generateBill,
              icon: _isLoading
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Icon(Icons.receipt_long),
              label: Text(_isLoading ? 'Generating...' : 'Generate Bill'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                backgroundColor: const Color(0xFF7C3AED),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
          const SizedBox(height: 32),
        ]),
      ),
    );
  }
}

// ── Section Card ──────────────────────────────────────────────────────────────
class _SectionCard extends StatelessWidget {
  final String number, title;
  final String? subtitle;
  final Widget child;
  const _SectionCard({required this.number, required this.title, this.subtitle, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          CircleAvatar(
            radius: 11,
            backgroundColor: const Color(0xFFEDE9FE),
            child: Text(number, style: const TextStyle(fontSize: 11, color: Color(0xFF7C3AED), fontWeight: FontWeight.w800)),
          ),
          const SizedBox(width: 8),
          Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1F2937))),
          if (subtitle != null) ...[
            const SizedBox(width: 6),
            Text(subtitle!, style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
          ],
        ]),
        const SizedBox(height: 14),
        child,
      ]),
    );
  }
}

// ── Bill Row ──────────────────────────────────────────────────────────────────
class _BillRow extends StatelessWidget {
  final String label, value;
  final Color? color;
  const _BillRow(this.label, this.value, {this.color});
  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Text(label, style: TextStyle(color: color ?? const Color(0xFF6B7280), fontSize: 14)),
      const Spacer(),
      Text(value, style: TextStyle(color: color ?? const Color(0xFF374151), fontWeight: FontWeight.w600, fontSize: 14)),
    ]);
  }
}

// ── Sale Item model ───────────────────────────────────────────────────────────
class _SaleItem {
  final TextEditingController nameCtrl = TextEditingController();
  final TextEditingController qtyCtrl  = TextEditingController(text: '1');
  final TextEditingController mrpCtrl  = TextEditingController();
  final TextEditingController discCtrl = TextEditingController(text: '0');

  String? inventoryId;
  String unit = 'strip';
  String batchNumber = '';
  String expiryDate = '';
  double gstRate = 12.0;
  String discountType = 'percentage';

  final VoidCallback onChanged;
  List<Map<String, dynamic>> suggestions = [];
  Timer? _debounce;

  _SaleItem({required this.onChanged}) {
    qtyCtrl.addListener(onChanged);
    mrpCtrl.addListener(onChanged);
    discCtrl.addListener(onChanged);
  }

  void searchMedicine(String q, Function(List<Map<String, dynamic>>) onResult) {
    _debounce?.cancel();
    if (q.length < 2) { onResult([]); return; }
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        final list = await ApiService.searchInventory(q);
        onResult(list.cast<Map<String, dynamic>>());
      } catch (_) { onResult([]); }
    });
  }

  void dispose() {
    nameCtrl.dispose(); qtyCtrl.dispose(); mrpCtrl.dispose(); discCtrl.dispose();
    _debounce?.cancel();
  }
}

// ── Medicine Row ──────────────────────────────────────────────────────────────
class _MedicineRow extends StatefulWidget {
  final _SaleItem item;
  final VoidCallback? onRemove;
  const _MedicineRow({super.key, required this.item, this.onRemove});
  @override
  State<_MedicineRow> createState() => _MedicineRowState();
}

class _MedicineRowState extends State<_MedicineRow> {
  List<Map<String, dynamic>> _suggs = [];

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        // Medicine name
        Expanded(
          flex: 3,
          child: Column(children: [
            TextField(
              controller: widget.item.nameCtrl,
              decoration: const InputDecoration(hintText: 'Medicine name', isDense: true),
              onChanged: (q) {
                widget.item.searchMedicine(q, (list) {
                  if (mounted) setState(() => _suggs = list);
                });
              },
            ),
            if (_suggs.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 2),
                constraints: const BoxConstraints(maxHeight: 180),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                  borderRadius: BorderRadius.circular(10),
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.07), blurRadius: 8)],
                ),
                child: ListView(
                  shrinkWrap: true,
                  padding: EdgeInsets.zero,
                  children: _suggs.take(5).map((m) => ListTile(
                    dense: true,
                    title: Text(m['medicine_name'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('₹${m['mrp'] ?? 0}  |  Stock: ${m['stock_qty'] ?? 0}',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
                        if (m['batch_number'] != null || m['expiry_date'] != null)
                          Text('Batch: ${m['batch_number'] ?? 'N/A'}  |  Exp: ${m['expiry_date'] != null ? (m['expiry_date'] as String).split('T')[0] : 'N/A'}',
                              style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF))),
                      ],
                    ),
                    onTap: () {
                      widget.item.nameCtrl.text = m['medicine_name'] ?? '';
                      widget.item.mrpCtrl.text  = (m['mrp'] ?? '').toString();
                      
                      widget.item.inventoryId = m['id'];
                      widget.item.unit = m['unit'] ?? widget.item.unit;
                      widget.item.batchNumber = m['batch_number'] ?? '';
                      widget.item.expiryDate = m['expiry_date'] ?? '';
                      widget.item.gstRate = (m['gst_rate'] ?? 12).toDouble();
                      widget.item.discountType = m['discount_type'] ?? widget.item.discountType;
                      widget.item.discCtrl.text = (m['discount_value'] ?? 0).toString();

                      widget.item.onChanged();
                      setState(() => _suggs = []);
                    },
                  )).toList(),
                ),
              ),
          ]),
        ),
        const SizedBox(width: 8),
        // Qty
        SizedBox(
          width: 56,
          child: TextField(
            controller: widget.item.qtyCtrl,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(hintText: 'Qty', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 4, vertical: 10)),
          ),
        ),
        const SizedBox(width: 8),
        // MRP
        SizedBox(
          width: 72,
          child: TextField(
            controller: widget.item.mrpCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(hintText: 'MRP', isDense: true, prefixText: '₹',
              contentPadding: EdgeInsets.symmetric(horizontal: 4, vertical: 10)),
          ),
        ),
        // Remove
        IconButton(
          onPressed: widget.onRemove,
          icon: Icon(Icons.close, size: 18, color: widget.onRemove != null ? const Color(0xFF9CA3AF) : Colors.transparent),
          padding: EdgeInsets.zero,
          visualDensity: VisualDensity.compact,
        ),
      ]),
      const SizedBox(height: 10),
    ]);
  }
}
