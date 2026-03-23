// lib/services/api_service.dart
// Central HTTP client — attaches Bearer token to every request automatically

import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'auth_service.dart';

class ApiService {
  static String get _base {
    if (kReleaseMode) {
      return 'https://backend.rxdesk.in/api/v1';
    }
    // Automatically use the development machine IP to support physical devices
    return 'http://192.168.0.116:3000/api/v1';
  }

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

  static Future<Map<String, dynamic>> updateShopProfile(Map<String, dynamic> data) async {
    final r = await http.put(Uri.parse('$_base/shops/me'),
        headers: await _headers(), body: jsonEncode(data));
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
  
  static Future<Map<String, dynamic>> addInventoryItem(Map<String, dynamic> data) async {
    final r = await http.post(Uri.parse('$_base/inventory'),
        headers: await _headers(), body: jsonEncode(data));
    return _decode(r);
  }

  static Future<Map<String, dynamic>> updateInventoryItem(String id, Map<String, dynamic> data) async {
    final r = await http.put(Uri.parse('$_base/inventory/$id'),
        headers: await _headers(), body: jsonEncode(data));
    return _decode(r);
  }

  static Future<void> deleteInventoryItem(String id) async {
    await http.delete(Uri.parse('$_base/inventory/$id'), headers: await _headers());
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

  static Future<Map<String, dynamic>> voidBill(String id) async {
    // Assuming voiding means updating status or deleting
    final r = await http.delete(Uri.parse('$_base/bills/$id'), headers: await _headers());
    return _decode(r);
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

  static Future<Map<String, dynamic>> updateAppointmentStatus(String id, String status, {String? reason}) async {
    final r = await http.patch(Uri.parse('$_base/appointments/$id/status'),
        headers: await _headers(),
        body: jsonEncode({'status': status, if (reason != null) 'cancel_reason': reason}));
    return _decode(r);
  }

  static Future<List<dynamic>> getDoctorIssuedPrescriptions() async {
    final r = await http.get(Uri.parse('$_base/prescriptions/my-issued'), headers: await _headers());
    return (_decode(r)['data'] as List?) ?? [];
  }

  static Future<Map<String, dynamic>> searchDoctors({String? q, String? spec, String? city}) async {
    final params = <String, String>{};
    if (q != null && q.isNotEmpty) params['q'] = q;
    if (spec != null && spec.isNotEmpty) params['specialization'] = spec;
    if (city != null && city.isNotEmpty) params['city'] = city;
    final uri = Uri.parse('$_base/doctors/search').replace(queryParameters: params);
    final r = await http.get(uri, headers: await _headers(auth: false));
    return _decode(r);
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

  static Future<List<dynamic>> getPatientPrescriptions() async {
    final r = await http.get(Uri.parse('$_base/prescriptions/my'), headers: await _headers());
    return (_decode(r)['data'] as List?) ?? [];
  }

  // ── PRESCRIPTIONS ───────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> createPrescription(Map<String, dynamic> payload) async {
    final r = await http.post(Uri.parse('$_base/prescriptions'),
        headers: await _headers(), body: jsonEncode(payload));
    return _decode(r);
  }

  static Future<List<dynamic>> searchPatients(String q) async {
    final uri = Uri.parse('$_base/patients/search').replace(queryParameters: {'q': q});
    final r = await http.get(uri, headers: await _headers());
    return (_decode(r)['data'] as List?) ?? [];
  }

  static Future<List<dynamic>> searchMedicines(String q) async {
    final uri = Uri.parse('$_base/medicines/search').replace(queryParameters: {'q': q, 'limit': '10'});
    final r = await http.get(uri, headers: await _headers());
    return (_decode(r)['data'] as List?) ?? [];
  }

  static Future<Map<String, dynamic>> searchShops({String? q, String? city}) async {
    final params = <String, String>{};
    if (q != null && q.isNotEmpty) params['q'] = q;
    if (city != null && city.isNotEmpty) params['city'] = city;
    final uri = Uri.parse('$_base/shops/search').replace(queryParameters: params);
    final r = await http.get(uri, headers: await _headers(auth: false));
    return _decode(r);
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);
  @override
  String toString() => message;
}
