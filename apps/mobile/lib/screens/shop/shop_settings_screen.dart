// lib/screens/shop/shop_settings_screen.dart
// Shop settings screen with invoice settings

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../../services/api_service.dart';

class ShopSettingsScreen extends StatefulWidget {
  const ShopSettingsScreen({super.key});

  @override
  State<ShopSettingsScreen> createState() => _ShopSettingsScreenState();
}

class _ShopSettingsScreenState extends State<ShopSettingsScreen> {
  Map<String, dynamic>? _shop;
  bool _loading = true;

  // Invoice Settings
  bool _showHsnCode = true;
  bool _showBatchNo = true;
  String _printerType = 'thermal';
  bool _savingInvoice = false;
  bool _detectingLocation = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    setState(() => _loading = true);
    try {
      final res = await ApiService.getMyShop();
      final shop = res['data'] as Map<String, dynamic>?;
      if (shop != null && mounted) {
        setState(() {
          _shop = shop;
          _showHsnCode = shop['show_hsn_code'] ?? true;
          _showBatchNo = shop['show_batch_no'] ?? true;
          _printerType = shop['printer_type'] ?? 'thermal';
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveInvoiceSettings() async {
    setState(() => _savingInvoice = true);
    try {
      await ApiService.updateShopProfile({
        'show_hsn_code': _showHsnCode,
        'show_batch_no': _showBatchNo,
        'printer_type': _printerType,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invoice settings saved successfully'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save settings: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _savingInvoice = false);
    }
  }

  Future<void> _updateLocation() async {
    setState(() => _detectingLocation = true);
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) throw 'Location services are disabled';

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) throw 'Location permissions are denied';
      }
      if (permission == LocationPermission.deniedForever) throw 'Location permissions are permanently denied';

      Position position = await Geolocator.getCurrentPosition();
      
      await ApiService.updateShopProfile({
        'latitude': position.latitude,
        'longitude': position.longitude,
      });

      await _loadSettings(); // Refresh UI with new coords

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Location updated: ${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)}'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update location: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _detectingLocation = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Invoice Settings'),
        backgroundColor: const Color(0xFF7C3AED),
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Invoice Settings Section
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Invoice Settings',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1F2937),
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Configure how your invoices are generated and printed.',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Show HSN Code
                      SwitchListTile(
                        title: const Text(
                          'HSN Code wise',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1F2937),
                          ),
                        ),
                        subtitle: const Text(
                          'Show HSN code on invoices',
                          style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
                        ),
                        value: _showHsnCode,
                        activeColor: const Color(0xFF7C3AED),
                        onChanged: (value) {
                          setState(() => _showHsnCode = value);
                        },
                      ),
                      const Divider(),

                      // Show Batch Number
                      SwitchListTile(
                        title: const Text(
                          'Batch No',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1F2937),
                          ),
                        ),
                        subtitle: const Text(
                          'Show batch number on invoices',
                          style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
                        ),
                        value: _showBatchNo,
                        activeColor: const Color(0xFF7C3AED),
                        onChanged: (value) {
                          setState(() => _showBatchNo = value);
                        },
                      ),
                      const Divider(),

                      // Printer Type
                      const ListTile(
                        title: Text(
                          'Printer Settings',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1F2937),
                          ),
                        ),
                        subtitle: Text(
                          'Select your printer type',
                          style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          children: [
                            RadioListTile<String>(
                              title: const Text('Thermal Printer'),
                              subtitle: const Text(
                                'Invoices formatted for thermal/pos printers',
                                style: TextStyle(fontSize: 11),
                              ),
                              value: 'thermal',
                              groupValue: _printerType,
                              activeColor: const Color(0xFF7C3AED),
                              onChanged: (value) {
                                setState(() => _printerType = value!);
                              },
                            ),
                            RadioListTile<String>(
                              title: const Text('A4 Printer'),
                              subtitle: const Text(
                                'Invoices formatted for A4 paper size',
                                style: TextStyle(fontSize: 11),
                              ),
                              value: 'a4',
                              groupValue: _printerType,
                              activeColor: const Color(0xFF7C3AED),
                              onChanged: (value) {
                                setState(() => _printerType = value!);
                              },
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Save Button
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: (_savingInvoice || _detectingLocation) ? null : _saveInvoiceSettings,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF7C3AED),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                          child: _savingInvoice
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text(
                                  'Save Invoice Settings',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 16,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Shop Location Section
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Shop Location',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1F2937),
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Update your exact shop coordinates for better discoverability by patients.',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                      const SizedBox(height: 20),

                      if (_shop != null && _shop?['latitude'] != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 20),
                          child: Row(
                            children: [
                              const Icon(Icons.location_on, color: Color(0xFF7C3AED), size: 20),
                              const SizedBox(width: 8),
                              Text(
                                "Currently marked at: ${_shop?['latitude'].toString().substring(0, 7)}, ${_shop?['longitude'].toString().substring(0, 7)}",
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF374151)),
                              ),
                            ],
                          ),
                        )
                      else
                        const Padding(
                          padding: const EdgeInsets.only(bottom: 20),
                          child: Text(
                            "Location not yet set. Detection highly recommended.",
                            style: TextStyle(fontSize: 13, color: Colors.orange, fontWeight: FontWeight.w600),
                          ),
                        ),

                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: (_savingInvoice || _detectingLocation) ? null : _updateLocation,
                          icon: _detectingLocation 
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF7C3AED)))
                            : const Icon(Icons.my_location),
                          label: Text(_detectingLocation ? 'DETECTING...' : 'DETECT & UPDATE LOCATION'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF7C3AED),
                            side: const BorderSide(color: Color(0xFF7C3AED)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 40),
              ],
            ),
    );
  }
}
