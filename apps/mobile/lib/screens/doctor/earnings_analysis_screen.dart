import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../services/api_service.dart';

class EarningsAnalysisScreen extends StatefulWidget {
  const EarningsAnalysisScreen({Key? key}) : super(key: key);

  @override
  State<EarningsAnalysisScreen> createState() => _EarningsAnalysisScreenState();
}

class _EarningsAnalysisScreenState extends State<EarningsAnalysisScreen> {
  bool _loading = true;
  Map<String, dynamic> _data = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService.getDoctorEarnings();
      setState(() {
        _data = data;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to load earnings: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Earnings Analytics', style: TextStyle(fontWeight: FontWeight.w900)),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildSummaryCard(),
                  const SizedBox(height: 32),
                  const Text(
                    'Revenue Trend (Last 7 Days)',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 24),
                  _buildChart(),
                  const SizedBox(height: 40),
                  const Text(
                    'Daily Breakdown',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  ...(_data['daily_breakdown'] as List).map((day) => _buildBreakdownItem(day)).toList(),
                ],
              ),
            ),
    );
  }

  Widget _buildSummaryCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.indigo[700]!, Colors.indigo[500]!],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.indigo.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TOTAL EARNINGS (THIS MONTH)',
            style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1),
          ),
          const SizedBox(height: 8),
          Text(
            '₹${_data['monthly_total']}',
            style: const TextStyle(color: Colors.white, fontSize: 36, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _buildMiniStat('Today', '₹${_data['daily_total']}'),
              const SizedBox(width: 40),
              _buildMiniStat('Avg/Day', '₹${(_data['monthly_total'] / 30).toStringAsFixed(0)}'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMiniStat(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white60, fontSize: 12)),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildChart() {
    final breakdown = _data['daily_breakdown'] as List;
    final spots = breakdown.asMap().entries.map((e) {
      return FlSpot(e.key.toDouble(), (e.value['amount'] as num).toDouble());
    }).toList();

    return AspectRatio(
      aspectRatio: 1.7,
      child: LineChart(
        LineChartData(
          gridData: FlGridData(show: false),
          titlesData: FlTitlesData(
            leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                getTitlesWidget: (value, meta) {
                  final index = value.toInt();
                  if (index < 0 || index >= breakdown.length) return const Text('');
                  final dateStr = breakdown[index]['date'] as String;
                  return Padding(
                    padding: const EdgeInsets.top(8.0),
                    child: Text(
                      dateStr.substring(8), // Just the day
                      style: TextStyle(color: Colors.grey[400], fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  );
                },
              ),
            ),
          ),
          borderData: FlBorderData(show: false),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              color: Colors.indigo,
              barWidth: 4,
              isStrokeCapRound: true,
              dotData: FlDotData(show: true),
              belowBarData: BarAreaData(
                show: true,
                color: Colors.indigo.withOpacity(0.1),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBreakdownItem(dynamic day) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            day['date'],
            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black87),
          ),
          Text(
            '₹${day['amount']}',
            style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.indigo),
          ),
        ],
      ),
    );
  }
}
