import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:async';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/api_service.dart';

class NewSaleScreen extends StatefulWidget {
  const NewSaleScreen({Key? key}) : super(key: key);

  @override
  State<NewSaleScreen> createState() => _NewSaleScreenState();
}

class _NewSaleScreenState extends State<NewSaleScreen> {
  bool _isLoading = false;
  Map<String, dynamic>? _shopProfile;

  final TextEditingController _nameController = TextEditingController(text: 'Walk-in customer');
  final TextEditingController _discountController = TextEditingController();

  final List<Map<String, dynamic>> _items = [];

  String _paymentMethod = 'Cash';
  final List<String> _paymentOptions = ['Cash', 'UPI', 'Card', 'Credit', 'Pay Later'];
  
  double _subtotal = 0.0;
  double _total = 0.0;
  double _gstAmount = 0.0;
  
  // Track phone globally
  String _customerPhone = '';

  @override
  void initState() {
    super.initState();
    _fetchShopProfile();
    _discountController.addListener(_calculateTotals);
    _addItem(); // Add first empty row by default
  }

  @override
  void dispose() {
    _nameController.dispose();
    _discountController.dispose();
    for (var item in _items) {
      item['medicine_name_ctrl'].dispose();
      item['qty'].dispose();
      item['mrp'].dispose();
    }
    super.dispose();
  }

  Future<void> _fetchShopProfile() async {
    try {
      final res = await ApiService.getMyShop();
      if (mounted) {
        setState(() {
          _shopProfile = res['data'];
        });
        _calculateTotals();
      }
    } catch (_) {}
  }

  Future<Iterable<Map<String, dynamic>>> _searchCustomers(String query) async {
    if (query.isEmpty) return const Iterable.empty();
    try {
      final data = await ApiService.searchCustomers(query);
      return data.cast<Map<String, dynamic>>();
    } catch (_) {}
    return const Iterable.empty();
  }

  Future<Iterable<Map<String, dynamic>>> _searchMedicines(String query) async {
    if (query.isEmpty) return const Iterable.empty();
    try {
      // Use the master inventory search for total stock visibility
      final res = await ApiService.getInventoryMaster(q: query);
      final data = res['data'] as List;
      return data.cast<Map<String, dynamic>>();
    } catch (_) {}
    return const Iterable.empty();
  }

  void _calculateTotals() {
    double sub = 0;
    double gst = 0;
    
    // Check if we should calculate GST (only for regular shops)
    final bool isRegularShop = _shopProfile?['gst_type'] == 'regular';

    for (var item in _items) {
      final qtyText = item['qty'].text;
      final mrpText = item['mrp'].text;
      final int qty = int.tryParse(qtyText) ?? 0;
      final double mrp = double.tryParse(mrpText) ?? 0.0;
      final double lineSubtotal = (qty * mrp);
      sub += lineSubtotal;
      
      if (isRegularShop) {
        // Assume 12% as medicine default for local calculation if not specified
        final double rate = (item['gst_rate'] ?? 12.0) / 100.0;
        gst += (lineSubtotal * rate);
      }
    }
    
    final discountText = _discountController.text;
    final double discount = double.tryParse(discountText) ?? 0.0;

    setState(() {
      _subtotal = sub;
      _gstAmount = gst;
      _total = (sub - discount + gst).clamp(0, double.infinity).roundToDouble();
    });
  }

  void _addItem() {
    setState(() {
      final qtyCtrl = TextEditingController(text: '1');
      final mrpCtrl = TextEditingController();
      final nameCtrl = TextEditingController();
      
      qtyCtrl.addListener(_calculateTotals);
      mrpCtrl.addListener(_calculateTotals);

      _items.add({
        'medicine_name_ctrl': nameCtrl, // Avoid shadowing 'medicine_name' key later
        'qty': qtyCtrl,
        'mrp': mrpCtrl,
        'batch_number': '',
        'inventory_id': '',
        'available_batches': [],
        'gst_rate': 12.0, // Default for medicine
      });
      _calculateTotals();
    });
  }

  void _removeItem(int index) {
    if (_items.length == 1) return; // leave at least one
    setState(() {
      _items[index]['medicine_name_ctrl'].dispose();
      _items[index]['qty'].dispose();
      _items[index]['mrp'].dispose();
      _items.removeAt(index);
      _calculateTotals();
    });
  }

