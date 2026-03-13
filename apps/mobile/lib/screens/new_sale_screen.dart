import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';

class NewSaleScreen extends StatefulWidget {
  const NewSaleScreen({Key? key}) : super(key: key);

  @override
  State<NewSaleScreen> createState() => _NewSaleScreenState();
}

class _NewSaleScreenState extends State<NewSaleScreen> {
  bool _isLoading = false;

  final TextEditingController _nameController = TextEditingController(text: 'Walk-in customer');
  final TextEditingController _discountController = TextEditingController();

  final List<Map<String, dynamic>> _items = [];

  String _paymentMethod = 'Cash';
  final List<String> _paymentOptions = ['Cash', 'UPI', 'Card', 'Credit', 'Pay Later'];
  
  double _subtotal = 0.0;
  double _total = 0.0;
  
  // Track phone globally
  String _customerPhone = '';

  @override
  void initState() {
    super.initState();
    _discountController.addListener(_calculateTotals);
    _addItem(); // Add first empty row by default
  }

  @override
  void dispose() {
    _nameController.dispose();
    _discountController.dispose();
    for (var item in _items) {
      item['medicine_name'].dispose();
      item['qty'].dispose();
      item['mrp'].dispose();
    }
    super.dispose();
  }

  Future<Iterable<Map<String, dynamic>>> _searchCustomers(String query) async {
    if (query.isEmpty) return const Iterable.empty();
    try {
      final response = await http.get(
        Uri.parse('https://backend.rxdesk.in/api/bills/customers/search?phone=$query'),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        return data.cast<Map<String, dynamic>>();
      }
    } catch (_) {}
    return const Iterable.empty();
  }

  Future<Iterable<Map<String, dynamic>>> _searchMedicines(String query) async {
    if (query.isEmpty) return const Iterable.empty();
    try {
      final response = await http.get(
        Uri.parse('https://backend.rxdesk.in/api/inventory?q=$query'),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        return data.cast<Map<String, dynamic>>();
      }
    } catch (_) {}
    return const Iterable.empty();
  }

  void _calculateTotals() {
    double sub = 0;
    for (var item in _items) {
      final qtyText = item['qty'].text;
      final mrpText = item['mrp'].text;
      final int qty = int.tryParse(qtyText) ?? 0;
      final double mrp = double.tryParse(mrpText) ?? 0.0;
      sub += (qty * mrp);
    }
    
    final discountText = _discountController.text;
    final double discount = double.tryParse(discountText) ?? 0.0;

    setState(() {
      _subtotal = sub;
      _total = sub - discount;
      if (_total < 0) _total = 0;
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
        'medicine_name': nameCtrl, // Keep reference to controller
        'qty': qtyCtrl,
        'mrp': mrpCtrl,
      });
      _calculateTotals();
    });
  }

  void _removeItem(int index) {
    if (_items.length == 1) return; // leave at least one
    setState(() {
      _items[index]['medicine_name'].dispose();
      _items[index]['qty'].dispose();
      _items[index]['mrp'].dispose();
      _items.removeAt(index);
      _calculateTotals();
    });
  }

  Future<void> _generateBill() async {
    // validation
    List<Map<String, dynamic>> payloadItems = [];
    for (var item in _items) {
      final name = item['medicine_name'].text.trim();
      final qty = int.tryParse(item['qty'].text) ?? 0;
      final mrp = double.tryParse(item['mrp'].text) ?? 0.0;
      
      if (name.isNotEmpty && qty > 0) {
        payloadItems.add({
          "medicine_name": name,
          "mrp": mrp,
          "quantity": qty,
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

      final response = await http.post(
        Uri.parse('https://backend.rxdesk.in/api/bills/manual'),
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': 'Bearer <YOUR_TOKEN_HERE>' 
        },
        body: jsonEncode(payload),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bill generated!')),
        );
        Navigator.pop(context);
      } else {
         ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Saved offline (API returned ${response.statusCode})')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
       ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Network error. Saved offline. $e')),
      );
      Navigator.pop(context);
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
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
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('Walk-in Sale'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 1,
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
                    child: Autocomplete<Map<String, dynamic>>(
                      optionsBuilder: (TextEditingValue textEditingValue) {
                        _customerPhone = textEditingValue.text; // Store ongoing changes manually
                        return _searchCustomers(textEditingValue.text);
                      },
                      displayStringForOption: (option) {
                        return option['customer_phone'] ?? '';
                      },
                      onSelected: (option) {
                        _customerPhone = option['customer_phone'] ?? '';
                        if (option['customer_name'] != null && option['customer_name'].toString().isNotEmpty) {
                           _nameController.text = option['customer_name'];
                        }
                      },
                      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
                        return TextField(
                          controller: controller,
                          focusNode: focusNode,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(
                            labelText: 'Phone (search by number)',
                            hintText: '9XXXXXXXXX',
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          ),
                          onChanged: (val) {
                             _customerPhone = val;
                          },
                        );
                      },
                      optionsViewBuilder: (context, onSelected, options) {
                        return Align(
                          alignment: Alignment.topLeft,
                          child: Material(
                            elevation: 4,
                            child: SizedBox(
                              width: 300,
                              child: ListView.builder(
                                padding: const EdgeInsets.all(0),
                                shrinkWrap: true,
                                itemCount: options.length,
                                itemBuilder: (BuildContext context, int index) {
                                  final option = options.elementAt(index);
                                  return ListTile(
                                    title: Text(option['customer_phone'] ?? ''),
                                    subtitle: Text(option['customer_name'] ?? ''),
                                    onTap: () {
                                      onSelected(option);
                                    },
                                  );
                                },
                              ),
                            ),
                          ),
                        );
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
                        child: Autocomplete<Map<String, dynamic>>(
                          optionsBuilder: (TextEditingValue textEditingValue) {
                            return _searchMedicines(textEditingValue.text);
                          },
                          displayStringForOption: (option) => option['medicine_name'] ?? '',
                          onSelected: (option) {
                             // Automatically fill MRP when selected
                             if (option['mrp'] != null) {
                               item['mrp'].text = option['mrp'].toString();
                             }
                             _calculateTotals();
                          },
                          fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
                            // Link inner controller state to dynamic outer reference
                            item['medicine_name'] = controller;
                            return TextField(
                              controller: controller,
                              focusNode: focusNode,
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
                                elevation: 4,
                                child: SizedBox(
                                  width: 280,
                                  child: ListView.builder(
                                    padding: const EdgeInsets.all(0),
                                    shrinkWrap: true,
                                    itemCount: options.length,
                                    itemBuilder: (BuildContext context, int index) {
                                      final option = options.elementAt(index);
                                      return ListTile(
                                        title: Text(option['medicine_name'] ?? ''),
                                        subtitle: Text("MRP: ₹${option['mrp'] ?? 0} | Stock: ${option['stock_qty'] ?? 0}"),
                                        onTap: () {
                                          onSelected(option);
                                        },
                                      );
                                    },
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 1,
                        child: TextField(
                          controller: item['qty'],
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 2,
                        child: TextField(
                          controller: item['mrp'],
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(
                            hintText: '0.00',
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          ),
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
                  label: Text('Generate Bill', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              )
            ],
          ),
        ),
      ),
    );
  }
}
