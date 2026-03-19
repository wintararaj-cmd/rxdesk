// lib/services/api_service.dart
// Central HTTP client — attaches Bearer token to every request automatically

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'auth_service.dart';

class ApiService {
  static const String _base = 'https://backend.rxdesk.in/api/v1';

  // ── helpers ──────────────────────────────────────────────────────────────
  static Future<Map<String, String>> _headers({bool auth = true}) async {
    final h = <String, String>{'Content-Type': 'application/json'};
    if (auth) {
      final token = await AuthService.getAccessToken();
      if (token != null) h['Authorization'] = 'Bearer $token';
    }
    return h;
  }

  static Map<String, dynamic> _decode(http.Response r) {
    final body = jsonDecode(r.body) as Map<String, dynamic>;
    if (r.statusCode >= 200 && r.statusCode < 300) return body;
    final err = body['error'];
    final msg = (err is Map ? err['message'] : err?.toString()) ?? 'Unknown error (${r.statusCode})';
    throw ApiException(msg, r.statusCode);
  }

  // ── AUTH ─────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> sendOtp(String phone) async {
    final r = await http.post(Uri.parse('$_base/auth/otp/send'),
        headers: await _headers(auth: false), body: jsonEncode({'phone': phone}));
    return _decode(r);
  }

  static Future<Map<String, dynamic>> verifyOtp(
      String phone, String otp, String otpRef) async {
    final r = await http.post(Uri.parse('$_base/auth/otp/verify'),
        headers: await _headers(auth: false),
        body: jsonEncode({'phone': phone, 'otp': otp, 'otp_ref': otpRef}));
    return _decode(r);
  }

  static Future<Map<String, dynamic>> loginWithPassword(
      String phone, String password) async {
    final r = await http.post(Uri.parse('$_base/auth/login'),
        headers: await _headers(auth: false),
        body: jsonEncode({'phone': phone, 'password': password}));
    return _decode(r);
  }

  static Future<Map<String, dynamic>> setPassword(
      String password, String confirm) async {
    final r = await http.post(Uri.parse('$_base/auth/password/set'),
        headers: await _headers(),
        body: jsonEncode({'password': password, 'confirm_password': confirm}));
    return _decode(r);
  }

  static Future<void> logout() async {
    try {
      await http.post(Uri.parse('$_base/auth/logout'), headers: await _headers());
    } catch (_) {}
    await AuthService.clearSession();
  }

  // ── SHOP ─────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getMyShop() async {
    final r = await http.get(Uri.parse('$_base/shops/me'), headers: await _headers());
    return _decode(r);
  }

  static Future<Map<String, dynamic>> getShopDashboard() async {
    final r = await http.get(Uri.parse('$_base/shops/me/dashboard'), headers: await _headers());
    return _decode(r);
  }

  static Future<List<dynamic>> getTodayAppointments({String? date}) async {
    final uri = Uri.parse('$_base/appointments/today')
        .replace(queryParameters: date != null ? {'date': date} : null);
    final r = await http.get(uri, headers: await _headers());
    return _decode(r)['data'] as List;
  }

  // ── INVENTORY ────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getInventory(
      {int page = 1, String? q, bool lowStock = false, int limit = 20}) async {
    final params = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (q != null && q.isNotEmpty) params['q'] = q;
    if (lowStock) params['low_stock'] = 'true';
    final uri = Uri.parse('$_base/inventory').replace(queryParameters: params);
    final r = await http.get(uri, headers: await _headers());
    return _decode(r);
  }

  static Future<List<dynamic>> searchInventory(String q) async {
    final uri = Uri.parse('$_base/inventory').replace(queryParameters: {'q': q, 'limit': '10'});
    final r = await http.get(uri, headers: await _headers());
    return (_decode(r)['data'] as List?) ?? [];
  }

  // ── BILLING ──────────────────────────────────────────────────────────────
  static Future<List<dynamic>> searchCustomers(String phone) async {
    final uri = Uri.parse('$_base/bills/customers/search')
        .replace(queryParameters: {'phone': phone});
    final r = await http.get(uri, headers: await _headers());
    return (_decode(r)['data'] as List?) ?? [];
  }

  static Future<Map<String, dynamic>> createManualBill(
      Map<String, dynamic> payload) async {
    final r = await http.post(Uri.parse('$_base/bills/manual'),
        headers: await _headers(), body: jsonEncode(payload));
    return _decode(r);
  }

  static Future<List<dynamic>> getBills({int page = 1}) async {
    final uri = Uri.parse('$_base/bills')
        .replace(queryParameters: {'page': page.toString(), 'limit': '20'});
    final r = await http.get(uri, headers: await _headers());
    return (_decode(r)['data'] as List?) ?? [];
  }

  // ── DOCTOR ───────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getDoctorProfile() async {
    final r = await http.get(Uri.parse('$_base/doctors/me'), headers: await _headers());
    return _decode(r);
  }

  static Future<List<dynamic>> getDoctorAppointments() async {
    final r = await http.get(Uri.parse('$_base/appointments/today'), headers: await _headers());
    return (_decode(r)['data'] as List?) ?? [];
  }

  // ── PATIENT ──────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getPatientProfile() async {
    final r = await http.get(Uri.parse('$_base/patients/me'), headers: await _headers());
    return _decode(r);
  }

  static Future<List<dynamic>> getPatientAppointments() async {
    final r = await http.get(Uri.parse('$_base/patients/me/appointments'), headers: await _headers());
    return (_decode(r)['data'] as List?) ?? [];
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);
  @override
  String toString() => message;
}
