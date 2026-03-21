import 'package:flutter/material.dart';
import 'services/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/shop/shop_home.dart';
import 'screens/shop/shop_settings_screen.dart';
import 'screens/doctor/doctor_home.dart';
import 'screens/patient/patient_home.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const RxDeskApp());
}

class RxDeskApp extends StatelessWidget {
  const RxDeskApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'RxDesk',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF7C3AED), // violet-600
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        fontFamily: 'Roboto',
        appBarTheme: const AppBarTheme(
          elevation: 0,
          scrolledUnderElevation: 0,
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF1F2937),
          surfaceTintColor: Colors.transparent,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFF9FAFB),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF7C3AED), width: 2),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF7C3AED),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
        ),
      ),
      home: const SplashGate(),
      routes: {
        '/shop/settings': (context) => const ShopSettingsScreen(),
      },
    );
  }
}

/// Checks stored session and routes to the correct home screen
class SplashGate extends StatefulWidget {
  const SplashGate({super.key});
  @override
  State<SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<SplashGate> {
  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await Future.delayed(const Duration(milliseconds: 1200)); // brief splash
    if (!mounted) return;
    final loggedIn = await AuthService.isLoggedIn();
    if (!loggedIn) {
      _go(const LoginScreen());
      return;
    }
    final role = await AuthService.getRole();
    switch (role) {
      case 'shop_owner':
        _go(const ShopHome());
      case 'doctor':
        _go(const DoctorHome());
      case 'patient':
        _go(const PatientHome());
      default:
        _go(const LoginScreen());
    }
  }

  void _go(Widget screen) {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => screen),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF7C3AED),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 90, height: 90,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(Icons.local_pharmacy_rounded, size: 48, color: Colors.white),
            ),
            const SizedBox(height: 20),
            const Text('RxDesk', style: TextStyle(
              fontSize: 36, fontWeight: FontWeight.w900, color: Colors.white,
              letterSpacing: -1,
            )),
            const SizedBox(height: 8),
            Text('Your medical companion', style: TextStyle(
              fontSize: 15, color: Colors.white.withOpacity(0.75),
            )),
            const SizedBox(height: 48),
            const SizedBox(
              width: 28, height: 28,
              child: CircularProgressIndicator(
                color: Colors.white, strokeWidth: 2.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
