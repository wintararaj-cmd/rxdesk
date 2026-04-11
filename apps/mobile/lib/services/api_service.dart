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

  static Future<bool> _refresh() async {
    try {
      final rt = await AuthService.getRefreshToken();
      if (rt == null) return false;
      final r = await http.post(
        Uri.parse('$_base/auth/token/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refresh_token': rt}),
      );
      if (r.statusCode == 200) {
        final body = jsonDecode(r.body);
        final data = body['data'];
        final newRT = data['refresh_token'] ?? rt; // Keep old one if not rotated
        await AuthService.saveSession(
          accessToken: data['access_token'],
          refreshToken: newRT,
          role: await AuthService.getRole() ?? '',
        );
        return true;
      }
    } catch (_) {}
    return false;
  }

  static Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    dynamic body,
    Map<String, String>? query,
    bool auth = true,
  }) async {
    final uri = Uri.parse('$_base$path').replace(queryParameters: query);
    
    Future<http.Response> doReq(String token) async {
      final h = <String, String>{'Content-Type': 'application/json'};
      if (auth) h['Authorization'] = 'Bearer $token';
      
      final b = body != null ? jsonEncode(body) : null;
      switch (method.toUpperCase()) {
        case 'POST': return http.post(uri, headers: h, body: b);
        case 'PUT': return http.put(uri, headers: h, body: b);
        case 'PATCH': return http.patch(uri, headers: h, body: b);
        case 'DELETE': return http.delete(uri, headers: h);
        default: return http.get(uri, headers: h);
      }
    }

    String? token = auth ? await AuthService.getAccessToken() : null;
    var r = await doReq(token ?? '');

    if (r.statusCode == 401 && auth) {
      final ok = await _refresh();
      if (ok) {
        token = await AuthService.getAccessToken();
        r = await doReq(token ?? '');
      }
    }

    return _decode(r);
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
    return _request('POST', '/auth/otp/send', body: {'phone': phone}, auth: false);
  }

  static Future<Map<String, dynamic>> verifyOtp(String phone, String otp, String otpRef) async {
    return _request('POST', '/auth/otp/verify', body: {'phone': phone, 'otp': otp, 'otp_ref': otpRef}, auth: false);
  }

  static Future<Map<String, dynamic>> loginWithPassword(String phone, String password) async {
    return _request('POST', '/auth/login', body: {'phone': phone, 'password': password}, auth: false);
  }

  static Future<Map<String, dynamic>> setPassword(String password, String confirm) async {
    return _request('POST', '/auth/password/set', body: {'password': password, 'confirm_password': confirm});
  }

  static Future<void> logout() async {
    try {
      await _request('POST', '/auth/logout');
    } catch (_) {}
    await AuthService.clearSession();
  }

  static Future<void> deactivateAccount() async {
    await _request('DELETE', '/auth/account');
    await AuthService.clearSession();
  }

  // ── SHOP ─────────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getMyShop() async {
    return _request('GET', '/shops/me');
  }

  static Future<Map<String, dynamic>> getShopDashboard() async {
    return _request('GET', '/shops/me/dashboard');
  }

  static Future<Map<String, dynamic>> updateShopProfile(Map<String, dynamic> data) async {
    return _request('PUT', '/shops/me', body: data);
  }

  static Future<List<dynamic>> getTodayAppointments({String? date}) async {
    final res = await _request('GET', '/appointments/today', query: date != null ? {'date': date} : null);
    return res['data'] as List;
  }

  // ── INVENTORY ────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getInventory({int page = 1, String? q, bool lowStock = false, int limit = 20}) async {
    final query = {'page': page.toString(), 'limit': limit.toString()};
    if (q != null && q.isNotEmpty) query['q'] = q;
    if (lowStock) query['low_stock'] = 'true';
    return _request('GET', '/inventory', query: query);
  }

  static Future<Map<String, dynamic>> getInventoryMaster({String? q}) async {
    return _request('GET', '/inventory/master', query: q != null && q.isNotEmpty ? {'q': q} : null);
  }

  static Future<List<dynamic>> getMasterBatches(String masterId) async {
    final res = await _request('GET', '/inventory/master/$masterId/batches');
    return (res['data'] as List?) ?? [];
  }
  
  static Future<Map<String, dynamic>> addInventoryItem(Map<String, dynamic> data) async {
    return _request('POST', '/inventory', body: data);
  }

  static Future<Map<String, dynamic>> updateInventoryItem(String id, Map<String, dynamic> data) async {
    return _request('PUT', '/inventory/$id', body: data);
  }

  static Future<Map<String, dynamic>> patchInventoryMaster(String id, Map<String, dynamic> data) async {
    return _request('PATCH', '/inventory/master/$id', body: data);
  }

  static Future<void> deleteInventoryItem(String id) async {
    await _request('DELETE', '/inventory/$id');
  }

  static Future<List<dynamic>> searchInventory(String q) async {
    final res = await _request('GET', '/inventory', query: {'q': q, 'limit': '10'});
    return (res['data'] as List?) ?? [];
  }

  static Future<Map<String, dynamic>> getInventoryByBarcode(String barcode) async {
    return _request('GET', '/inventory/barcode/$barcode');
  }

  // ── BILLING ──────────────────────────────────────────────────────────────
  static Future<List<dynamic>> searchCustomers(String phone) async {
    final res = await _request('GET', '/bills/customers/search', query: {'phone': phone});
    return (res['data'] as List?) ?? [];
  }

  static Future<Map<String, dynamic>> createManualBill(Map<String, dynamic> payload) async {
    return _request('POST', '/bills/manual', body: payload);
  }

  static Future<List<dynamic>> getBills({int page = 1}) async {
    final res = await _request('GET', '/bills', query: {'page': page.toString(), 'limit': '20'});
    return (res['data'] as List?) ?? [];
  }

  static Future<Map<String, dynamic>> voidBill(String id) async {
    return _request('DELETE', '/bills/$id');
  }

  // ── DOCTOR ───────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getDoctorProfile() async {
    return _request('GET', '/doctors/me');
  }

  static Future<Map<String, dynamic>> updateDoctorProfile(Map<String, dynamic> data) async {
    return _request('PUT', '/doctors/me', body: data);
  }

  static Future<List<dynamic>> getDoctorAppointments() async {
    final res = await _request('GET', '/appointments/today');
    return (res['data'] as List?) ?? [];
  }

  static Future<Map<String, dynamic>> updateAppointmentStatus(String id, String status, {String? reason}) async {
    return _request('PATCH', '/appointments/$id/status', body: {'status': status, if (reason != null) 'cancel_reason': reason});
  }

  static Future<List<dynamic>> getDoctorIssuedPrescriptions() async {
    final res = await _request('GET', '/prescriptions/my-issued');
    return (res['data'] as List?) ?? [];
  }

  static Future<Map<String, dynamic>> searchDoctors({String? q, String? spec, String? city}) async {
    final query = <String, String>{};
    if (q != null && q.isNotEmpty) query['q'] = q;
    if (spec != null && spec.isNotEmpty) query['specialization'] = spec;
    if (city != null && city.isNotEmpty) query['city'] = city;
    return _request('GET', '/doctors/search', query: query, auth: false);
  }

  // ── PATIENT ──────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getPatientProfile() async {
    return _request('GET', '/patients/me');
  }

  static Future<List<dynamic>> getPatientAppointments() async {
    final res = await _request('GET', '/patients/me/appointments');
    return (res['data'] as List?) ?? [];
  }

  static Future<List<dynamic>> getPatientPrescriptions() async {
    final res = await _request('GET', '/prescriptions/my');
    return (res['data'] as List?) ?? [];
  }

  static Future<Map<String, dynamic>> updatePatientProfile(Map<String, dynamic> data) async {
    return _request('PUT', '/patients/me', body: data);
  }

  static Future<Map<String, dynamic>> cancelAppointment(String id, {String? reason}) async {
    return _request('PATCH', '/appointments/$id/status', body: {'status': 'cancelled', if (reason != null) 'cancel_reason': reason});
  }

  // ── PRESCRIPTIONS ───────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> createPrescription(Map<String, dynamic> payload) async {
    return _request('POST', '/prescriptions', body: payload);
  }
  
  static Future<void> deletePrescription(String id) async {
    await _request('DELETE', '/prescriptions/$id');
  }

  // ── TEMPLATES ────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> getDoctorStats() async {
    return _request('GET', '/doctors/me/stats');
  }

  static Future<Map<String, dynamic>> getDoctorEarnings() async {
    return _request('GET', '/doctors/me/earnings');
  }

  static Future<List<dynamic>> getDoctorTemplates() async {
    final res = await _request('GET', '/prescriptions/templates');
    return (res['data'] as List?) ?? [];
  }

  static Future<Map<String, dynamic>> createDoctorTemplate(Map<String, dynamic> payload) async {
    return _request('POST', '/prescriptions/templates', body: payload);
  }

  static Future<void> deleteDoctorTemplate(String id) async {
    await _request('DELETE', '/prescriptions/templates/$id');
  }

  static Future<List<dynamic>> searchPatients(String q) async {
    final res = await _request('GET', '/patients/search', query: {'q': q});
    return (res['data'] as List?) ?? [];
  }

  static Future<List<dynamic>> searchMedicines(String q) async {
    final res = await _request('GET', '/medicines/search', query: {'q': q, 'limit': '10'});
    return (res['data'] as List?) ?? [];
  }

  static Future<Map<String, dynamic>> searchShops({String? q, String? city}) async {
    final query = <String, String>{};
    if (q != null && q.isNotEmpty) query['q'] = q;
    if (city != null && city.isNotEmpty) query['city'] = city;
    return _request('GET', '/shops/search', query: query, auth: false);
  }

  // ── NEW TOOLS ────────────────────────────────────────────────────────────
  static Future<Map<String, dynamic>> searchComposition(String q) async {
    return _request('GET', '/medicines/composition-search', query: {'q': q});
  }

  static Future<List<dynamic>> getNearbyShops({double? lat, double? lng, double radius = 5}) async {
    final query = {'radius': radius.toString()};
    if (lat != null) query['lat'] = lat.toString();
    if (lng != null) query['lng'] = lng.toString();
    final res = await _request('GET', '/shops/nearby', query: query, auth: false);
    return (res['data'] as List?) ?? [];
  }

  // ── CHAMBERS & SCHEDULE ──────────────────────────────────────────────────
  static Future<List<dynamic>> getDoctorChambers() async {
    final res = await _request('GET', '/chambers/mine');
    return (res['data'] as List?) ?? [];
  }

  static Future<Map<String, dynamic>> updateChamberSchedule(String chamberId, List<dynamic> schedules) async {
    return _request('PUT', '/chambers/$chamberId/schedule', body: schedules);
  }

  static Future<Map<String, dynamic>> markChamberLeave(String chamberId, String date, String reason) async {
    return _request('POST', '/chambers/$chamberId/leave', body: {'leave_date': date, 'reason': reason});
  }

  // ── ELITE TOOLS & COMPLIANCE ─────────────────────────────────────────────
  static Future<Map<String, dynamic>> checkInteractions(List<String> medicineNames) async {
    return _request('POST', '/medicines/check-interactions', body: {'medicine_names': medicineNames});
  }

  static Future<Map<String, dynamic>> getGstSummary({required int month, required int year}) async {
    return _request('GET', '/accounting/reports/gst-summary', query: {
      'month': month.toString(),
      'year': year.toString(),
    });
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);
  @override
  String toString() => message;
}