  void _reset() {
    // AGGRESSIVE CLEAR: Hard clear of focus and overlays
    FocusManager.instance.primaryFocus?.unfocus();
    
    // NUCLEAR RESET: Re-push the screen to kill all ghost overlays
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (context) => const NewSaleScreen()),
    );
  }

  Future<void> _fetchBatches(int itemIndex, String masterId) async {
    try {
      final batches = await ApiService.getMasterBatches(masterId);
      if (mounted) {
        setState(() {
          _items[itemIndex]['available_batches'] = batches;
          if (batches.isNotEmpty) {
            // Select first batch by default if none selected
            final first = batches[0];
            _items[itemIndex]['inventory_id'] = first['id'] ?? '';
            _items[itemIndex]['batch_number'] = first['batch_number'] ?? '';
            _items[itemIndex]['mrp'].text = (first['mrp'] ?? 0).toString();
          }
        });
        _calculateTotals();
      }
    } catch (_) {}
  }

  void _onBarcodeScan() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.7,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Text('Scan Medicine Barcode', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: MobileScanner(
                  onDetect: (capture) async {
                    final List<Barcode> barcodes = capture.barcodes;
                    if (barcodes.isNotEmpty) {
                      final String? code = barcodes.first.rawValue;
                      if (code != null) {
                        Navigator.pop(context);
                        _lookupBarcode(code);
                      }
                    }
                  },
                ),
              ),
            ),
            const SizedBox(height: 48),
          ],
        ),
      ),
    );
  }

  Future<void> _lookupBarcode(String barcode) async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService.getInventoryByBarcode(barcode);
      final item = res['data'];
      if (item != null) {
        // Add to items list or update last empty one
        setState(() {
          int index = _items.indexWhere((it) => it['medicine_name_ctrl'].text.isEmpty);
          if (index == -1) {
            _addItem();
            index = _items.length - 1;
          }
          
          final master = item['master'];
          _items[index]['medicine_name_ctrl'].text = master['medicine_name'];
          _items[index]['inventory_id'] = item['id'];
          _items[index]['batch_number'] = item['batch_number'];
          _items[index]['mrp'].text = item['mrp'].toString();
          _items[index]['available_batches'] = [item];
        });
        _calculateTotals();
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Barcode Error: $e')));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _generateBill() async {
    // validation
    List<Map<String, dynamic>> payloadItems = [];
    for (var item in _items) {
      final name = item['medicine_name_ctrl'].text.trim();
      final qty = int.tryParse(item['qty'].text) ?? 0;
      final mrp = double.tryParse(item['mrp'].text) ?? 0.0;
      
      if (name.isNotEmpty && qty > 0) {
        payloadItems.add({
          "medicine_name": name,
          "mrp": mrp,
          "quantity": qty,
          "inventory_id": item['inventory_id'],
          "batch_number": item['batch_number'],
        });
      }
    }

    if (payloadItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add at least one valid item with a name and quantity')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      String pm = 'cash';
      if (_paymentMethod == 'UPI') pm = 'upi';
      else if (_paymentMethod == 'Card') pm = 'card';
      else if (_paymentMethod == 'Credit') pm = 'credit';
      else if (_paymentMethod == 'Pay Later') pm = 'pending';

      final payload = {
        "customer_phone": _customerPhone.trim(),
        "customer_name": _nameController.text.trim(),
        "items": payloadItems,
        "discount_amount": double.tryParse(_discountController.text) ?? 0.0,
        "payment_method": pm,
      };

      await ApiService.createManualBill(payload);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bill generated successfully!')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
       ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error generating bill: $e')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _showBatchSelector(int itemIndex) {
    final item = _items[itemIndex];
    final batches = item['available_batches'] as List;
    
    if (batches.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No batches found in inventory. Please add stock in inventory first.')),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Container(
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("Select Batch", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            ...batches.map((b) => ListTile(
              title: Text("Batch: ${b['batch_number'] ?? 'N/A'}"),
              subtitle: Text("Stock: ${b['stock_qty']} | Exp: ${b['expiry_date']?.toString().split('T')[0] ?? 'N/A'}"),
              trailing: Text("₹${b['mrp']}", style: const TextStyle(fontWeight: FontWeight.bold)),
              selected: item['inventory_id'] == b['id'],
              onTap: () {
                setState(() {
                  item['batch_number'] = b['batch_number'] ?? '';
                  item['inventory_id'] = b['id'] ?? '';
                  item['mrp'].text = (b['mrp'] ?? 0).toString();
                });
                _calculateTotals();
                Navigator.pop(ctx);
              },
            )).toList(),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String number, String title, {String? subtitle}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16, top: 16),
      child: Row(
        children: [
          CircleAvatar(
            radius: 12,
            backgroundColor: Colors.deepPurple.shade100,
            child: Text(number, style: const TextStyle(fontSize: 12, color: Colors.deepPurple, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 8),
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          if (subtitle != null) ...[
            const SizedBox(width: 8),
            Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 14)),
          ]
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final String gstType = _shopProfile?['gst_type'] ?? 'unregistered';
    final String headerType = gstType == 'regular' ? 'TAX INVOICE' : 'BILL OF SUPPLY';

    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: Text(headerType, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 1,
        actions: [
          IconButton(
            onPressed: _onBarcodeScan,
            icon: const Icon(Icons.qr_code_scanner, color: Colors.deepPurple),
            tooltip: 'Scan Barcode',
          ),
          TextButton(
            onPressed: _reset,
            child: const Text('Reset', style: TextStyle(color: Colors.deepPurple)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Customer Details
              _buildSectionTitle('1', 'Customer Details', subtitle: '(optional)'),
              Row(
                children: [
                  Expanded(
                    child: CustomerSearchField(
                      initialValue: _customerPhone,
                      onSelected: (option) {
                        setState(() {
                          _customerPhone = option['customer_phone'] ?? '';
                          final String? name = option['customer_name'];
                          _nameController.text = (name != null && name.isNotEmpty) ? name : 'Walk-in customer';
                        });
                      },
                      onChanged: (val) {
                        setState(() {
                          _customerPhone = val;
                        });
                      },
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: TextField(
                      controller: _nameController,
                      decoration: const InputDecoration(
                        labelText: 'Name',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // 2. Medicines / Items
              _buildSectionTitle('2', 'Medicines / Items'),
              Row(
                children: const [
                  Expanded(flex: 3, child: Text('MEDICINE', style: TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.bold))),
                  Expanded(flex: 1, child: Text('QTY', style: TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.bold))),
                  Expanded(flex: 2, child: Text('MRP (₹)', style: TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.bold))),
                  SizedBox(width: 48), // for delete icon space
                ],
              ),
              const SizedBox(height: 8),
              
              ...List.generate(_items.length, (index) {
                final item = _items[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: MedicineSearchField(
                          key: ValueKey("med_${index}_${item['inventory_id']}"),
                          initialValue: item['medicine_name_ctrl'].text,
                          onSelected: (option) {
                            setState(() {
                              item['medicine_name_ctrl'].text = option['medicine_name'] ?? '';
                              _fetchBatches(index, option['id']);
                            });
                          },
                          onChanged: (val) {
                             item['medicine_name_ctrl'].text = val;
                          },
                        ),
                      ),
                      if (item['batch_number']?.toString().isNotEmpty ?? false)
                        Padding(
                          padding: const EdgeInsets.only(top: 4, left: 4),
                          child: InkWell(
                            onTap: () => _showBatchSelector(index),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(4)),
                              child: Text("${item['batch_number']} ▼", style: TextStyle(fontSize: 10, color: Colors.blue.shade700, fontWeight: FontWeight.bold)),
                            ),
                          ),
                        ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 1,
                        child: TextField(
                          controller: item['qty'],
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 2,
                        child: TextField(
                          controller: item['mrp'],
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(hintText: '0.00', border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12)),
                        ),
                      ),
                      SizedBox(
                        width: 48,
                        child: IconButton(
                          icon: const Icon(Icons.close, color: Colors.grey, size: 20),
                          onPressed: () => _removeItem(index),
                        ),
                      )
                    ],
                  ),
                );
              }),
              
              TextButton.icon(
                onPressed: _addItem,
                icon: const Icon(Icons.add, color: Colors.deepPurple),
                label: const Text('Add Item', style: TextStyle(color: Colors.deepPurple, fontWeight: FontWeight.bold)),
              ),
              
              const SizedBox(height: 16),
              
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 3. Discount
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                         _buildSectionTitle('3', 'Discount (₹)', subtitle: '(optional)'),
                         TextField(
                          controller: _discountController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(
                            hintText: '0',
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 24),
                  
                  // 4. Payment Method
                  Expanded(
                     flex: 2,
                     child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildSectionTitle('4', 'Payment Method'),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _paymentOptions.map((option) {
                            final isSelected = _paymentMethod == option;
                            return ChoiceChip(
                              label: Text(option),
                              selected: isSelected,
                              onSelected: (selected) {
                                if (selected) {
                                  setState(() {
                                    _paymentMethod = option;
                                  });
                                }
                              },
                              selectedColor: Colors.deepPurple,
                              labelStyle: TextStyle(
                                color: isSelected ? Colors.white : Colors.black87,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 32),
              
              // Bill Summary
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.deepPurple.shade50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Bill Summary', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Subtotal', style: TextStyle(color: Colors.grey)),
                        Text('₹${_subtotal.toStringAsFixed(2)}', style: const TextStyle(color: Colors.grey)),
                      ],
                    ),
                    if (gstType == 'regular')
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Estimated GST', style: TextStyle(color: Colors.grey)),
                          Text('₹${_gstAmount.toStringAsFixed(2)}', style: const TextStyle(color: Colors.grey)),
                        ],
                      ),
                    ),
                    const Divider(height: 32),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Total', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.deepPurple)),
                        Text('₹${_total.toStringAsFixed(2)}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.deepPurple)),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isLoading ? null : _generateBill,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: Colors.deepPurple.shade300,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  icon: _isLoading 
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.receipt_long, color: Colors.white),
                  label: const Text('Generate Bill', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              )
            ],
          ),
        ),
      ),
    );
  }

  Future<Iterable<Map<String, dynamic>>> _searchCustomers(String query) async {
    if (query.isEmpty) return const Iterable.empty();
    try {
      final data = await ApiService.searchCustomers(query);
      return data.cast<Map<String, dynamic>>();
    } catch (_) {}
    return const Iterable.empty();
  }

  Future<Iterable<Map<String, dynamic>>> _searchMedicines(String query) async {
    if (query.isEmpty) return const Iterable.empty();
    try {
      final res = await ApiService.getInventoryMaster(q: query);
      final data = (res['data'] as List?) ?? [];
      return data.cast<Map<String, dynamic>>();
    } catch (_) {}
    return const Iterable.empty();
  }
}

