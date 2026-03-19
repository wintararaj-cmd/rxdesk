// lib/services/auth_service.dart
// Stores access_token + user role in SharedPreferences

import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  static const _kToken   = 'access_token';
  static const _kRefresh = 'refresh_token';
  static const _kRole    = 'user_role';
  static const _kPhone   = 'user_phone';
  static const _kName    = 'user_name';

  static Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
    required String role,
    String? phone,
    String? name,
  }) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setString(_kToken,   accessToken);
    await sp.setString(_kRefresh, refreshToken);
    await sp.setString(_kRole,    role);
    if (phone != null) await sp.setString(_kPhone, phone);
    if (name  != null) await sp.setString(_kName,  name);
  }

  static Future<String?> getAccessToken() async {
    final sp = await SharedPreferences.getInstance();
    return sp.getString(_kToken);
  }

  static Future<String?> getRefreshToken() async {
    final sp = await SharedPreferences.getInstance();
    return sp.getString(_kRefresh);
  }

  static Future<String?> getRole() async {
    final sp = await SharedPreferences.getInstance();
    return sp.getString(_kRole);
  }

  static Future<String?> getPhone() async {
    final sp = await SharedPreferences.getInstance();
    return sp.getString(_kPhone);
  }

  static Future<String?> getName() async {
    final sp = await SharedPreferences.getInstance();
    return sp.getString(_kName);
  }

  static Future<bool> isLoggedIn() async {
    final token = await getAccessToken();
    return token != null && token.isNotEmpty;
  }

  static Future<void> clearSession() async {
    final sp = await SharedPreferences.getInstance();
    await sp.remove(_kToken);
    await sp.remove(_kRefresh);
    await sp.remove(_kRole);
    await sp.remove(_kPhone);
    await sp.remove(_kName);
  }
}
