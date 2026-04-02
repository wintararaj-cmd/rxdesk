import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class ChamberScheduleScreen extends StatefulWidget {
  final dynamic chamber;
  const ChamberScheduleScreen({Key? key, required this.chamber}) : super(key: key);

  @override
  State<ChamberScheduleScreen> createState() => _ChamberScheduleScreenState();
}

class _ChamberScheduleScreenState extends State<ChamberScheduleScreen> {
  bool _loadingPreview = true;
  bool _saving = false;
  
  // Mapping of day index to list of slots
  final Map<int, List<Map<String, dynamic>>> _scheduleMap = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
  };

  final List<String> _days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  @override
  void initState() {
    super.initState();
    _initSchedule();
  }

  void _initSchedule() {
    final existing = widget.chamber['schedules'] as List? ?? [];
    for (var s in existing) {
      final day = s['day_of_week'] as int;
      _scheduleMap[day]!.add({
        'start_time': s['start_time'],
        'end_time': s['end_time'],
        'slot_duration': s['slot_duration'] ?? 15,
        'max_patients': s['max_patients'] ?? 1,
      });
    }
    setState(() => _loadingPreview = false);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final List<Map<String, dynamic>> payload = [];
      _scheduleMap.forEach((day, slots) {
        for (var slot in slots) {
          payload.add({
            'day_of_week': day,
            'start_time': slot['start_time'],
            'end_time': slot['end_time'],
            'slot_duration': slot['slot_duration'],
            'max_patients': slot['max_patients'],
          });
        }
      });

      await ApiService.updateChamberSchedule(widget.chamber['id'], payload);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Schedule updated successfully!')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error saving schedule: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Practice Schedule', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
            Text(widget.chamber['shop']['shop_name'], style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        actions: [
          if (_saving)
            const Center(child: Padding(padding: EdgeInsets.all(16.0), child: CircularProgressIndicator(strokeWidth: 2)))
          else
            TextButton(
              onPressed: _save,
              child: const Text('SAVE', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.blue)),
            )
        ],
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 7,
        itemBuilder: (context, index) {
          return _buildDayCard(index);
        },
      ),
    );
  }

  Widget _buildDayCard(int dayIndex) {
    final slots = _scheduleMap[dayIndex]!;
    final isActive = slots.isNotEmpty;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isActive ? Colors.blue.withOpacity(0.2) : Colors.transparent),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: isActive,
          title: Text(
            _days[dayIndex],
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 16,
              color: isActive ? const Color(0xFF1E293B) : Colors.grey,
            ),
          ),
          subtitle: Text(
            isActive ? '${slots.length} slots configured' : 'Off day',
            style: TextStyle(fontSize: 12, color: isActive ? Colors.blue : Colors.grey),
          ),
          leading: Icon(
            Icons.calendar_today_rounded,
            color: isActive ? Colors.blue : Colors.grey[300],
            size: 20,
          ),
          children: [
            ...slots.map((slot) => _buildSlotItem(dayIndex, slot)).toList(),
            Padding(
              padding: const EdgeInsets.all(16),
              child: OutlinedButton.icon(
                onPressed: () => _addSlot(dayIndex),
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add Time Slot'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.blue,
                  side: BorderSide(color: Colors.blue.withOpacity(0.3)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSlotItem(int dayIndex, Map<String, dynamic> slot) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: () => _pickTimeRange(dayIndex, slot),
              child: Row(
                children: [
                  const Icon(Icons.access_time_rounded, size: 16, color: Colors.blue),
                  const SizedBox(width: 12),
                  Text(
                    '${slot['start_time']} - ${slot['end_time']}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
          Text(
            '${slot['slot_duration']}m',
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.remove_circle_outline, color: Colors.redAccent, size: 20),
            onPressed: () {
              setState(() {
                _scheduleMap[dayIndex]!.remove(slot);
              });
            },
          )
        ],
      ),
    );
  }

  void _addSlot(int dayIndex) {
    setState(() {
      _scheduleMap[dayIndex]!.add({
        'start_time': '10:00',
        'end_time': '14:00',
        'slot_duration': 15,
        'max_patients': 1,
      });
    });
  }

  Future<void> _pickTimeRange(int dayIndex, Map<String, dynamic> slot) async {
    final start = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.parse(slot['start_time'].split(':')[0]),
        minute: int.parse(slot['start_time'].split(':')[1]),
      ),
    );
    if (start == null) return;

    final end = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.parse(slot['end_time'].split(':')[0]),
        minute: int.parse(slot['end_time'].split(':')[1]),
      ),
    );
    if (end == null) return;

    setState(() {
      slot['start_time'] = '${start.hour.toString().padLeft(2, '0')}:${start.minute.toString().padLeft(2, '0')}';
      slot['end_time'] = '${end.hour.toString().padLeft(2, '0')}:${end.minute.toString().padLeft(2, '0')}';
    });
  }
}
