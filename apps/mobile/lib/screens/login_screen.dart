// lib/screens/login_screen.dart
// Single login screen — OTP flow + optional password login
// After login, routes to correct home based on role

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import 'shop/shop_home.dart';
import 'doctor/doctor_home.dart';
import 'patient/patient_home.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

enum _Step { phone, otp, password, setPassword }

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  _Step _step = _Step.phone;
  bool _usePassword = false;

  final _phoneCtrl    = TextEditingController();
  final _otpCtrl      = TextEditingController();
  final _passCtrl     = TextEditingController();
  final _confirmCtrl  = TextEditingController();
  String _otpRef      = '';
  bool   _loading     = false;
  String _error       = '';
  bool   _showPass    = false;

  late final AnimationController _fadeCtrl;
  late final Animation<double> _fadeAnim;

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeIn);
    _fadeCtrl.forward();
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    _phoneCtrl.dispose(); _otpCtrl.dispose();
    _passCtrl.dispose();  _confirmCtrl.dispose();
    super.dispose();
  }

  void _setStep(_Step s) {
    _fadeCtrl.forward(from: 0);
    setState(() { _step = s; _error = ''; });
  }

  void _setError(String e) => setState(() { _error = e; _loading = false; });

  String _normalizePhone(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('91') && digits.length == 12) return '+$digits';
    if (digits.length == 10) return '+91$digits';
    return '+$digits';
  }

  // ── STEP 1: Send OTP ──────────────────────────────────────────────────────
  Future<void> _sendOtp() async {
    final phone = _normalizePhone(_phoneCtrl.text.trim());
    if (phone.length < 12) { _setError('Enter a valid 10-digit phone number'); return; }
    setState(() { _loading = true; _error = ''; });
    try {
      final res = await ApiService.sendOtp(phone);
      _otpRef = res['data']?['otp_ref'] ?? res['otp_ref'] ?? '';
      _setStep(_Step.otp);
    } on ApiException catch (e) {
      _setError(e.message);
    } catch (e) {
      _setError('Network error: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── STEP 2a: Verify OTP → login ───────────────────────────────────────────
  Future<void> _verifyOtp() async {
    if (_otpCtrl.text.trim().length != 6) { _setError('Enter the 6-digit OTP'); return; }
    setState(() { _loading = true; _error = ''; });
    try {
      final phone = _normalizePhone(_phoneCtrl.text.trim());
      final res = await ApiService.verifyOtp(phone, _otpCtrl.text.trim(), _otpRef);
      final data = res['data'] as Map<String, dynamic>;
      final accessToken  = data['access_token']  as String;
      final refreshToken = data['refresh_token']  as String;
      final user   = data['user'] as Map<String, dynamic>? ?? {};
      final role   = user['role'] as String? ?? 'patient';
      final requiresSetup = user['requires_password_setup'] as bool? ?? false;

      await AuthService.saveSession(
        accessToken: accessToken,
        refreshToken: refreshToken,
        role: role,
        phone: phone,
        name: user['name']?.toString(),
      );

      if (requiresSetup) {
        // First login — ask to set a password
        _setStep(_Step.setPassword);
        return;
      }
      if (mounted) _routeToHome(role);
    } on ApiException catch (e) {
      _setError(e.message);
    } catch (e) {
      _setError('Login failed: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── STEP 2b: Password login ───────────────────────────────────────────────
  Future<void> _loginWithPassword() async {
    if (_passCtrl.text.trim().isEmpty) { _setError('Enter your password'); return; }
    setState(() { _loading = true; _error = ''; });
    try {
      final phone = _normalizePhone(_phoneCtrl.text.trim());
      final res = await ApiService.loginWithPassword(phone, _passCtrl.text.trim());
      final data = res['data'] as Map<String, dynamic>;
      final accessToken  = data['access_token']  as String;
      final refreshToken = data['refresh_token']  as String;
      final user   = data['user'] as Map<String, dynamic>? ?? {};
      final role   = user['role'] as String? ?? 'patient';

      await AuthService.saveSession(
        accessToken: accessToken,
        refreshToken: refreshToken,
        role: role,
        phone: phone,
        name: user['name']?.toString(),
      );
      if (mounted) _routeToHome(role);
    } on ApiException catch (e) {
      _setError(e.message);
    } catch (e) {
      _setError('Login failed: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── STEP 3: Set password (first-time) ─────────────────────────────────────
  Future<void> _setPassword() async {
    if (_passCtrl.text.trim().length < 6) {
      _setError('Password must be at least 6 characters'); return;
    }
    if (_passCtrl.text.trim() != _confirmCtrl.text.trim()) {
      _setError('Passwords do not match'); return;
    }
    setState(() { _loading = true; _error = ''; });
    try {
      await ApiService.setPassword(_passCtrl.text.trim(), _confirmCtrl.text.trim());
      final role = await AuthService.getRole() ?? 'patient';
      if (mounted) _routeToHome(role);
    } on ApiException catch (e) {
      _setError(e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _routeToHome(String role) {
    Widget home;
    switch (role) {
      case 'shop_owner': home = const ShopHome(); break;
      case 'doctor':     home = const DoctorHome(); break;
      default:           home = const PatientHome(); break;
    }
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => home), (_) => false,
    );
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnim,
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 24),
                // Logo
                Center(
                  child: Container(
                    width: 140, height: 140,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.05),
                          blurRadius: 20, offset: const Offset(0, 8),
                        )
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Image.asset('assets/images/logo.png', fit: BoxFit.contain),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  _stepTitle(),
                  style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF111827)),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  _stepSubtitle(),
                  style: const TextStyle(fontSize: 15, color: Color(0xFF6B7280)),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 36),

                // ── Phone step ──────────────────────────────────────────────
                if (_step == _Step.phone) ...[
                  _label('Mobile Number'),
                  Row(children: [
                    Container(
                      height: 52,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF9FAFB),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      alignment: Alignment.center,
                      child: const Text('+91', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _phoneCtrl,
                        keyboardType: TextInputType.phone,
                        maxLength: 10,
                        buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        decoration: const InputDecoration(hintText: '10-digit number'),
                        onSubmitted: (_) => _sendOtp(),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 16),
                  // Toggle OTP / password
                  if (!_usePassword)
                    TextButton(
                      onPressed: () => setState(() { _usePassword = true; _error = ''; }),
                      child: const Text('Use password instead →', style: TextStyle(color: Color(0xFF7C3AED))),
                    ),
                  if (_usePassword) ...[
                    const SizedBox(height: 8),
                    _label('Password'),
                    TextField(
                      controller: _passCtrl,
                      obscureText: !_showPass,
                      decoration: InputDecoration(
                        hintText: 'Enter password',
                        suffixIcon: IconButton(
                          icon: Icon(_showPass ? Icons.visibility_off : Icons.visibility, size: 20),
                          onPressed: () => setState(() => _showPass = !_showPass),
                        ),
                      ),
                      onSubmitted: (_) => _loginWithPassword(),
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => setState(() { _usePassword = false; _error = ''; }),
                        child: const Text('Use OTP instead', style: TextStyle(color: Color(0xFF7C3AED), fontSize: 13)),
                      ),
                    ),
                  ],
                  const SizedBox(height: 8),
                  _errorWidget(),
                  const SizedBox(height: 12),
                  _primaryButton(
                    label: _usePassword ? 'Login' : 'Send OTP',
                    onTap: _usePassword ? _loginWithPassword : _sendOtp,
                  ),
                  const SizedBox(height: 20),
                  _divider('New to RxDesk?'),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () {
                      setState(() { _usePassword = false; _step = _Step.phone; });
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Enter your phone number and we\'ll register you automatically.')),
                      );
                    },
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF7C3AED)),
                      foregroundColor: const Color(0xFF7C3AED),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Register / Sign Up', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  ),
                ],

                // ── OTP step ────────────────────────────────────────────────
                if (_step == _Step.otp) ...[
                  _label('OTP Code'),
                  TextField(
                    controller: _otpCtrl,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: 12),
                    decoration: const InputDecoration(hintText: '• • • • • •'),
                    onSubmitted: (_) => _verifyOtp(),
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: _sendOtp,
                      child: const Text('Resend OTP', style: TextStyle(color: Color(0xFF7C3AED), fontSize: 13)),
                    ),
                  ),
                  _errorWidget(),
                  const SizedBox(height: 12),
                  _primaryButton(label: 'Verify & Login', onTap: _verifyOtp),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => _setStep(_Step.phone),
                    child: const Text('← Change number', style: TextStyle(color: Color(0xFF6B7280))),
                  ),
                ],

                // ── Set password step ───────────────────────────────────────
                if (_step == _Step.setPassword) ...[
                  _label('New Password'),
                  TextField(
                    controller: _passCtrl,
                    obscureText: !_showPass,
                    decoration: InputDecoration(
                      hintText: 'Min 6 characters',
                      suffixIcon: IconButton(
                        icon: Icon(_showPass ? Icons.visibility_off : Icons.visibility, size: 20),
                        onPressed: () => setState(() => _showPass = !_showPass),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _label('Confirm Password'),
                  TextField(
                    controller: _confirmCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(hintText: 'Re-enter password'),
                    onSubmitted: (_) => _setPassword(),
                  ),
                  const SizedBox(height: 8),
                  _errorWidget(),
                  const SizedBox(height: 12),
                  _primaryButton(label: 'Set Password & Continue', onTap: _setPassword),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () async {
                      final role = await AuthService.getRole() ?? 'patient';
                      if (mounted) _routeToHome(role);
                    },
                    child: const Text('Skip for now', style: TextStyle(color: Color(0xFF6B7280))),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Small helpers ─────────────────────────────────────────────────────────
  String _stepTitle() {
    if (_step == _Step.otp) return 'Enter OTP';
    if (_step == _Step.setPassword) return 'Set a Password';
    return 'Welcome to RxDesk';
  }

  String _stepSubtitle() {
    if (_step == _Step.otp) return 'We sent a 6-digit code to +91 ${_phoneCtrl.text}';
    if (_step == _Step.setPassword) return 'Secure your account with a password';
    return 'Login as patient, doctor, or shop owner';
  }

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(text, style: const TextStyle(
      fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF374151),
    )),
  );

  Widget _errorWidget() {
    if (_error.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFCA5A5)),
      ),
      child: Row(children: [
        const Icon(Icons.error_outline, color: Color(0xFFEF4444), size: 16),
        const SizedBox(width: 8),
        Expanded(child: Text(_error, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13))),
      ]),
    );
  }

  Widget _primaryButton({required String label, required VoidCallback onTap}) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _loading ? null : onTap,
        child: _loading
            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
            : Text(label),
      ),
    );
  }

  Widget _divider(String text) => Row(children: [
    const Expanded(child: Divider()),
    Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Text(text, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13)),
    ),
    const Expanded(child: Divider()),
  ]);
}
