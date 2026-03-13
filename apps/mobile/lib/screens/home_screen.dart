import 'package:flutter/material.dart';
import 'role_selection_screen.dart';
import 'shop_dashboard_screen.dart';
import 'patient_dashboard_screen.dart';
import 'doctor_dashboard_screen.dart';

class HomeScreen extends StatelessWidget {
  final String role;
  
  const HomeScreen({Key? key, required this.role}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (role == 'Shop') {
      return Scaffold(
        body: const ShopDashboardScreen(),
        appBar: AppBar(
          title: const Text('Shop'),
          backgroundColor: Colors.white,
          foregroundColor: Colors.black,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () {
              Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(
                  builder: (context) => const RoleSelectionScreen(),
                ),
                (route) => false,
              );
            },
          ),
        ),
      );
    }
    
    if (role == 'Patient') {
      return Scaffold(
        body: const PatientDashboardScreen(),
        appBar: AppBar(
          title: const Text('Patient'),
          backgroundColor: Colors.white,
          foregroundColor: Colors.black,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () {
              Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(
                  builder: (context) => const RoleSelectionScreen(),
                ),
                (route) => false,
              );
            },
          ),
        ),
      );
    }

    if (role == 'Doctor') {
      return Scaffold(
        body: const DoctorDashboardScreen(),
        appBar: AppBar(
          title: const Text('Doctor'),
          backgroundColor: Colors.white,
          foregroundColor: Colors.black,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () {
              Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(
                  builder: (context) => const RoleSelectionScreen(),
                ),
                (route) => false,
              );
            },
          ),
        ),
      );
    }

    // Default fallback
    return const Scaffold(
      body: Center(
        child: Text('Role Not Found'),
      ),
    );
  }
}