class MedicineSearchField extends StatefulWidget {
  final String initialValue;
  final Function(Map<String, dynamic>) onSelected;
  final Function(String) onChanged;

  const MedicineSearchField({
    Key? key,
    required this.initialValue,
    required this.onSelected,
    required this.onChanged,
  }) : super(key: key);

  @override
  State<MedicineSearchField> createState() => _MedicineSearchFieldState();
}

class _MedicineSearchFieldState extends State<MedicineSearchField> {
  String? _lastSelectedName;
  // Capture the FocusNode from fieldViewBuilder so we can unfocus it from
  // the correct context when an option is selected (the optionsViewBuilder
  // runs inside an overlay with a different BuildContext).
  FocusNode? _fieldFocusNode;

  @override
  Widget build(BuildContext context) {
    return Autocomplete<Map<String, dynamic>>(
      optionsBuilder: (TextEditingValue textEditingValue) async {
        final query = textEditingValue.text.trim();
        if (query.length < 2 || query == _lastSelectedName) return const Iterable.empty();
        
        try {
          final res = await ApiService.getInventoryMaster(q: query);
          final data = (res['data'] as List?) ?? [];
          return data.cast<Map<String, dynamic>>();
        } catch (_) {
          return const Iterable.empty();
        }
      },
      displayStringForOption: (option) => (option['medicine_name'] ?? '').toString(),
      onSelected: (option) {
        // Unfocus the captured field node — this is the correct focus node
        // for the text field. Using FocusScope.of(context) here would reference
        // the Overlay's context (wrong scope) and the dropdown would not close.
        _fieldFocusNode?.unfocus();
        setState(() {
          _lastSelectedName = option['medicine_name']?.toString();
        });
        widget.onSelected(option);
      },
      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
        // Capture the focus node so onSelected can unfocus it correctly.
        _fieldFocusNode = focusNode;

        if (controller.text != widget.initialValue &&
            widget.initialValue.isNotEmpty &&
            controller.text.isEmpty) {
          controller.text = widget.initialValue;
        }
        return TextField(
          controller: controller,
          focusNode: focusNode,
          onChanged: (val) {
            if (val != _lastSelectedName) {
              setState(() => _lastSelectedName = null);
            }
            widget.onChanged(val);
          },
          decoration: const InputDecoration(
            hintText: 'Medicine name',
            border: OutlineInputBorder(),
            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          ),
        );
      },
      optionsViewBuilder: (context, onSelected, options) {
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 8,
            borderRadius: BorderRadius.circular(12),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 300, maxWidth: 320),
              child: ListView.builder(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: options.length,
                itemBuilder: (BuildContext context, int index) {
                  final option = options.elementAt(index);
                  final totalStock = option['total_stock'] ?? 0;
                  final batches = option['batch_count'] ?? option['batches']?.length ?? '';
                  final soonestExp = option['soonest_expiry']?.toString().split('T')[0] ?? '';
                  return ListTile(
                    title: Text(
                      option['medicine_name'] ?? '',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    subtitle: Text(
                      [
                        'Total Stock: $totalStock',
                        if (batches != '') 'Batches: $batches',
                        if (soonestExp.isNotEmpty) 'Soonest Exp: $soonestExp',
                      ].join(' | '),
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                    onTap: () => onSelected(option),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}

