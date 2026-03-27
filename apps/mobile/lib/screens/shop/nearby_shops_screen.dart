import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/api_service.dart';

class NearbyShopsScreen extends StatefulWidget {
  const NearbyShopsScreen({super.key});
  @override
  State<NearbyShopsScreen> createState() => _NearbyShopsScreenState();
}

class _NearbyShopsScreenState extends State<NearbyShopsScreen> {
  final _ctrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  bool _loading = false;
  List<dynamic> _shops = [];

  Future<void> _search() async {
    setState(() => _loading = true);
    try {
      final res = await ApiService.searchShops(q: _ctrl.text.trim(), city: _cityCtrl.text.trim());
      setState(() {
        _shops = res['data'] ?? [];
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  void _call(String phone) async {
    final url = Uri.parse('tel:$phone');
    if (await canLaunchUrl(url)) await launchUrl(url);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nearby Shops')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                TextField(
                  controller: _ctrl,
                  decoration: InputDecoration(
                    hintText: 'Search shop name',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _cityCtrl,
                  decoration: InputDecoration(
                    hintText: 'City / Area',
                    suffixIcon: IconButton(icon: const Icon(Icons.search), onPressed: _search),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onSubmitted: (_) => _search(),
                ),
              ],
            ),
          ),
          if (_loading) const LinearProgressIndicator(),
          Expanded(
            child: ListView.builder(
              itemCount: _shops.length,
              itemBuilder: (context, i) {
                final s = _shops[i];
                return ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.store)),
                  title: Text(s['shop_name'] ?? 'Shop'),
                  subtitle: Text("${s['address_line'] ?? ''}, ${s['city'] ?? ''}"),
                  trailing: IconButton(
                    icon: const Icon(Icons.phone, color: Colors.green),
                    onPressed: () => _call(s['contact_phone'] ?? ''),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
