import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class MedicineFinderScreen extends StatefulWidget {
  const MedicineFinderScreen({super.key});
  @override
  State<MedicineFinderScreen> createState() => _MedicineFinderScreenState();
}

class _MedicineFinderScreenState extends State<MedicineFinderScreen> {
  final _ctrl = TextEditingController();
  bool _loading = false;
  String? _genericName;
  List<dynamic> _alternatives = [];

  Future<void> _search() async {
    final q = _ctrl.text.trim();
    if (q.length < 2) return;
    setState(() => _loading = true);
    try {
      final res = await ApiService.searchComposition(q);
      final data = res['data'];
      setState(() {
        _genericName = data['generic_name'];
        _alternatives = data['alternatives'] ?? [];
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Composition Finder')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _ctrl,
              decoration: InputDecoration(
                hintText: 'Search medicine (e.g. Crocin)',
                suffixIcon: IconButton(icon: const Icon(Icons.search), onPressed: _search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onSubmitted: (_) => _search(),
            ),
          ),
          if (_loading) const LinearProgressIndicator(),
          if (_genericName != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: Colors.blue.shade50,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Composition / Generic Name:', style: TextStyle(fontSize: 12, color: Colors.blueGrey)),
                  const SizedBox(height: 4),
                  Text(_genericName!, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.blue)),
                ],
              ),
            ),
          Expanded(
            child: ListView.builder(
              itemCount: _alternatives.length,
              itemBuilder: (context, i) {
                final m = _alternatives[i];
                return ListTile(
                  title: Text(m['name'] ?? ''),
                  subtitle: Text(m['manufacturer'] ?? m['brand_name'] ?? 'Generic'),
                  trailing: m['is_in_stock'] == true
                      ? const Chip(label: Text('In Stock', style: TextStyle(fontSize: 10, color: Colors.white)), backgroundColor: Colors.green)
                      : null,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
